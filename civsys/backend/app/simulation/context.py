import random
import numpy as np
from typing import Dict, List, Any, Optional, TYPE_CHECKING
from pydantic import BaseModel, Field
from app.simulation.experiments.causality import CausalRecord
from app.simulation.action import Action

if TYPE_CHECKING:
    from app.simulation.state import SimulationState

class SimulationContext:
    """
    Explicit simulation context/state-access boundary.
    Systems communicate through explicit state/contracts in context rather than direct cross-system mutation.
    """
    def __init__(self, state: SimulationState, rng: random.Random, np_rng: np.random.Generator, config: Dict[str, Any] = None):
        self.state: SimulationState = state
        self.rng: random.Random = rng
        self.np_rng: np.random.Generator = np_rng
        self.config: Dict[str, Any] = config or {}
        
        # Transient outputs generated during the tick pipeline steps
        self.pending_actions: List[Action] = []
        self.pending_causal_records: List[CausalRecord] = []
        self.transient_data: Dict[str, Any] = {}

    @property
    def tick(self) -> int:
        return self.state.tick

    def log_causal_event(self, event_id: str, event_type: str, subject_id: str, 
                         previous_state: Dict[str, Any], new_state: Dict[str, Any], 
                         reason: str, source_event_id: Optional[str] = None, 
                         related_event_ids: List[str] = None):
        record = CausalRecord(
            event_id=event_id,
            source_event_id=source_event_id,
            subject_id=subject_id,
            event_type=event_type,
            previous_state=previous_state,
            new_state=new_state,
            reason=reason,
            related_event_ids=related_event_ids or [],
            tick=self.tick
        )
        self.pending_causal_records.append(record)
        self.state.causal_ledger.append(record)
