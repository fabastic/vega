"""D11: physiology constants exported in the handoff equal CivSYS's real per-tick deltas."""
import random

import numpy as np

from app.simulation.context import SimulationContext
from app.simulation.economy.production import ActionSystem
from civsys_focal.physiology import PHYSIOLOGY as P
from app.simulation.humans.agent import AgentState
from app.simulation.humans.needs import NeedsSystem
from app.simulation.state import SimulationState
from app.simulation.world import WorldState


def _ctx(agent):
    st = SimulationState(world=WorldState(width=8, height=8))
    st.agents[agent.id] = agent
    return SimulationContext(state=st, rng=random.Random(0), np_rng=np.random.default_rng(0))


def test_needs_tick_rates():
    a = AgentState(id="a", name="a", needs={"hunger": 0.1, "thirst": 0.1, "sleep_need": 0.1, "energy": 0.9})
    a.current_action = "work"
    NeedsSystem().execute(_ctx(a))
    assert abs(a.needs.hunger - (0.1 + P["hunger_per_tick"])) < 1e-12
    assert abs(a.needs.thirst - (0.1 + P["thirst_per_tick"])) < 1e-12
    assert abs(a.needs.sleep_need - (0.1 + P["sleep_per_tick"])) < 1e-12
    assert abs(a.needs.energy - (0.9 - P["energy_loss_active"])) < 1e-12


def test_rest_and_damage_rates():
    a = AgentState(id="a", name="a", needs={"sleep_need": 0.5, "energy": 0.5, "hunger": 0.9, "health": 1.0})
    a.current_action = "rest"
    NeedsSystem().execute(_ctx(a))
    assert abs(a.needs.energy - (0.5 + P["energy_gain_rest"])) < 1e-12
    assert abs(a.needs.sleep_need - (0.5 + P["sleep_per_tick"] - P["sleep_relief_rest"])) < 1e-12
    assert a.needs.hunger > P["hunger_damage_threshold"]
    assert abs(a.needs.health - (1.0 - P["health_loss"])) < 1e-12
    b = AgentState(id="b", name="b", needs={"thirst": P["thirst_damage_threshold"] - P["thirst_per_tick"] + 1e-6})
    NeedsSystem().execute(_ctx(b))
    assert abs(b.needs.health - (1.0 - P["health_loss"])) < 1e-12


def test_eat_relief():
    a = AgentState(id="a", name="a", needs={"hunger": 0.7, "thirst": 0.7, "health": 0.5})
    a.economic.food_inventory = 3.0
    a.current_action = "eat"
    ActionSystem().execute(_ctx(a))
    assert abs(a.needs.hunger - (0.7 - P["eat_hunger_relief"])) < 1e-12
    assert abs(a.needs.thirst - (0.7 - P["eat_thirst_relief"])) < 1e-12
    assert abs(a.needs.health - (0.5 + P["eat_health_gain"])) < 1e-12


def test_starvation_threshold():
    from app.simulation.civilization.lifecycle import LifecycleSystem
    a = AgentState(id="a", name="a", needs={"hunger": P["starvation_threshold"] + 1e-6})
    LifecycleSystem().execute(_ctx(a))
    assert not a.is_alive
    b = AgentState(id="b", name="b", needs={"hunger": P["starvation_threshold"]})
    LifecycleSystem().execute(_ctx(b))
    assert b.is_alive
