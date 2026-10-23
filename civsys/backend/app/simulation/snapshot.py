from app.simulation.base import BaseSimulationSystem
from app.simulation.context import SimulationContext

class SnapshotSystem(BaseSimulationSystem):
    """
    Step 17: Snapshot / Stream System
    Prepares tick state summary for WebSocket broadcast and PostgreSQL snapshot persistence boundary.
    """
    def __init__(self):
        super().__init__(name="SnapshotSystem", step_number=17)

    def execute(self, context: SimulationContext) -> None:
        # Increment simulation clock
        context.state.tick += 1
        
        # Periodic DB snapshot boundary check (e.g. every 24 ticks / 1 day)
        if context.state.tick % 24 == 0:
            context.transient_data["needs_db_snapshot"] = True


