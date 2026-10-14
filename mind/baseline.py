"""Seeded uniform mind: proves a third mind runs in both worlds unchanged (SPEC D.1)."""
import random

from mind.channel import CapacityChannel
from mind.rng import random_state_from_json, random_state_to_json
from mind.types import ACTION_KINDS, Action, Telemetry


class _NoCapacity:
    kinds = ()

    def size(self, kind):
        raise KeyError(kind)

    def grow(self, kind, step):
        raise KeyError(kind)


class UniformMind:
    version = "baseline/1"

    def __init__(self, seed: int, channel: CapacityChannel = None):
        self.rng = random.Random(seed)
        self.channel = channel or CapacityChannel()
        self.last_log = {}

    def observe(self, obs, intero) -> Action:
        kind = self.rng.choice(ACTION_KINDS)
        self.last_log = {"action": kind.value, "target": None}
        return Action(kind)

    def export_state(self) -> dict:
        return {"version": self.version, "rng": random_state_to_json(self.rng)}

    @classmethod
    def from_state(cls, state: dict, channel: CapacityChannel = None) -> "UniformMind":
        m = cls(0, channel)
        m.rng = random_state_from_json(state["rng"])
        return m

    def telemetry(self) -> Telemetry:
        return Telemetry()

    def capacity_handles(self):
        return _NoCapacity()
