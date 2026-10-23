import pytest
from app.simulation.humans.agent import AgentState, NeedState, PersonalityState, EmotionState
from app.simulation.world import WorldState, MapCell, MarketPriceIndex
from app.simulation.events import ActiveEvent
from app.simulation.action import Action, ActionScore
from app.simulation.civilization.metrics import MetricsSnapshot
from app.simulation.experiments.causality import CausalRecord
from app.simulation.experiments.runner import ExperimentConfig
from app.simulation.state import SimulationState, WebSocketStatePayload

def test_agent_schema_instantiation():
    agent = AgentState(id="agent_1", name="Alice")
    assert agent.id == "agent_1"
    assert agent.needs.hunger == 0.0
    assert agent.needs.calculate_pressures()["hunger"] == 0.0
    assert agent.personality.openness == 0.5
    assert agent.visual_profile == "worker_01"

def test_world_schema_instantiation():
    world = WorldState(width=32, height=32)
    assert world.width == 32
    assert world.crop_yield_multiplier == 1.0
    assert world.market.food_price == 10.0

def test_master_simulation_state():
    state = SimulationState(simulation_id="sim_test", seed=42)
    assert state.seed == 42
    assert state.tick == 0
    assert len(state.agents) == 0
