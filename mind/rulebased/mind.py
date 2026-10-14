"""Rule-based mind v1 (SPEC D.5, plus v3 capacity structure and reflection).

Everything here is hand-written rules with hand-set constants. The reflective
queries and the capacity request rule are SCRIPTED BY DESIGN.

The mind never receives the true tick, the arm, the condition or the cell.
Its processing is driven by observe() calls, but the only explicit time
variable it uses is its subjective clock S (and the body-clock estimate B).
"""
from __future__ import annotations

import math
import random
from collections import deque
from typing import Dict, Optional

import numpy as np

from mind.affect.core import AffectCore, AppraisalInputs
from mind.affect.clock import BodyClock, SubjectiveClock
from mind.channel import CapacityChannel
from mind.features import features as feature_vector
from mind.reflection.engine import ReflectionModule, ReflectionSignals
from mind.reflection.selfmodel import SelfModel
from mind.rng import random_state_from_json, random_state_to_json
from mind.types import (Action, ActionKind, CapacityKind, Interoception, Observation, ReasonCode,
                        Telemetry)

VERSION = "rulebased/1"

# ---- pre-registered constants (SPEC D.5, H, I) ----------------------------
EXP_ALPHA = 0.2
BASE_EXPECTATION_DIMS = 5
EXTRA_DIM_ORDER = ("ray_dist_var", "heading_change", "sleep_trend", "sound_var")
WINDOW = 24
REPLAY_INFO_THRESHOLD = 0.2
SOFTMAX_T = 0.5
W_PULL = {
    ActionKind.REST: {"sadness": 0.3, "grief": 0.2},
    ActionKind.TALK: {"loneliness": 0.8, "attachment": 0.4},
    ActionKind.SEEK_COMPANY: {"loneliness": 0.8, "attachment": 0.4},
    ActionKind.EXPLORE: {"boredom": 0.6, "curiosity": 0.8},
    ActionKind.RUMINATE: {"sadness": 0.4, "grief": 0.4, "boredom": 0.2},
    ActionKind.MOVE: {"fear": 1.2},
}
FAMILY_KINDS = {
    ReasonCode.PREDICTION_ERROR: (CapacityKind.MEMORY_SLOTS, CapacityKind.EXPECTATION_DIMS),
    ReasonCode.BOREDOM: (CapacityKind.SELF_MODEL_NODES,),
    ReasonCode.REFLECTIVE_BACKLOG: (CapacityKind.REFLECTION_WORKING_SET, CapacityKind.SELF_MODEL_NODES),
}
REQUEST_PE = 0.4
REQUEST_BOREDOM, REQUEST_NOVELTY = 0.5, 0.2
REQUEST_BACKLOG_RUN, REQUEST_ABANDONED = 24, 3
MOTOR = (ActionKind.MOVE, ActionKind.TURN)


def _occupied_bins(f: np.ndarray) -> int:
    """Number of the 8 vision bins holding any sample (feature 'none' flag is 0)."""
    return int(sum(1 for k in range(8) if f[k * 5 + 1] == 0.0))


def _sigmoid(x):
    return 1.0 / (1.0 + math.exp(-x))


class V1Capacity:
    """Typed handles to v1's growable structures (SPEC D.1 capacity_handles).

    Only the growth harness calls the mutators, between ticks.
    """
    kinds = (CapacityKind.MEMORY_SLOTS, CapacityKind.EXPECTATION_DIMS,
             CapacityKind.SELF_MODEL_NODES, CapacityKind.REFLECTION_WORKING_SET)

    def __init__(self, mind: "RuleBasedMind"):
        self._mind = mind

    def size(self, kind: CapacityKind) -> float:
        m = self._mind
        if kind is CapacityKind.MEMORY_SLOTS:
            return float(m.memory_slots if m.memory_slots is not None else len(m.memories))
        if kind is CapacityKind.EXPECTATION_DIMS:
            return float(m.n_dims)
        if kind is CapacityKind.SELF_MODEL_NODES:
            return float(m.selfmodel.capacity)
        if kind is CapacityKind.REFLECTION_WORKING_SET:
            return float(m.reflection.working_set)
        raise KeyError(kind)

    def grow(self, kind: CapacityKind, step: int):
        m = self._mind
        if kind is CapacityKind.MEMORY_SLOTS:
            m.memory_slots = (m.memory_slots or len(m.memories)) + step
        elif kind is CapacityKind.EXPECTATION_DIMS:
            for _ in range(step):
                m._add_dim()
        elif kind is CapacityKind.SELF_MODEL_NODES:
            m.selfmodel.set_capacity(m.selfmodel.capacity + step)
        elif kind is CapacityKind.REFLECTION_WORKING_SET:
            m.reflection.working_set += step
        else:
            raise KeyError(kind)


class RuleBasedMind:
    version = VERSION
    # hook points used by the learned mind (v2) subclass; v1 behaviour is unchanged
    family_kinds = FAMILY_KINDS
    request_pe_threshold = REQUEST_PE
    request_boredom_threshold = REQUEST_BOREDOM
    request_novelty_threshold = REQUEST_NOVELTY

    # ---- construction --------------------------------------------------------
    def __init__(self, traits: dict, physiology: dict, seed: int, relationships: Optional[dict] = None,
                 channel: Optional[CapacityChannel] = None, reflection_enabled: bool = True,
                 absence_only: bool = False):
        self.traits = dict(traits)
        self.physiology = dict(physiology)
        self.rng = random.Random(seed)
        self.channel = channel or CapacityChannel()
        self.affect = AffectCore(self.traits)
        self.clock = SubjectiveClock()
        self.body_clock = BodyClock({"hunger": physiology["hunger_per_tick"],
                                     "thirst": physiology["thirst_per_tick"],
                                     "sleep_pressure": physiology["sleep_per_tick"]})
        self.relationships = dict(relationships or {})   # ref -> affection
        self.n_dims = BASE_EXPECTATION_DIMS
        self.pred = None            # predicted expectation vector
        self.scale = None
        self.familiarity: Dict[str, float] = {}
        self.place_memory: Dict[str, dict] = {}
        self.agent_last_seen: Dict[str, float] = {}
        self.absence_noted = set()
        self.absence_only = absence_only   # round 2: long absence is unexplained absence, never grief
        self.memories = []
        self.memory_slots: Optional[int] = None   # None = unbounded (life); set at handoff (Q21)
        self.mem_counter = 0
        self.action_value: Dict[str, list] = {}   # kind -> [value, confidence]
        self.outcomes = deque(maxlen=WINDOW)      # control window
        self.internal_goals = []
        self.internal_goal_count = 0
        self.selfmodel = SelfModel(8)
        self.reflection = ReflectionModule(2, reflection_enabled)
        self.extent_hist = [0] * 9
        # per-tick memory of the previous step
        self.prev_intero: Optional[Interoception] = None
        self.prev_deficit = None
        self.prev_feats = None
        self.prev_agents_visible = False
        self.prev_action: Optional[Action] = None
        self.prev_bin = None
        self.prev_heading = None
        self.low_nov_run = 0
        self.modality_expected: Dict[str, list] = {"vision": [0.0, 0], "sound": [0.0, 0], "touch": [0.0, 0]}
        self.modality_low_run = {"vision": 0, "sound": 0, "touch": 0}
        self.phantom_window = deque(maxlen=WINDOW)
        self.replay_window = deque(maxlen=WINDOW)
        self.goal_progress_window = deque(maxlen=WINDOW)
        self.selfpred_long = 0.5
        self.s_marks = []           # (S, B) recorded each time S crosses a multiple of 24
        self.req_window = deque(maxlen=WINDOW)
        self.req_rotation = {r.value: 0 for r in ReasonCode}
        self.meal_count = 0
        self.last_log: dict = {}
        self.telemetry_cache = Telemetry()

    # ---- protocol ------------------------------------------------------------
    def capacity_handles(self) -> V1Capacity:
        return V1Capacity(self)

    def telemetry(self) -> Telemetry:
        return self.telemetry_cache

    def observe(self, obs: Observation, intero: Interoception) -> Action:
        f = feature_vector(obs, intero)
        o = self._expectation_vector(obs, f)
        pe, novelty = self._prediction(o)
        deficit = (intero.hunger + intero.thirst + intero.sleep_pressure + intero.fatigue + intero.health_deficit) / 5.0
        deficit_rise = 0.0 if self.prev_deficit is None else max(0.0, deficit - self.prev_deficit)
        outcome_value = 0
        if self.prev_deficit is not None:
            dd = deficit - self.prev_deficit
            outcome_value = 1 if dd < -0.004 else (-1 if dd > 0.004 else 0)

        # outcome of the previous action (efference / expected-consequence matching)
        counted, success = self._evaluate_previous_action(obs, intero, f, novelty)
        if counted:
            self.outcomes.append(1.0 if success else 0.0)
        control = (sum(self.outcomes) / len(self.outcomes)) if self.outcomes else 0.5

        # social, contact, places, prolonged absence of valued agents
        agents = [v for v in obs.vision if v.category == "agent"]
        contact_lost = self.prev_agents_visible and not agents
        self.prev_agents_visible = bool(agents)
        for v in obs.vision:
            if v.ref:
                pm = self.place_memory.setdefault(v.ref, {"cat": v.category, "conf": 0.0})
                pm.update(cat=v.category, bearing=v.bearing, dist=v.distance, last_S=self.clock.S,
                          conf=min(1.0, pm["conf"] + 0.1))
                if v.category == "agent":
                    self.agent_last_seen[v.ref] = self.clock.S
                    self.absence_noted.discard(v.ref)
        absence = 0.0
        for ref, aff in self.relationships.items():
            last = self.agent_last_seen.get(ref)
            if aff >= 0.6 and last is not None and ref not in self.absence_noted and self.clock.S - last >= 24:
                absence += aff
                self.absence_noted.add(ref)

        self.low_nov_run = self.low_nov_run + 1 if (novelty < 0.2 and pe < 0.2) else 0
        n_vis = _occupied_bins(f)
        extent_high = self._extent_high(n_vis)
        av = self.action_value.get("eat", [0.5, 0.0])
        relief_predicted = av[0] > 0.5 and av[1] > 0.2

        x = AppraisalInputs(need_deficit=deficit, deficit_rise=deficit_rise, hunger=intero.hunger,
                            thirst=intero.thirst, prediction_error=pe, novelty=novelty,
                            social_gain=obs.social[0], social_loss=obs.social[1], contact_lost=contact_lost,
                            control=control, outcome_value=outcome_value,
                            grief_signal=0.0 if self.absence_only else absence,
                            absence_signal=absence if self.absence_only else 0.0,
                            low_novelty_run=self.low_nov_run, visual_extent_high=extent_high,
                            relief_predicted=relief_predicted)
        fired = self.affect.step(x)
        I = self.affect.I

        # clocks
        self.clock.tick(I["boredom"], self.affect.a, I["curiosity"])
        self.body_clock.tick(intero, self.clock.last_rate)
        ate = (self.prev_action is not None and self.prev_action.kind is ActionKind.EAT and success)
        if ate:
            self.meal_count += 1
            self.clock.anchor(self.body_clock.B)
        self._mark_clock()

        # drives and internal goals
        goal_progress = outcome_value > 0 or novelty > 0.6
        self._update_internal_goals(novelty)
        self.goal_progress_window.append(1 if goal_progress else 0)

        # memory encode, decay, replay
        if counted and self.prev_action is not None:
            self._encode(self.prev_action.kind.value, success, pe)
        self._decay_memories()
        info = self._informativeness(obs, f)
        replayed = self._maybe_replay(info, I["boredom"])

        # self-model: efference evidence, sensor channels
        if self.prev_action is not None and self.prev_action.kind in MOTOR:
            changed = self._proprio_changed(obs)
            self.selfmodel.record_efference(self.prev_action.kind.value, changed)
        self._update_modalities(obs, f)

        # reflection
        sig = self._reflection_signals(I["boredom"])
        revisit = self.prev_action is not None and self.prev_action.kind in (ActionKind.RUMINATE, ActionKind.IDLE)
        max_depth = 1 + self.selfmodel.capacity // 8
        self.reflection.step(sig, self.selfmodel, self.place_memory, max_depth, revisit)

        # decision
        state_bin = self._state_bin(intero, info)
        predicted = self._predict_self_action(state_bin)
        utilities = self._utilities(obs, intero, agents)
        kind = self._softmax_choice(utilities)
        target = self._target(kind, obs, agents)
        action = Action(kind, target)
        self.selfmodel.record_action(state_bin, kind.value, predicted)
        acc = self.selfmodel.selfpred_accuracy()
        if acc is not None:
            self.selfpred_long += 0.01 * (acc - self.selfpred_long)

        # phantom percept: target expected (memory) but not observed
        expected = {r for r, pm in self.place_memory.items() if pm["conf"] >= 0.5} | \
                   {r for r, a in self.relationships.items() if a >= 0.5}
        phantom = bool(target and target in expected and target not in obs.refs())
        self.phantom_window.append(target if phantom else None)

        # scripted capacity request rule (D17)
        self._request_capacity(self._request_pe_signal(pe), I["boredom"], novelty)

        handles = self.capacity_handles()
        self.telemetry_cache = Telemetry(
            prediction_error=self._request_pe_signal(pe), boredom=I["boredom"], novelty=novelty,
            working_set_full=self.reflection.backlog_full(),
            abandoned_for_capacity=self.reflection.abandoned_this_tick,
            capacity={k.value: handles.size(k) for k in handles.kinds})
        self.last_log = {
            "action": kind.value, "target": target, "phantom": phantom,
            "pe": pe, "novelty": novelty, "control": control, "info": info,
            "valence": self.affect.v, "arousal": self.affect.a, "dominance": self.affect.d,
            "mood": self.affect.mood, "S": self.clock.S, "B": self.body_clock.B,
            "body_uninformative_run": self.body_clock.uninformative_run,
            "replay": replayed, "rules": "|".join(fired), "selfpred_acc": acc,
            "predicted_action": predicted, "n_memories": len(self.memories),
            "internal_goals_total": self.internal_goal_count,
            "utilities": {k.value: round(v, 4) for k, v in utilities.items()},
            "reflection_events": list(self.reflection.events),
            "open_queries": len(self.reflection.open_queries()),
            **{f"I_{c}": I[c] for c in I},
        }
        # roll state
        self.prev_intero, self.prev_deficit, self.prev_feats = intero, deficit, f
        self.prev_action, self.prev_bin = action, state_bin
        self.prev_heading = obs.proprio.heading
        return action

    # ---- expectation, PE, novelty ------------------------------------------
    def _expectation_vector(self, obs: Observation, f: np.ndarray) -> np.ndarray:
        dists = [f[k * 5] for k in range(8)]
        n_obj = sum(1 for v in obs.vision if v.category not in ("none", "wall") and not v.category.startswith("terrain"))
        known_vis = sum(1 for v in obs.vision if v.ref and v.ref in self.place_memory)
        base = [min(1.0, n_obj / 8.0), float(np.mean(dists)), obs.sound.level,
                (obs.touch.front + obs.touch.back + obs.touch.left + obs.touch.right) / 4.0, min(1.0, known_vis / 8.0)]
        extra = {
            "ray_dist_var": float(np.var(dists)) * 4.0,
            "heading_change": 0.0 if self.prev_heading is None else min(1.0, abs(obs.proprio.heading - self.prev_heading) / math.pi),
            "sleep_trend": 0.0,
            "sound_var": float(np.var([s[1] for s in obs.sound.sources])) if obs.sound.sources else 0.0,
        }
        if self.prev_intero is not None:
            extra["sleep_trend"] = max(-1.0, min(1.0, (f[55] - self.prev_feats[55]) * 25.0))
        vec = base + [extra[name] for name in EXTRA_DIM_ORDER[: self.n_dims - BASE_EXPECTATION_DIMS]]
        return np.array(vec, dtype=np.float64)

    def _add_dim(self):
        if self.n_dims >= BASE_EXPECTATION_DIMS + len(EXTRA_DIM_ORDER):
            return
        self.n_dims += 1
        if self.pred is not None:
            self.pred = np.append(self.pred, 0.0)
            self.scale = np.append(self.scale, 0.1)

    def _prediction(self, o: np.ndarray):
        if self.pred is None:
            self.pred = o.copy()
            self.scale = np.maximum(0.1, np.abs(o))
            return 0.0, 1.0
        err = np.abs(o - self.pred) / (self.scale + 1e-9)
        pe = float(np.clip(np.mean(np.minimum(err, 1.0)), 0.0, 1.0))
        sig = "|".join(str(int(min(4, max(0, math.floor(v * 5))))) for v in o)
        for k in list(self.familiarity):
            self.familiarity[k] *= 0.99
            if self.familiarity[k] < 1e-3:
                del self.familiarity[k]
        count = self.familiarity.get(sig, 0.0)
        novelty = math.exp(-count / 3.0)
        self.familiarity[sig] = count + 1.0
        self.pred = self.pred + EXP_ALPHA * (o - self.pred)
        self.scale = np.maximum(0.1, self.scale + 0.05 * (np.abs(o) - self.scale))
        return pe, novelty

    # ---- outcomes and control ------------------------------------------------
    def _proprio_changed(self, obs: Observation) -> bool:
        if self.prev_heading is None:
            return False
        return abs(obs.proprio.heading - self.prev_heading) > 1e-6 or obs.proprio.last_motor is not None

    def _evaluate_previous_action(self, obs, intero, f, novelty):
        a = self.prev_action
        if a is None or self.prev_intero is None:
            return False, False
        k = a.kind
        if k is ActionKind.EAT:
            return True, intero.hunger < self.prev_intero.hunger - 1e-6
        if k is ActionKind.REST:
            return True, (intero.fatigue < self.prev_intero.fatigue - 1e-6 or
                          intero.sleep_pressure < self.prev_intero.sleep_pressure - 1e-6)
        if k in MOTOR:
            vision_changed = self.prev_feats is not None and float(np.abs(f[:40] - self.prev_feats[:40]).sum()) > 1e-6
            return True, self._proprio_changed(obs) or vision_changed
        if k in (ActionKind.TALK, ActionKind.SEEK_COMPANY):
            return True, obs.social[0] > 0 or any(v.category == "agent" for v in obs.vision)
        if k is ActionKind.EXPLORE:
            vision_changed = self.prev_feats is not None and float(np.abs(f[:40] - self.prev_feats[:40]).sum()) > 1e-6
            return True, novelty > 0.3 or vision_changed
        return False, False

    # ---- memory --------------------------------------------------------------
    def _encode(self, kind: str, success: bool, pe: float):
        ew = (0.3 if success else -0.3) + 0.2 * self.affect.v
        imp = 0.3 + 0.4 * pe
        m = self.affect.mood
        sgn = 1.0 if ew > 0 else (-1.0 if ew < 0 else 0.0)
        imp = max(0.0, min(1.0, imp * (1.0 + 0.3 * m * sgn)))
        self.memories.append({"id": self.mem_counter, "S": self.clock.S, "subject": kind,
                              "outcome": bool(success), "emotional_weight": ew, "importance": imp,
                              "confidence": 1.0, "source": "experience"})
        self.mem_counter += 1
        val = self.action_value.setdefault(kind, [0.5, 0.0])
        val[0] += 0.1 * ((1.0 if success else 0.0) - val[0])
        val[1] = min(1.0, val[1] + 0.02)
        self._enforce_slots()

    def _decay_memories(self):
        kept = []
        for m in self.memories:
            retention = max(0.1, (abs(m["emotional_weight"]) + m["importance"]) / 2.0)
            m["confidence"] -= 0.002 * (1.0 - retention)
            if m["confidence"] > 0.1:
                kept.append(m)
        self.memories = kept

    def _enforce_slots(self):
        if self.memory_slots is not None and len(self.memories) > self.memory_slots:
            self.memories.sort(key=lambda m: (m["importance"] * m["confidence"], m["id"]))
            self.memories = self.memories[len(self.memories) - self.memory_slots:]
            self.memories.sort(key=lambda m: m["id"])

    def truncate_to_slots(self, slots: int):
        """Applied at handoff (Q21): keep the top `slots` memories by retention score."""
        self.memory_slots = int(slots)
        self._enforce_slots()

    def _informativeness(self, obs: Observation, f: np.ndarray) -> float:
        n_vis = _occupied_bins(f)
        n_agent = sum(1 for v in obs.vision if v.category == "agent")
        t = obs.touch
        touch_any = 1.0 if max(t.front, t.back, t.left, t.right) > 0 else 0.0
        return min(1.0, 0.5 * (n_vis / 8.0) + 0.25 * obs.sound.level + 0.25 * touch_any + 0.5 * min(1, n_agent))

    def _maybe_replay(self, info: float, boredom: float):
        if info >= REPLAY_INFO_THRESHOLD or not self.memories:
            self.replay_window.append(None)
            return False
        p = _sigmoid(2.0 * boredom + (1.0 - info) - 1.5)
        if self.rng.random() >= p:
            self.replay_window.append(None)
            return False
        v = self.affect.v
        weights = []
        for m in self.memories:
            w = abs(m["emotional_weight"]) + m["importance"]
            if v * m["emotional_weight"] > 0:
                w *= 1.5
            weights.append(w)
        mem = self.rng.choices(self.memories, weights=weights, k=1)[0]
        val = self.action_value.setdefault(mem["subject"], [0.5, 0.0])
        val[0] += 0.05 * ((1.0 if mem["outcome"] else 0.0) - val[0])
        self.memories.append({**mem, "id": self.mem_counter, "S": self.clock.S,
                              "confidence": mem["confidence"] * 0.7, "source": "replay"})
        self.mem_counter += 1
        self._enforce_slots()
        self.replay_window.append((mem["subject"], mem["outcome"]))
        return True

    # ---- clocks, goals, modalities ------------------------------------------
    def _mark_clock(self):
        if not self.s_marks or self.clock.S - self.s_marks[-1][0] >= 24.0:
            self.s_marks.append((self.clock.S, self.body_clock.B))
            self.s_marks = self.s_marks[-4:]

    def _clock_discrepancy(self):
        if len(self.s_marks) < 2:
            return None
        (s0, b0), (s1, b1) = self.s_marks[-2], self.s_marks[-1]
        db = b1 - b0
        if db <= 1e-9:
            return None
        return abs((s1 - s0) - db) / db

    def _update_internal_goals(self, novelty):
        I = self.affect.I
        names = {g["name"] for g in self.internal_goals}
        if I["boredom"] > 0.5 and "seek_novelty" not in names:
            self.internal_goals.append({"name": "seek_novelty", "origin": "internal", "S": self.clock.S})
            self.internal_goal_count += 1
        if I["curiosity"] > 0.5 and "explore" not in names:
            self.internal_goals.append({"name": "explore", "origin": "internal", "S": self.clock.S})
            self.internal_goal_count += 1
        if novelty > 0.6:
            self.internal_goals = [g for g in self.internal_goals if g["name"] != "seek_novelty"]
        if self.prev_action is not None and self.prev_action.kind is ActionKind.EXPLORE and novelty > 0.3:
            self.internal_goals = [g for g in self.internal_goals if g["name"] != "explore"]

    def _update_modalities(self, obs: Observation, f: np.ndarray):
        mags = {
            "vision": _occupied_bins(f) / 8.0,
            "sound": obs.sound.level,
            "touch": 1.0 if max(obs.touch.front, obs.touch.back, obs.touch.left, obs.touch.right) > 0 else 0.0,
        }
        for mod, mag in mags.items():
            mean, n = self.modality_expected[mod]
            ratio = (mag / mean) if mean >= 0.05 else None
            if ratio is not None and ratio <= 0.2:
                self.modality_low_run[mod] += 1
            else:
                self.modality_low_run[mod] = 0
            self.modality_expected[mod] = [mean + (mag - mean) / (n + 1) if n < 2000 else mean + 0.0005 * (mag - mean), n + 1]
        self.last_modalities = mags

    def _reflection_signals(self, boredom: float) -> ReflectionSignals:
        ratios = {}
        for mod, (mean, _) in self.modality_expected.items():
            mag = getattr(self, "last_modalities", {}).get(mod, 0.0)
            ratios[mod] = (mag / mean) if mean >= 0.05 else None
        counts = {}
        for t in self.phantom_window:
            if t:
                counts[t] = counts.get(t, 0) + 1
        conflict = None
        seen = {}
        for r in self.replay_window:
            if r:
                subj, outc = r
                if subj in seen and seen[subj] != outc:
                    conflict = subj
                seen[subj] = outc
        motor_ev = self.selfmodel.efference["move"][-WINDOW:] + self.selfmodel.efference["turn"][-WINDOW:]
        acc = self.selfmodel.selfpred_accuracy()
        return ReflectionSignals(
            S=self.clock.S, modality_ratio=ratios, modality_low_run=dict(self.modality_low_run),
            phantom_counts=counts, replay_conflict=conflict, clock_discrepancy=self._clock_discrepancy(),
            body_uninformative_run=self.body_clock.uninformative_run,
            selfpred_drop=(acc is not None and len(self.selfmodel.selfpred_hits) >= WINDOW and acc < self.selfpred_long - 0.2),
            efference_mismatch=(1.0 - sum(motor_ev) / len(motor_ev)) if motor_ev else 0.0,
            n_motor=len(motor_ev), boredom=boredom,
            goal_progress_recent=bool(sum(self.goal_progress_window)) or len(self.goal_progress_window) < WINDOW)

    def _extent_high(self, n_vis: int) -> bool:
        self.extent_hist[n_vis] += 1
        total = sum(self.extent_hist)
        cum, p75 = 0, 8
        for k, c in enumerate(self.extent_hist):
            cum += c
            if cum >= 0.75 * total:
                p75 = k
                break
        return n_vis > p75

    def _state_bin(self, intero: Interoception, info: float) -> str:
        return f"h{int(intero.hunger > 0.5)}f{int(intero.fatigue > 0.5)}i{int(info > 0.3)}"

    # ---- decision ------------------------------------------------------------
    def _evidence(self, kind: str) -> float:
        v = self.action_value.get(kind)
        return 0.0 if v is None else (v[0] - 0.5) * 2.0 * v[1]

    def _utilities(self, obs, intero, agents) -> Dict[ActionKind, float]:
        I = self.affect.I
        w_threat = 1.0 + 0.5 * I["fear"]
        w_nov = 1.0 + 0.5 * (I["boredom"] + I["curiosity"])
        goal_names = {g["name"] for g in self.internal_goals}
        # need actions: need benefit x expected success (habituates when they stop working)
        p_eat = self.action_value.get("eat", [0.5, 0.0])[0]
        p_rest = self.action_value.get("rest", [0.5, 0.0])[0]
        u = {
            ActionKind.EAT: (2.5 * intero.hunger + 1.5 * intero.thirst) * w_threat * (0.25 + 0.75 * p_eat),
            ActionKind.REST: (2.0 * intero.fatigue + 1.5 * intero.sleep_pressure) * w_threat * (0.25 + 0.75 * p_rest),
            ActionKind.WORK: 1.2 - 0.8 * intero.fatigue,
            ActionKind.TALK: 0.6 * float(self.traits.get("extraversion", 0.5)) * (1.0 if agents else 0.2),
            ActionKind.SEEK_COMPANY: 0.1,
            ActionKind.EXPLORE: 0.3 * w_nov + (0.3 if goal_names & {"explore", "seek_novelty"} else 0.0),
            ActionKind.MOVE: 0.2 * w_nov,
            ActionKind.TURN: 0.1,
            ActionKind.RUMINATE: 0.05,
            ActionKind.IDLE: 0.0,
        }
        for k in u:
            if k not in (ActionKind.EAT, ActionKind.REST):
                u[k] += self._evidence(k.value)
        for k in (ActionKind.MOVE, ActionKind.EXPLORE, ActionKind.WORK):
            u[k] -= 0.3 * intero.fatigue
        for k, weights in W_PULL.items():
            u[k] += sum(w * I[e] for e, w in weights.items())
        for k, bonus in self.reflection.action_utility().items():
            u[k] += bonus
        return u

    def _softmax_choice(self, u: Dict[ActionKind, float]) -> ActionKind:
        kinds = list(u)
        vals = np.array([u[k] for k in kinds], dtype=np.float64)
        p = np.exp((vals - vals.max()) / SOFTMAX_T)
        p /= p.sum()
        r = self.rng.random()
        acc = 0.0
        for k, pk in zip(kinds, p):
            acc += pk
            if r < acc:
                return k
        return kinds[-1]

    def _target(self, kind: ActionKind, obs: Observation, agents) -> Optional[str]:
        if kind is ActionKind.TALK:
            if agents:
                return min(agents, key=lambda v: (v.distance, v.ref or "")).ref
            return self._best_remembered_agent()
        if kind is ActionKind.SEEK_COMPANY:
            return self._best_remembered_agent()
        if kind is ActionKind.MOVE:
            t = self.reflection.epistemic_target()
            if t:
                return t
            places = [(pm["conf"], r) for r, pm in self.place_memory.items() if pm["cat"] != "agent"]
            return max(places)[1] if places else None
        return None

    def _best_remembered_agent(self) -> Optional[str]:
        if not self.relationships:
            return None
        return max(sorted(self.relationships), key=lambda r: self.relationships[r])

    # ---- hooks (overridden by the learned mind) ------------------------------
    def _predict_self_action(self, state_bin: str):
        return self.selfmodel.predict_action(state_bin)

    def _request_pe_signal(self, pe: float) -> float:
        return pe

    # ---- requests (scripted by design) ---------------------------------------
    def _request_capacity(self, pe, boredom, novelty):
        self.req_window.append((pe, boredom, novelty))
        if len(self.req_window) < WINDOW:
            return
        mpe = sum(x[0] for x in self.req_window) / WINDOW
        mb = sum(x[1] for x in self.req_window) / WINDOW
        mn = sum(x[2] for x in self.req_window) / WINDOW
        families = []
        if mpe >= self.request_pe_threshold:
            families.append(ReasonCode.PREDICTION_ERROR)
        if mb >= self.request_boredom_threshold and mn <= self.request_novelty_threshold:
            families.append(ReasonCode.BOREDOM)
        if self.reflection.full_run >= REQUEST_BACKLOG_RUN or self.reflection.abandoned_this_tick >= REQUEST_ABANDONED:
            families.append(ReasonCode.REFLECTIVE_BACKLOG)
        for fam in families:
            kinds = self.family_kinds[fam]
            i = self.req_rotation[fam.value] % len(kinds)
            self.req_rotation[fam.value] += 1
            self.channel.request_capacity(kinds[i], fam)

    # ---- state ---------------------------------------------------------------
    def export_state(self) -> dict:
        return {
            "version": VERSION, "traits": self.traits, "physiology": self.physiology,
            "rng": random_state_to_json(self.rng), "affect": self.affect.to_json(),
            "clock": self.clock.to_json(), "body_clock": self.body_clock.to_json(),
            "relationships": self.relationships, "n_dims": self.n_dims,
            "pred": None if self.pred is None else self.pred.tolist(),
            "scale": None if self.scale is None else self.scale.tolist(),
            "familiarity": self.familiarity, "place_memory": self.place_memory,
            "agent_last_seen": self.agent_last_seen, "absence_noted": sorted(self.absence_noted),
            "absence_only": self.absence_only,
            "memories": self.memories, "memory_slots": self.memory_slots, "mem_counter": self.mem_counter,
            "action_value": self.action_value, "outcomes": list(self.outcomes),
            "internal_goals": self.internal_goals, "internal_goal_count": self.internal_goal_count,
            "selfmodel": self.selfmodel.to_json(), "reflection": self.reflection.to_json(),
            "extent_hist": self.extent_hist,
            "prev": {
                "intero": None if self.prev_intero is None else list(self.prev_intero.as_tuple()),
                "deficit": self.prev_deficit,
                "feats": None if self.prev_feats is None else self.prev_feats.tolist(),
                "agents_visible": self.prev_agents_visible,
                "action": None if self.prev_action is None else [self.prev_action.kind.value, self.prev_action.target_ref],
                "bin": self.prev_bin, "heading": self.prev_heading,
            },
            "low_nov_run": self.low_nov_run, "modality_expected": self.modality_expected,
            "modality_low_run": self.modality_low_run, "phantom_window": list(self.phantom_window),
            "replay_window": [list(r) if r else None for r in self.replay_window],
            "goal_progress_window": list(self.goal_progress_window), "selfpred_long": self.selfpred_long,
            "s_marks": [list(x) for x in self.s_marks], "req_window": [list(x) for x in self.req_window],
            "req_rotation": self.req_rotation, "meal_count": self.meal_count,
            "last_modalities": getattr(self, "last_modalities", {}),
        }

    @classmethod
    def from_state(cls, state: dict, channel: Optional[CapacityChannel] = None) -> "RuleBasedMind":
        m = cls(state["traits"], state["physiology"], 0, state["relationships"], channel,
                state["reflection"]["enabled"])
        m.rng = random_state_from_json(state["rng"])
        m.affect = AffectCore.from_json(state["affect"])
        m.clock = SubjectiveClock.from_json(state["clock"])
        m.body_clock = BodyClock.from_json(state["body_clock"])
        m.n_dims = state["n_dims"]
        m.pred = None if state["pred"] is None else np.array(state["pred"], dtype=np.float64)
        m.scale = None if state["scale"] is None else np.array(state["scale"], dtype=np.float64)
        m.familiarity = dict(state["familiarity"])
        m.place_memory = {k: dict(v) for k, v in state["place_memory"].items()}
        m.agent_last_seen = dict(state["agent_last_seen"])
        m.absence_noted = set(state.get("absence_noted", state.get("grieved", [])))   # round-1 states used "grieved"
        m.absence_only = bool(state.get("absence_only", False))
        m.memories = [dict(x) for x in state["memories"]]
        m.memory_slots = state["memory_slots"]
        m.mem_counter = state["mem_counter"]
        m.action_value = {k: list(v) for k, v in state["action_value"].items()}
        m.outcomes = deque(state["outcomes"], maxlen=WINDOW)
        m.internal_goals = [dict(g) for g in state["internal_goals"]]
        m.internal_goal_count = state["internal_goal_count"]
        m.selfmodel = SelfModel.from_json(state["selfmodel"])
        m.reflection = ReflectionModule.from_json(state["reflection"])
        m.extent_hist = list(state["extent_hist"])
        p = state["prev"]
        m.prev_intero = None if p["intero"] is None else Interoception(*p["intero"])
        m.prev_deficit = p["deficit"]
        m.prev_feats = None if p["feats"] is None else np.array(p["feats"], dtype=np.float64)
        m.prev_agents_visible = p["agents_visible"]
        m.prev_action = None if p["action"] is None else Action(ActionKind(p["action"][0]), p["action"][1])
        m.prev_bin, m.prev_heading = p["bin"], p["heading"]
        m.low_nov_run = state["low_nov_run"]
        m.modality_expected = {k: list(v) for k, v in state["modality_expected"].items()}
        m.modality_low_run = dict(state["modality_low_run"])
        m.phantom_window = deque(state["phantom_window"], maxlen=WINDOW)
        m.replay_window = deque([tuple(r) if r else None for r in state["replay_window"]], maxlen=WINDOW)
        m.goal_progress_window = deque(state["goal_progress_window"], maxlen=WINDOW)
        m.selfpred_long = state["selfpred_long"]
        m.s_marks = [tuple(x) for x in state["s_marks"]]
        m.req_window = deque([tuple(x) for x in state["req_window"]], maxlen=WINDOW)
        m.req_rotation = dict(state["req_rotation"])
        m.meal_count = state["meal_count"]
        m.last_modalities = dict(state["last_modalities"])
        return m
