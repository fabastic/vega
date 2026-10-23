from app.simulation.base import BaseSimulationSystem
from app.simulation.context import SimulationContext

class InstitutionSystem(BaseSimulationSystem):
    """
    Step 12: Institution System
    Updates property rights enforcement, workplace rules, and institutional constraints.
    """
    def __init__(self):
        super().__init__(name="InstitutionSystem", step_number=12)

    def execute(self, context: SimulationContext) -> None:
        groups = context.state.groups
        
        # Simple institution: Community taxation and resource redistribution
        # Highly cohesive groups redistribute food to starving members, acting as a social safety net.
        for g in groups.values():
            if g.cohesion > 0.5 and len(g.members) > 2:
                starving = []
                wealthy = []
                for m_id in g.members:
                    agent = context.state.agents.get(m_id)
                    if agent and agent.is_alive:
                        if agent.needs.hunger > 0.6 and agent.economic.food_inventory < 1.0:
                            starving.append(agent)
                        elif agent.economic.food_inventory >= 5.0:
                            wealthy.append(agent)
                            
                # Redistribute from wealthy to starving
                if starving and wealthy:
                    tax = 1.0
                    for w in wealthy:
                        if w.economic.food_inventory >= 5.0 + tax:
                            w.economic.food_inventory -= tax
                            target = context.rng.choice(starving)
                            target.economic.food_inventory += tax
                            
                            # Reputation boost for contributing to the institution
                            w.reputation.contributions += 1
                            w.reputation.trustworthiness = min(1.0, w.reputation.trustworthiness + 0.05)


from app.simulation.base import BaseSimulationSystem
from app.simulation.context import SimulationContext

class CultureBeliefSystem(BaseSimulationSystem):
    """
    Step 12: Culture & Belief System
    Updates regional value baselines and individual belief confidence based on observed prices.
    """
    def __init__(self):
        super().__init__(name="CultureBeliefSystem", step_number=12)

    def execute(self, context: SimulationContext) -> None:
        market_price = context.state.world.market.food_price
        
        for agent in context.state.agents.values():
            if not agent.is_alive:
                continue
                
            # Agent belief about food security
            security_belief = agent.beliefs.get("food_security")
            if not security_belief:
                from app.simulation.humans.agent import BeliefItem
                agent.beliefs["food_security"] = BeliefItem(
                    subject="food_security",
                    value=1.0 if market_price < 15.0 else 0.2,
                    confidence=0.8,
                    updated_tick=context.tick
                )
            else:
                security_belief.value = 1.0 if market_price < 15.0 else 0.2
                security_belief.updated_tick = context.tick

            # Learning Loop: Process recent memories to update beliefs and cognitive properties
            recent_memories = [m for m in agent.memories if m.tick == context.tick - 1]
            for mem in recent_memories:
                if mem.event_type == "work_success":
                    agent.cognition.learning_rate = min(1.0, agent.cognition.learning_rate + 0.05)
                    # Update belief about work effectiveness
                    work_belief = agent.beliefs.get("work_effectiveness")
                    if not work_belief:
                        from app.simulation.humans.agent import BeliefItem
                        agent.beliefs["work_effectiveness"] = BeliefItem(
                            subject="work_effectiveness", value=0.8, confidence=0.5, updated_tick=context.tick
                        )
                    else:
                        work_belief.confidence = min(1.0, work_belief.confidence + 0.1)
                        work_belief.updated_tick = context.tick
                elif mem.event_type == "migration":
                    # Learning from migration experience
                    agent.cognition.problem_solving = min(1.0, agent.cognition.problem_solving + 0.02)


