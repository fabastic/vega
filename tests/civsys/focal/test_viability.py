"""Round 3 viable life (civsys_focal/viability.py): off by default, deterministic, and the population survives."""
import hashlib
import json

from app.simulation.civilization.lifecycle import LifecycleSystem
from app.simulation.economy.markets import EconomySystem
from civsys_focal.config import FocalConfig
from civsys_focal.engine import FocalSimulationEngine
from civsys_focal.viability import ViabilityConfig, ViableEconomySystem, ViableLifecycleSystem


def _engine(viability: bool, seed=11, pop=40, size=64):
    cfg = FocalConfig(enabled=True, affect_enabled=True, focal_policy="mind", death_isolation=True,
                      viability=ViabilityConfig(enabled=viability))
    return FocalSimulationEngine(seed=seed, population_size=pop, width=size, height=size, focal=cfg)


def _digest(e):
    s = [(a.id, a.is_alive, round(a.needs.hunger, 6), round(a.needs.thirst, 6), a.current_location, a.current_action)
         for a in e.state.agents.values()]
    return hashlib.sha256(json.dumps(s, default=str).encode()).hexdigest()


def test_viability_is_off_by_default_and_swaps_no_systems():
    assert FocalConfig().viability.enabled is False
    e = _engine(False)
    kinds = {type(s) for s in e.systems}
    assert EconomySystem in kinds and LifecycleSystem in kinds
    assert ViableEconomySystem not in kinds and ViableLifecycleSystem not in kinds


def test_viability_swaps_economy_and_lifecycle():
    kinds = {type(s) for s in _engine(True).systems}
    assert ViableEconomySystem in kinds and ViableLifecycleSystem in kinds and EconomySystem not in kinds


def test_viable_life_is_deterministic():
    a, b = _engine(True), _engine(True)
    for _ in range(60):
        a.step()
        b.step()
    assert _digest(a) == _digest(b)


def test_population_survives_where_unmodified_civsys_starves():
    off, on = _engine(False), _engine(True)
    for _ in range(250):
        off.step()
        on.step()
    assert sum(not a.is_alive for a in off.state.agents.values()) > 0      # upstream: first starvation at ~tick 81
    assert all(a.is_alive for a in on.state.agents.values())
    assert on.state.world.market.food_price <= ViabilityConfig().price_cap


def test_mechanized_work_is_executed_as_work():
    e = _engine(True)
    e.state.world.active_capabilities.append("electricity")
    seen = False
    for _ in range(20):
        e.step()
        assert all(a.current_action != "work_mechanized" for a in e.state.agents.values())
        seen |= any(a.action_intent == "work_mechanized" for a in e.state.agents.values())
    assert seen


def test_old_checkpoint_decision_system_still_runs():
    """A FocalDecisionSystem unpickled from a round-2 checkpoint has no viability attributes."""
    e = _engine(False)
    ds = next(s for s in e.systems if type(s).__name__ == "FocalDecisionSystem")
    del ds.viability, ds.skip_ids
    for _ in range(3):
        e.step()
