from app.simulation.base import BaseSimulationSystem
from app.simulation.context import SimulationContext

class TechnologySystem(BaseSimulationSystem):
    """
    Step 9.5: Technology System
    Organic discovery of capabilities based on cumulative knowledge.
    """
    def __init__(self):
        super().__init__(name="TechnologySystem", step_number=9.5)
        
    def execute(self, context: SimulationContext) -> None:
        world = context.state.world
        agents = context.state.agents.values()
        
        # Total global knowledge accumulates over time from learning agents
        total_learning = sum(a.cognition.learning_rate for a in agents if a.is_alive)
        
        # Accumulate tech progress in a new state variable or just use global metric
        if not hasattr(world, "tech_progress"):
            world.tech_progress = 0.0
            
        world.tech_progress += total_learning * 0.1
        
        # Threshold for organic electricity discovery
        if world.tech_progress > 1000.0 and "electricity" not in world.active_capabilities:
            world.active_capabilities.append("electricity")
            context.log_causal_event(
                event_id=f"evt_tech_discovery_elec_{context.tick}",
                event_type="tech_discovery",
                subject_id="world",
                previous_state={"capabilities": []},
                new_state={"capabilities": ["electricity"]},
                reason="accumulated_knowledge_threshold_reached"
            )
