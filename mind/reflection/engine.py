"""Reflective queries: generation, lifecycle, chains, resolution, action utility.

SCRIPTED BY DESIGN (SPEC J). Every query object carries scripted_by_design=True.
All inputs are internal signals; no sense-off flag and no true time (D19).
"""
from __future__ import annotations

from dataclasses import asdict, dataclass, field
from typing import Dict, List, Optional

from mind.types import ActionKind, QueryType

# pre-registered values (SPEC J.2, J.3, J.5)
EXISTENTIAL_RATIO = 0.2
EXISTENTIAL_RUN = 12
EXISTENTIAL_ACCEPT_RUN = 24
EPISTEMIC_PHANTOMS = 3
TEMPORAL_DISCREPANCY = 0.25
TEMPORAL_UNINFORMATIVE_RUN = 24
SELF_MISMATCH = 0.5
MEANING_BOREDOM = 0.5
EFFERENCE_TESTS_TO_RESOLVE = 5
EFFERENCE_CONSISTENCY = 0.8
CHILD_OF = {
    QueryType.EXISTENTIAL: QueryType.EPISTEMIC,
    QueryType.EPISTEMIC: QueryType.SELF_IDENTITY,
    QueryType.TEMPORAL: QueryType.EPISTEMIC,
    QueryType.MEANING: QueryType.EXISTENTIAL,
}
UTILITY = {
    QueryType.EXISTENTIAL: {ActionKind.EXPLORE: 0.4},
    QueryType.EPISTEMIC: {ActionKind.MOVE: 0.4, ActionKind.RUMINATE: 0.2},
    QueryType.TEMPORAL: {ActionKind.RUMINATE: 0.3, ActionKind.REST: 0.2},
    QueryType.SELF_IDENTITY: {ActionKind.TURN: 0.3, ActionKind.MOVE: 0.3},
    QueryType.MEANING: {ActionKind.RUMINATE: 0.4, ActionKind.EXPLORE: 0.2},
}
TYPES = tuple(QueryType)
RECUR_REFRACTORY_S = 24.0   # a resolved (type, subject) cannot recur within 24 subjective units


@dataclass
class ReflectiveQuery:
    id: int
    type: str
    subject: str
    evidence: Dict[str, float]
    depth: int = 0
    parent_id: Optional[int] = None
    status: str = "open"            # open | revisited | resolved | abandoned
    created_S: float = 0.0
    revisits: int = 0
    resolution: Optional[str] = None
    abandoned_for_capacity: bool = False
    scripted_by_design: bool = True

    def magnitude(self) -> float:
        return max([abs(v) for v in self.evidence.values()] + [0.0])

    def priority(self) -> float:
        return self.magnitude() * (1 + self.revisits)


@dataclass
class ReflectionSignals:
    """Internal signals the mind computes each tick (all in its own terms)."""
    S: float
    modality_ratio: Dict[str, Optional[float]] = field(default_factory=dict)   # observed/expected
    modality_low_run: Dict[str, int] = field(default_factory=dict)
    phantom_counts: Dict[str, int] = field(default_factory=dict)               # target -> count in window
    replay_conflict: Optional[str] = None                                      # subject with conflicting replays
    clock_discrepancy: Optional[float] = None                                  # |dS - dB| / dB over last 24 S-units
    body_uninformative_run: int = 0
    selfpred_drop: bool = False
    efference_mismatch: float = 0.0
    n_motor: int = 0
    boredom: float = 0.0
    goal_progress_recent: bool = True


class ReflectionModule:
    def __init__(self, working_set: int = 2, enabled: bool = True):
        self.working_set = working_set
        self.enabled = enabled
        self.queries: List[ReflectiveQuery] = []
        self.next_id = 0
        self.full_run = 0
        self.abandoned_this_tick = 0
        self.events: List[dict] = []    # this tick's created/resolved/abandoned/revisited (for logs)
        self.refractory: Dict[str, float] = {}   # "type|subject" -> S until which it cannot recur
        self.selfmodel_ref = None

    # ---- helpers -------------------------------------------------------------
    def open_queries(self):
        return [q for q in self.queries if q.status in ("open", "revisited")]

    def _is_open(self, qtype: QueryType, subject: str) -> bool:
        return any(q.type == qtype.value and q.subject == subject for q in self.open_queries())

    def _create(self, qtype: QueryType, subject: str, evidence: dict, S: float,
                depth: int = 0, parent: Optional[int] = None):
        if self._is_open(qtype, subject):
            return None
        if self.refractory.get(f"{qtype.value}|{subject}", -1.0) > S:
            return None
        if qtype is QueryType.EXISTENTIAL and self.selfmodel_ref is not None and                 self.selfmodel_ref.get(f"room_feature:no_{subject.split(':', 1)[1]}") is not None:
            return None   # absence already accepted as a feature of this place
        q = ReflectiveQuery(self.next_id, qtype.value, subject, {k: float(v) for k, v in evidence.items()},
                            depth, parent, created_S=S)
        self.next_id += 1
        open_q = self.open_queries()
        if len(open_q) >= self.working_set:
            weakest = min(open_q, key=lambda x: (x.priority(), -x.id))
            if weakest.priority() >= q.priority():
                q.status = "abandoned"
                q.abandoned_for_capacity = True
                self.queries.append(q)
                self.refractory[f"{q.type}|{q.subject}"] = S + RECUR_REFRACTORY_S
                self.abandoned_this_tick += 1
                self.events.append({"event": "abandoned", "id": q.id, "type": q.type})
                return None
            weakest.status = "abandoned"
            weakest.abandoned_for_capacity = True
            self.refractory[f"{weakest.type}|{weakest.subject}"] = S + RECUR_REFRACTORY_S
            self.abandoned_this_tick += 1
            self.events.append({"event": "abandoned", "id": weakest.id, "type": weakest.type})
        self.queries.append(q)
        self.events.append({"event": "created", "id": q.id, "type": q.type, "depth": depth})
        return q

    def _resolve(self, q: ReflectiveQuery, resolution: str, S: float = 0.0):
        q.status = "resolved"
        q.resolution = resolution
        self.refractory[f"{q.type}|{q.subject}"] = S + RECUR_REFRACTORY_S
        self.events.append({"event": "resolved", "id": q.id, "type": q.type, "resolution": resolution})

    # ---- per tick ------------------------------------------------------------
    def step(self, sig: ReflectionSignals, selfmodel, place_memory: dict, max_depth: int,
             revisit: bool) -> None:
        self.events = []
        self.abandoned_this_tick = 0
        self.selfmodel_ref = selfmodel
        if not self.enabled:
            self.full_run = 0
            return
        self._generate(sig)
        self._check_resolutions(sig, selfmodel)
        if revisit:
            self._revisit(sig, selfmodel, place_memory, max_depth)
        self.full_run = self.full_run + 1 if len(self.open_queries()) >= self.working_set else 0

    def _generate(self, sig: ReflectionSignals):
        S = sig.S
        for mod, ratio in sig.modality_ratio.items():
            if ratio is not None and ratio <= EXISTENTIAL_RATIO and sig.modality_low_run.get(mod, 0) >= EXISTENTIAL_RUN:
                self._create(QueryType.EXISTENTIAL, f"modality:{mod}",
                             {"absence": 1.0 - ratio, "run": min(1.0, sig.modality_low_run[mod] / 48)}, S)
        for target, n in sig.phantom_counts.items():
            if n >= EPISTEMIC_PHANTOMS:
                self._create(QueryType.EPISTEMIC, f"place:{target}", {"unconfirmed_recalls": min(1.0, n / 6)}, S)
        if sig.replay_conflict:
            self._create(QueryType.EPISTEMIC, f"memory:{sig.replay_conflict}", {"replay_conflict": 1.0}, S)
        if (sig.clock_discrepancy is not None and sig.clock_discrepancy >= TEMPORAL_DISCREPANCY) or \
                sig.body_uninformative_run >= TEMPORAL_UNINFORMATIVE_RUN:
            self._create(QueryType.TEMPORAL, "clock",
                         {"discrepancy": min(1.0, sig.clock_discrepancy or 0.0),
                          "body_clock_silent": min(1.0, sig.body_uninformative_run / 48)}, S)
        if sig.selfpred_drop or (sig.n_motor >= 4 and sig.efference_mismatch >= SELF_MISMATCH):
            self._create(QueryType.SELF_IDENTITY, "self:body",
                         {"efference_mismatch": sig.efference_mismatch, "selfpred_drop": float(sig.selfpred_drop)}, S)
        if sig.boredom >= MEANING_BOREDOM and not sig.goal_progress_recent:
            self._create(QueryType.MEANING, "goals", {"boredom": sig.boredom}, S)

    def _check_resolutions(self, sig: ReflectionSignals, selfmodel):
        for q in self.open_queries():
            t = QueryType(q.type)
            if t is QueryType.EXISTENTIAL:
                mod = q.subject.split(":", 1)[1]
                ratio = sig.modality_ratio.get(mod)
                if ratio is not None and ratio >= 0.5:
                    self._resolve(q, "belief_update", sig.S)
                elif sig.modality_low_run.get(mod, 0) >= EXISTENTIAL_ACCEPT_RUN:
                    res = selfmodel.upsert(f"room_feature:no_{mod}", "room_feature", True, 0.8)
                    if res != "rejected":
                        self._resolve(q, "self_node_created", sig.S)
            elif t is QueryType.SELF_IDENTITY:
                done = 0
                for motor in ("move", "turn"):
                    n, frac, val = selfmodel.efference_consistency(motor)
                    if n >= EFFERENCE_TESTS_TO_RESOLVE and frac >= EFFERENCE_CONSISTENCY:
                        # "no effect" (val == 0) counts as a consistent mapping (SPEC J.3)
                        if selfmodel.upsert(f"body_mapping:{motor}", "body_mapping", bool(val), frac) != "rejected":
                            done += 1
                if done:
                    self._resolve(q, "self_node_created", sig.S)
            elif t is QueryType.MEANING:
                if sig.goal_progress_recent:
                    self._resolve(q, "none", sig.S)

    def _revisit(self, sig: ReflectionSignals, selfmodel, place_memory: dict, max_depth: int):
        open_q = self.open_queries()
        if not open_q:
            return
        q = max(open_q, key=lambda x: (x.magnitude(), -x.id))
        q.revisits += 1
        q.status = "revisited"
        self.events.append({"event": "revisited", "id": q.id, "type": q.type})
        t = QueryType(q.type)
        if t is QueryType.EPISTEMIC and q.subject.startswith("place:"):
            ref = q.subject.split(":", 1)[1]
            if ref in place_memory:
                place_memory[ref]["conf"] *= 0.5
            selfmodel.upsert("memory_reliability", "memory_reliability", 0.5, 0.6)
            self._resolve(q, "memory_confidence_change", sig.S)
            return
        if t is QueryType.EPISTEMIC and q.subject.startswith("memory:"):
            selfmodel.upsert("memory_reliability", "memory_reliability", 0.5, 0.6)
            self._resolve(q, "memory_confidence_change", sig.S)
            return
        if t is QueryType.TEMPORAL and sig.body_uninformative_run == 0 and sig.clock_discrepancy is not None:
            selfmodel.upsert("clock_rate", "clock_rate", 1.0 + sig.clock_discrepancy, 0.6)
            self._resolve(q, "clock_recalibrated", sig.S)
            return
        if q.depth < max_depth - 1 and t in CHILD_OF:
            child_t = CHILD_OF[t]
            subject = q.subject if child_t is not QueryType.SELF_IDENTITY else "self:body"
            if child_t is QueryType.EPISTEMIC and not subject.startswith(("place:", "memory:")):
                subject = f"memory:{q.subject}"
            self._create(child_t, subject, {"inherited": q.magnitude()}, sig.S, q.depth + 1, q.id)

    # ---- outputs -------------------------------------------------------------
    def action_utility(self) -> Dict[ActionKind, float]:
        out: Dict[ActionKind, float] = {}
        if not self.enabled:
            return out
        for q in self.open_queries():
            w = q.magnitude()
            for kind, u in UTILITY[QueryType(q.type)].items():
                out[kind] = out.get(kind, 0.0) + u * w
        return out

    def epistemic_target(self) -> Optional[str]:
        for q in sorted(self.open_queries(), key=lambda x: -x.magnitude()):
            if q.type == QueryType.EPISTEMIC.value and q.subject.startswith("place:"):
                return q.subject.split(":", 1)[1]
        return None

    def summary_vector(self) -> List[float]:
        """10 dims: open count per type (/6), mean depth per type (/4)."""
        oq = self.open_queries()
        counts = [sum(1 for q in oq if q.type == t.value) / 6.0 for t in TYPES]
        depths = []
        for t in TYPES:
            ds = [q.depth for q in oq if q.type == t.value]
            depths.append((sum(ds) / len(ds) / 4.0) if ds else 0.0)
        return counts + depths

    def backlog_full(self) -> bool:
        return len(self.open_queries()) >= self.working_set

    # ---- state ---------------------------------------------------------------
    def to_json(self):
        return {"working_set": self.working_set, "enabled": self.enabled, "next_id": self.next_id,
                "full_run": self.full_run, "queries": [asdict(q) for q in self.queries],
                "refractory": dict(self.refractory)}

    @classmethod
    def from_json(cls, d):
        r = cls(d["working_set"], d["enabled"])
        r.next_id = d["next_id"]
        r.full_run = d["full_run"]
        r.queries = [ReflectiveQuery(**q) for q in d["queries"]]
        r.refractory = dict(d.get("refractory", {}))
        return r
