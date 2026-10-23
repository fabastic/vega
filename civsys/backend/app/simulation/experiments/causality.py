from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any

class CausalRecord(BaseModel):
    event_id: str
    source_event_id: Optional[str] = None
    subject_id: str # Agent ID or World ID
    event_type: str # drought, crop_yield_drop, price_spike, hunger_increase, migration
    previous_state: Dict[str, Any] = Field(default_factory=dict)
    new_state: Dict[str, Any] = Field(default_factory=dict)
    reason: str
    related_event_ids: List[str] = Field(default_factory=list)
    tick: int


from app.simulation.base import BaseSimulationSystem
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from app.simulation.context import SimulationContext

class CausalSystem(BaseSimulationSystem):
    """
    Step 16: Causal Ledger System
    Processes pending causal records generated during the tick and constructs DAG linkages.
    """
    def __init__(self):
        super().__init__(name="CausalSystem", step_number=16)

    def execute(self, context: 'SimulationContext') -> None:
        # Connect pending records to recent parent events if source_event_id is not set
        if context.pending_causal_records:
            drought_events = [e for e in context.state.causal_ledger if e.event_type == "drought_injected"]
            latest_drought_id = drought_events[-1].event_id if drought_events else None
            
            for record in context.pending_causal_records:
                if not record.source_event_id and latest_drought_id:
                    record.source_event_id = latest_drought_id
                    
            # Clear pending records for this tick
            context.pending_causal_records.clear()


