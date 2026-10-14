"""Self-model nodes (SPEC J.4). Capacity = maximum number of nodes."""
from __future__ import annotations

from collections import Counter

NODE_TYPES = ("body_mapping", "sensor_channel", "memory_reliability", "clock_rate",
              "action_tendency", "affect_tendency", "room_feature")
MOTOR_KINDS = ("move", "turn")


class SelfModel:
    def __init__(self, capacity: int = 8):
        self.capacity = capacity
        self.nodes = {}          # key -> {"type", "estimate", "confidence"}
        # action-tendency table lives in a node (counts as one node)
        self.nodes["action_tendency"] = {"type": "action_tendency", "estimate": {}, "confidence": 0.5}
        # efference evidence per motor kind: list of 0/1 "proprioceptive change observed"
        self.efference = {k: [] for k in MOTOR_KINDS}
        self.selfpred_hits = []  # last 24 self-prediction outcomes

    # ---- generic node store ------------------------------------------------
    def upsert(self, key: str, ntype: str, estimate, confidence: float) -> str:
        """Returns "updated", "created", "replaced" or "rejected"."""
        if key in self.nodes:
            self.nodes[key].update(estimate=estimate, confidence=confidence)
            return "updated"
        if len(self.nodes) < self.capacity:
            self.nodes[key] = {"type": ntype, "estimate": estimate, "confidence": confidence}
            return "created"
        weakest = min((k for k in self.nodes if k != "action_tendency"),
                      key=lambda k: (self.nodes[k]["confidence"], k), default=None)
        if weakest is not None and self.nodes[weakest]["confidence"] < confidence:
            del self.nodes[weakest]
            self.nodes[key] = {"type": ntype, "estimate": estimate, "confidence": confidence}
            return "replaced"
        return "rejected"

    def get(self, key):
        n = self.nodes.get(key)
        return None if n is None else n["estimate"]

    def set_capacity(self, capacity: int):
        self.capacity = capacity

    # ---- action tendency (self-prediction, SD1) ----------------------------
    def predict_action(self, state_bin: str):
        table = self.nodes["action_tendency"]["estimate"].get(state_bin)
        if not table:
            return None
        return max(sorted(table), key=lambda a: table[a])

    def record_action(self, state_bin: str, action: str, predicted):
        table = self.nodes["action_tendency"]["estimate"].setdefault(state_bin, {})
        table[action] = table.get(action, 0) + 1
        if predicted is not None:
            self.selfpred_hits.append(1 if predicted == action else 0)
            self.selfpred_hits = self.selfpred_hits[-24:]

    def selfpred_accuracy(self):
        return sum(self.selfpred_hits) / len(self.selfpred_hits) if self.selfpred_hits else None

    # ---- body mapping (efference tests, SD2) -------------------------------
    def record_efference(self, motor: str, changed: bool):
        ev = self.efference[motor]
        ev.append(1 if changed else 0)
        self.efference[motor] = ev[-24:]

    def efference_consistency(self, motor: str):
        """(n_tests, majority_fraction, majority_value) over the last tests."""
        ev = self.efference[motor][-10:]
        if not ev:
            return 0, 0.0, None
        c = Counter(ev)
        val, n = max(sorted(c.items()), key=lambda kv: kv[1])
        return len(ev), n / len(ev), val

    def predicted_change(self, motor: str) -> bool:
        """SD2 probe: does this motor command change proprioception? Life prior: yes."""
        est = self.get(f"body_mapping:{motor}")
        if est is None:
            return True
        return bool(est)

    # ---- state ---------------------------------------------------------------
    def to_json(self):
        return {"capacity": self.capacity, "nodes": self.nodes, "efference": self.efference,
                "selfpred_hits": self.selfpred_hits}

    @classmethod
    def from_json(cls, d):
        sm = cls(d["capacity"])
        sm.nodes = d["nodes"]
        sm.efference = {k: list(v) for k, v in d["efference"].items()}
        sm.selfpred_hits = list(d["selfpred_hits"])
        return sm
