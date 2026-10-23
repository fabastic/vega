from app.simulation.base import BaseSimulationSystem
from app.simulation.context import SimulationContext
from app.simulation.humans.agent import RelationshipState

class SocialSystem(BaseSimulationSystem):
    """
    Step 10: Social System
    Updates directional relationship graph edge weights (trust, familiarity) and reputation.
    """
    def __init__(self):
        super().__init__(name="SocialSystem", step_number=10)

    def execute(self, context: SimulationContext) -> None:
        agents = context.state.agents
        
        for agent in agents.values():
            if not agent.is_alive:
                continue
                
            # Increase familiarity with visible neighbors
            for neighbor_id in agent.perception.visible_agents:
                rel = agent.relationships.get(neighbor_id)
                if not rel:
                    rel = RelationshipState(target_id=neighbor_id, trust=0.5, familiarity=0.1)
                    agent.relationships[neighbor_id] = rel
                else:
                    rel.familiarity = min(1.0, rel.familiarity + 0.01)


