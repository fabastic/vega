from app.simulation.base import BaseSimulationSystem
from app.simulation.context import SimulationContext

class GroupSystem(BaseSimulationSystem):
    """
    Step 11: Group & Institution System
    Updates community and workplace group clustering.
    """
    def __init__(self):
        super().__init__(name="GroupSystem", step_number=11)

    def execute(self, context: SimulationContext) -> None:
        groups = context.state.groups
        agents = context.state.agents.values()
        
        # 1. Clear members from last tick to rebuild active membership
        for g in groups.values():
            g.members = []
            
        # 2. Re-assign members based on agent's community_id
        for agent in agents:
            if not agent.is_alive:
                continue
                
            cid = agent.social_identity.community_id
            if cid not in groups:
                from app.simulation.state import GroupState
                groups[cid] = GroupState(id=cid, name=f"Community {cid}")
            
            groups[cid].members.append(agent.id)
            
        # 3. Calculate cohesion based on average trust among members
        for g in groups.values():
            if len(g.members) < 2:
                g.cohesion = 0.1
                continue
                
            total_trust = 0.0
            edges = 0
            for m_id in g.members:
                m_agent = context.state.agents.get(m_id)
                if not m_agent: continue
                for target_id, rel in m_agent.relationships.items():
                    if target_id in g.members:
                        total_trust += rel.trust
                        edges += 1
            
            avg_trust = (total_trust / edges) if edges > 0 else 0.5
            # Cohesion moves towards average trust
            g.cohesion = (g.cohesion * 0.8) + (avg_trust * 0.2)
            g.influence = min(1.0, len(g.members) / 100.0)  # Larger groups have more influence


