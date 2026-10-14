from typing import Literal, Optional

from pydantic import BaseModel

Arm = Literal["furnished_room", "exteroception_removed", "full_deprivation", "fade_out", "noise_only"]
Feedback = Literal["none", "proprioceptive", "full"]


class RoomConfig(BaseModel):
    size: int = 12
    metabolic_support: Literal["floor", "none", "stock"] = "floor"
    floor: float = 0.6
    stock_units: int = 40
    fade_ticks: int = 72


class CellConfig(BaseModel):
    """One experimental cell (SPEC E.2). The mind is never told any of this."""
    arm: str
    mind: Literal["v1", "v2"] = "v1"
    growth: Literal["on", "off", "schedule_matched", "random_growth"] = "on"
    reflection: bool = True
    learning: Optional[Literal["replay_only", "replay_plus_imagination"]] = None
    K: int = 168
    room_seed: int = 0

    def key(self) -> str:
        parts = [self.arm, self.mind, f"g-{self.growth}", f"r-{int(self.reflection)}"]
        if self.learning:
            parts.append(self.learning)
        return "__".join(parts)
