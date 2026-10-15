from typing import List, Literal, Optional

from pydantic import BaseModel, Field

from civsys_focal.viability import ViabilityConfig


class FocalConfig(BaseModel):
    enabled: bool = False
    focal_agent_id: str = "agent_0000"
    affect_enabled: bool = False
    focal_policy: Literal["civsys", "mind"] = "civsys"
    reflection_enabled: bool = True
    export_enabled: bool = False
    heldout_agent_ids: List[str] = Field(default_factory=list)
    snapshot_tick: Optional[int] = None
    history_ticks: int = 168
    # round 2 (both default off, so round-1 behaviour is unchanged)
    death_isolation: bool = False      # the focal mind can never learn that other agents died
    export_all_agents: bool = False    # export every non-held-out agent's egocentric stream (v2 training data)
    # round 3 (default off)
    viability: ViabilityConfig = Field(default_factory=ViabilityConfig)   # population survives a long life phase
