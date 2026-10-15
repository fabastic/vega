"""FocalSimulationEngine: SimulationEngine plus focal systems when enabled (SPEC A.1).

With FocalConfig(enabled=False) (the default) it is exactly SimulationEngine;
the golden backcompat test checks this.
"""
from __future__ import annotations

from app.simulation.engine import SimulationEngine
from civsys_focal.adapter import BodyFrame
from civsys_focal.config import FocalConfig
from civsys_focal.physiology import PHYSIOLOGY
from civsys_focal.systems import FocalDecisionSystem, FocalExportSystem
from civsys_focal.viability import ViableEconomySystem, ViableLifecycleSystem
from app.simulation.civilization.lifecycle import LifecycleSystem
from app.simulation.economy.markets import EconomySystem
from app.simulation.humans.decisions import DecisionSystem
from app.simulation.snapshot import SnapshotSystem


class FocalSimulationEngine(SimulationEngine):
    def __init__(self, seed: int = 42, population_size: int = 800, width: int = 512, height: int = 512,
                 focal: FocalConfig = None, mind=None):
        super().__init__(seed=seed, population_size=population_size, width=width, height=height)
        self.focal = focal or FocalConfig()
        if not self.focal.enabled:
            return
        agent = self.state.agents[self.focal.focal_agent_id]
        if mind is None:
            from mind.rng import stable_seed
            from mind.rulebased import RuleBasedMind
            phys = PHYSIOLOGY
            if self.focal.death_isolation:
                # the mind gets only the rates it uses for its body clock; nothing about dying
                phys = {k: PHYSIOLOGY[k] for k in ("hunger_per_tick", "thirst_per_tick", "sleep_per_tick")}
            mind = RuleBasedMind(agent.personality.model_dump(), phys,
                                 stable_seed(seed, "mind_v1", self.focal.focal_agent_id),
                                 reflection_enabled=self.focal.reflection_enabled,
                                 absence_only=self.focal.death_isolation)
        self.context.transient_data["focal"] = {
            "mind": mind, "frame": BodyFrame(agent.current_location), "rows": [], "history": [],
            "heldout_rows": {}, "heldout_frames": {}, "train_rows": {}, "train_frames": {}, "last": None,
        }
        via = self.focal.viability
        for i, s in enumerate(self.systems):
            if type(s) is DecisionSystem:
                self.systems[i] = FocalDecisionSystem(self.focal)
            elif via.enabled and type(s) is EconomySystem:
                self.systems[i] = ViableEconomySystem(via)
            elif via.enabled and type(s) is LifecycleSystem:
                self.systems[i] = ViableLifecycleSystem(via)
        snap = next(i for i, s in enumerate(self.systems) if isinstance(s, SnapshotSystem))
        self.systems.insert(snap, FocalExportSystem(self.focal))

    @property
    def focal_state(self):
        return self.context.transient_data.get("focal")

    def set_focal_mind(self, mind) -> None:
        """Harness hook (SPEC D.4): swap the focal mind, e.g. for civ_control after T."""
        self.context.transient_data["focal"]["mind"] = mind
