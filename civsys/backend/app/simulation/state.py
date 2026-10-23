from pydantic import BaseModel, Field
from typing import Dict, List, Optional
from app.simulation.humans.agent import AgentState
from app.simulation.world import WorldState
from app.simulation.events import ActiveEvent
from app.simulation.civilization.metrics import MetricsSnapshot
from app.simulation.experiments.causality import CausalRecord
class GroupState(BaseModel):
    id: str
    name: str
    group_type: str = "community"
    members: List[str] = Field(default_factory=list)
    cohesion: float = 0.5
    influence: float = 0.5

class SimulationState(BaseModel):
    simulation_id: str = "sim_default"
    seed: int = 42
    tick: int = 0
    is_running: bool = False
    tick_rate_hz: float = 10.0
    
    world: WorldState = Field(default_factory=WorldState)
    agents: Dict[str, AgentState] = Field(default_factory=dict)
    groups: Dict[str, GroupState] = Field(default_factory=dict)
    active_events: List[ActiveEvent] = Field(default_factory=list)
    metrics_history: List[MetricsSnapshot] = Field(default_factory=list)
    causal_ledger: List[CausalRecord] = Field(default_factory=list)

class AgentPosPayload(BaseModel):
    id: str
    name: str
    x: float
    y: float
    visual_profile: str
    current_action: str
    health: float
    hunger: float
    is_migrating: bool
    chat_bubble: Optional[str] = None

class BuildingPayload(BaseModel):
    id: str
    building_type: str
    x: int
    y: int
    scale: List[float] = Field(default_factory=lambda: [3.0, 3.0, 3.0])

class WebSocketStatePayload(BaseModel):
    simulation_id: str
    tick: int
    is_running: bool
    weather: str
    crop_yield_multiplier: float
    food_price: float
    agents: List[AgentPosPayload]
    buildings: List[BuildingPayload] = Field(default_factory=list)
    latest_metrics: Optional[MetricsSnapshot] = None


