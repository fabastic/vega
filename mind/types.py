"""Types shared by both minds and both worlds (SPEC §D.1-D.3)."""
from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Dict, Optional, Tuple


class ActionKind(str, Enum):
    MOVE = "move"
    TURN = "turn"
    REST = "rest"
    EAT = "eat"
    EXPLORE = "explore"
    RUMINATE = "ruminate"
    SEEK_COMPANY = "seek_company"
    TALK = "talk"
    WORK = "work"
    IDLE = "idle"


ACTION_KINDS: Tuple[ActionKind, ...] = tuple(ActionKind)
ACTION_ONEHOT = 12  # 10 kinds + 2 reserved (SPEC §D.3)


class CapacityKind(str, Enum):
    # v1 (rule-based)
    MEMORY_SLOTS = "memory_slots"
    EXPECTATION_DIMS = "expectation_dims"
    SELF_MODEL_NODES = "self_model_nodes"
    REFLECTION_WORKING_SET = "reflection_working_set"
    # v2 (learned)
    WIDEN_HIDDEN = "widen_hidden"
    ENLARGE_LATENT = "enlarge_latent"
    ADD_EXPERT = "add_expert"
    DEEPEN = "deepen"


class ReasonCode(str, Enum):
    PREDICTION_ERROR = "PREDICTION_ERROR"
    BOREDOM = "BOREDOM"
    REFLECTIVE_BACKLOG = "REFLECTIVE_BACKLOG"


class QueryType(str, Enum):
    EXISTENTIAL = "existential"
    EPISTEMIC = "epistemic"
    TEMPORAL = "temporal"
    SELF_IDENTITY = "self_identity"
    MEANING = "meaning"


@dataclass(frozen=True)
class VisualSample:
    bearing: float          # radians, egocentric, 0 = straight ahead, counter-clockwise
    distance: float         # cells
    category: str           # "wall" | "terrain:<t>" | "object:<k>" | "building:<t>" | "agent"
    ref: Optional[str] = None


@dataclass(frozen=True)
class SoundSample:
    level: float = 0.0
    sources: Tuple[Tuple[float, float], ...] = ()   # (bearing, level)


@dataclass(frozen=True)
class TouchSample:
    front: float = 0.0
    back: float = 0.0
    left: float = 0.0
    right: float = 0.0
    pressure: float = 0.0


@dataclass(frozen=True)
class Proprio:
    heading: float = 0.0
    posture: str = "stand"
    last_motor: Optional[str] = None
    effort: float = 0.0


@dataclass(frozen=True)
class Observation:
    vision: Tuple[VisualSample, ...] = ()
    sound: SoundSample = SoundSample()
    touch: TouchSample = TouchSample()
    proprio: Proprio = Proprio()
    # Deviation from SPEC §D.2 (logged in DECISIONS_OVERNIGHT.md): social contact
    # content (gain, loss) received this tick. Always (0, 0) in the white room.
    social: Tuple[float, float] = (0.0, 0.0)

    def refs(self) -> frozenset:
        return frozenset(v.ref for v in self.vision if v.ref)


@dataclass(frozen=True)
class Interoception:
    hunger: float = 0.0
    thirst: float = 0.0
    fatigue: float = 0.0
    sleep_pressure: float = 0.0
    health_deficit: float = 0.0
    pain: float = 0.0

    def as_tuple(self):
        return (self.hunger, self.thirst, self.fatigue, self.sleep_pressure, self.health_deficit, self.pain)


@dataclass(frozen=True)
class Action:
    kind: ActionKind
    target_ref: Optional[str] = None
    params: Dict[str, object] = field(default_factory=dict)


@dataclass
class Telemetry:
    """Numbers only (SPEC §I.3). Read by the growth harness, never by the world."""
    prediction_error: float = 0.0     # v1 PE in [0,1]; v2 world-model NLL ratio to life baseline
    boredom: float = 0.0
    novelty: float = 0.0
    working_set_full: bool = False
    abandoned_for_capacity: int = 0   # this tick
    capacity: Dict[str, float] = field(default_factory=dict)
