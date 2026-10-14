"""Grant decisions (SPEC I.1-I.3, I.5). Deterministic given telemetry, requests and seed."""
from __future__ import annotations

from collections import deque
from dataclasses import dataclass
from typing import Callable, Dict, FrozenSet, List, Optional, Tuple

from mind.channel import channel_drain
from mind.types import CapacityKind as K, ReasonCode as R

GLOBAL_CAP = 12
COOLDOWN_GLOBAL = 24
COOLDOWN_KIND = 48
WINDOW = 24
BACKLOG_RUN = 24
BACKLOG_ABANDONED = 3


@dataclass(frozen=True)
class KindRule:
    step: int
    cap: float
    max_grants: int
    families: FrozenSet[R]


def v1_rules(memory_base: int) -> Dict[K, KindRule]:
    return {
        K.MEMORY_SLOTS: KindRule(64, memory_base + 256, 4, frozenset({R.PREDICTION_ERROR})),
        K.EXPECTATION_DIMS: KindRule(1, 9, 4, frozenset({R.PREDICTION_ERROR})),
        K.SELF_MODEL_NODES: KindRule(4, 24, 4, frozenset({R.BOREDOM, R.REFLECTIVE_BACKLOG})),
        K.REFLECTION_WORKING_SET: KindRule(1, 6, 4, frozenset({R.REFLECTIVE_BACKLOG})),
    }


def v2_rules() -> Dict[K, KindRule]:
    return {
        K.WIDEN_HIDDEN: KindRule(32, 256, 4, frozenset({R.PREDICTION_ERROR})),
        K.ENLARGE_LATENT: KindRule(8, 48, 4, frozenset({R.PREDICTION_ERROR})),
        K.ADD_EXPERT: KindRule(1, 6, 4, frozenset({R.BOREDOM})),
        K.DEEPEN: KindRule(1, 4, 2, frozenset({R.BOREDOM})),
        K.REFLECTION_WORKING_SET: KindRule(1, 6, 4, frozenset({R.REFLECTIVE_BACKLOG})),
    }


@dataclass
class TriggerConfig:
    pe_threshold: float = 0.4          # v1: mean PE; v2: mean NLL ratio to life baseline (1.25)
    boredom_threshold: float = 0.5
    novelty_threshold: float = 0.2


class GrowthHarness:
    def __init__(self, rules: Dict[K, KindRule], mode: str, apply_op: Callable,
                 trigger: TriggerConfig = TriggerConfig(), yoke: Optional[List[Tuple[int, str]]] = None,
                 param_count: Optional[Callable] = None, param_cap: Optional[float] = None,
                 flop_proxy: Optional[Callable] = None, flop_cap: Optional[float] = None):
        assert mode in ("on", "off", "schedule_matched", "random_growth")
        self.rules = rules
        self.mode = mode
        self.apply_op = apply_op
        self.trigger = trigger
        self.yoke = sorted(yoke or [])
        self.param_count = param_count
        self.param_cap = param_cap
        self.flop_proxy = flop_proxy
        self.flop_cap = flop_cap
        self.window = deque(maxlen=WINDOW)
        self.full_run = 0
        self.grants_total = 0
        self.grants_by_kind: Dict[str, int] = {k.value: 0 for k in rules}
        self.last_grant_tau: Optional[int] = None
        self.last_grant_by_kind: Dict[str, int] = {}
        self.log: List[dict] = []

    # ---- triggers ----------------------------------------------------------
    def _family_met(self, fam: R) -> Tuple[bool, dict]:
        w = list(self.window)
        if len(w) < WINDOW:
            return False, {"window": len(w)}
        pe = sum(t.prediction_error for t in w) / len(w)
        bo = sum(t.boredom for t in w) / len(w)
        nv = sum(t.novelty for t in w) / len(w)
        ab = sum(t.abandoned_for_capacity for t in w)
        ev = {"mean_pe": pe, "mean_boredom": bo, "mean_novelty": nv, "backlog_full_run": self.full_run,
              "abandoned_in_window": ab}
        if fam is R.PREDICTION_ERROR:
            return pe >= self.trigger.pe_threshold, ev
        if fam is R.BOREDOM:
            return bo >= self.trigger.boredom_threshold and nv <= self.trigger.novelty_threshold, ev
        return self.full_run >= BACKLOG_RUN or ab >= BACKLOG_ABANDONED, ev

    # ---- caps --------------------------------------------------------------
    def _caps_ok(self, kind: K, handles, tau: int) -> Optional[str]:
        rule = self.rules.get(kind)
        if rule is None:
            return "kind_not_allowed_for_mind"
        if self.grants_total >= GLOBAL_CAP:
            return "global_cap"
        if self.grants_by_kind[kind.value] >= rule.max_grants:
            return "kind_max_grants"
        if handles.size(kind) + rule.step > rule.cap:
            return "kind_cap"
        if self.last_grant_tau is not None and tau - self.last_grant_tau < COOLDOWN_GLOBAL:
            return "cooldown_global"
        lk = self.last_grant_by_kind.get(kind.value)
        if lk is not None and tau - lk < COOLDOWN_KIND:
            return "cooldown_kind"
        return None

    def _grant(self, kind: K, handles, tau: int, rec: dict, random_init: bool):
        rule = self.rules[kind]
        before = {k.value: handles.size(k) for k in handles.kinds}
        pc_before = self.param_count() if self.param_count else None
        info = self.apply_op(handles, kind, rule.step, random_init=random_init) or {}
        after = {k.value: handles.size(k) for k in handles.kinds}
        pc_after = self.param_count() if self.param_count else None
        if self.param_cap is not None and pc_after is not None and pc_after > self.param_cap:
            raise RuntimeError("param cap exceeded after grant; pre-check failed")
        self.grants_total += 1
        self.grants_by_kind[kind.value] += 1
        self.last_grant_tau = tau
        self.last_grant_by_kind[kind.value] = tau
        rec.update(decision="granted", step=rule.step, capacity_before=before, capacity_after=after,
                   params_before=pc_before, params_after=pc_after, op_info=info)

    def _would_exceed_param_or_flop(self, kind: K, handles) -> Optional[str]:
        if self.param_count is None:
            return None
        # v2 operations report their projected parameter count without mutating (see ops_v2)
        projected = self.apply_op(handles, kind, self.rules[kind].step, dry_run=True)
        if projected is None:
            return None
        if self.param_cap is not None and projected.get("params_after", 0) > self.param_cap:
            return "param_cap"
        if self.flop_cap is not None and self.flop_proxy is not None and \
                self.flop_proxy(projected.get("params_after", 0)) > self.flop_cap:
            return "compute_cap"
        return None

    # ---- per tick ----------------------------------------------------------
    def tick(self, tau: int, mind, channel) -> List[dict]:
        requests, dropped = channel_drain(channel)
        tel = mind.telemetry()
        self.window.append(tel)
        self.full_run = self.full_run + 1 if tel.working_set_full else 0
        handles = mind.capacity_handles()
        out = []
        granted = False
        if self.mode in ("schedule_matched", "random_growth"):
            for kind, reason in requests:
                out.append({"tau": tau, "kind": kind.value, "reason": reason.value, "decision": "denied",
                            "denial": "yoked_mode_ignores_requests"})
            for yt, kname in self.yoke:
                if yt == tau and not granted:
                    kind = K(kname)
                    rec = {"tau": tau, "kind": kname, "reason": "yoked", "trigger": None}
                    why = self._caps_ok(kind, handles, tau) or self._would_exceed_param_or_flop(kind, handles)
                    if why:
                        rec.update(decision="denied", denial=why)
                    else:
                        self._grant(kind, handles, tau, rec, random_init=(self.mode == "random_growth"))
                        granted = True
                    out.append(rec)
        else:
            for kind, reason in requests:
                rec = {"tau": tau, "kind": kind.value, "reason": reason.value}
                met, ev = self._family_met(reason)
                rec["trigger"] = ev
                if self.mode == "off":
                    rec.update(decision="denied", denial="growth_disabled")
                elif granted:
                    rec.update(decision="denied", denial="one_grant_per_tick")
                elif kind not in self.rules or reason not in self.rules[kind].families:
                    rec.update(decision="denied", denial="kind_not_allowed_for_family")
                elif not met:
                    rec.update(decision="denied", denial="trigger_not_met")
                else:
                    why = self._caps_ok(kind, handles, tau) or self._would_exceed_param_or_flop(kind, handles)
                    if why:
                        rec.update(decision="denied", denial=why)
                    else:
                        self._grant(kind, handles, tau, rec, random_init=False)
                        granted = True
                out.append(rec)
        if dropped:
            out.append({"tau": tau, "decision": "dropped", "count": dropped})
        self.log.extend(out)
        return out

    def grant_timeline(self) -> List[Tuple[int, str]]:
        return [(r["tau"], r["kind"]) for r in self.log if r.get("decision") == "granted"]
