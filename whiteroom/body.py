"""Body physiology in the room (SPEC C.2), at the rates CivSYS wrote into the handoff."""
from __future__ import annotations

from mind.types import ActionKind, Interoception


class Body:
    def __init__(self, needs: dict, physiology: dict, support: str = "floor", floor: float = 0.6,
                 stock_units: int = 40):
        self.p = dict(physiology)
        self.hunger = float(needs["hunger"])
        self.thirst = float(needs["thirst"])
        self.energy = float(needs["energy"])
        self.sleep = float(needs["sleep_need"])
        self.health = float(needs["health"])
        self.pain = float(needs.get("pain", 0.0))
        self.support = support
        self.floor = floor
        self.stock = stock_units if support == "stock" else 0
        self.alive = True
        self.clamped = False
        if self.support == "floor":
            self._clamp()

    def _clamp(self):
        before = (self.hunger, self.thirst)
        self.hunger = min(self.hunger, self.floor)
        self.thirst = min(self.thirst, self.floor)
        self.clamped = (self.hunger, self.thirst) != before or self.clamped

    def step(self, action_kind: ActionKind) -> None:
        if not self.alive:
            return
        p = self.p
        self.hunger = min(1.0, self.hunger + p["hunger_per_tick"])
        self.thirst = min(1.0, self.thirst + p["thirst_per_tick"])
        self.sleep = min(1.0, self.sleep + p["sleep_per_tick"])
        if action_kind is ActionKind.REST:
            self.energy = min(1.0, self.energy + p["energy_gain_rest"])
            self.sleep = max(0.0, self.sleep - p["sleep_relief_rest"])
        else:
            self.energy = max(0.0, self.energy - p["energy_loss_active"])
        if action_kind is ActionKind.EAT and self.stock > 0:
            self.stock -= 1
            self.hunger = max(0.0, self.hunger - p["eat_hunger_relief"])
            self.thirst = max(0.0, self.thirst - p["eat_thirst_relief"])
            self.health = min(1.0, self.health + p["eat_health_gain"])
        if self.support == "floor":
            self._clamp()
        if self.hunger > p["hunger_damage_threshold"] or self.thirst > p["thirst_damage_threshold"]:
            self.health = max(0.0, self.health - p["health_loss"])
        if self.health <= 0.0 or self.hunger > p["starvation_threshold"]:
            self.alive = False

    def interoception(self) -> Interoception:
        return Interoception(self.hunger, self.thirst, 1.0 - self.energy, self.sleep, 1.0 - self.health, self.pain)
