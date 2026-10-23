from app.simulation.base import BaseSimulationSystem
from app.simulation.context import SimulationContext
from app.simulation.humans.agent import BeliefItem

class LearningSystem(BaseSimulationSystem):
    """
    Step 6: Learning System
    Agents consolidate recent episodic memories to update their semantic beliefs.
    For example, experiencing consistent failure in a specific action will lower
    the belief value (expected success) of that action.
    """
    def __init__(self):
        super().__init__(name="LearningSystem", step_number=6)

    def execute(self, context: SimulationContext) -> None:
        for agent in context.state.agents.values():
            if not agent.is_alive:
                continue
                
            # We look at recently formed memories to update beliefs
            # To avoid iterating over all memories every tick, we could process only
            # memories formed in the last tick.
            recent_memories = [m for m in agent.memories if m.tick == context.tick - 1]
            
            for memory in recent_memories:
                # Update belief about an action based on event type
                # For instance, if event_type is "action_work_failed"
                # belief subject: "work_success"
                
                if memory.event_type.startswith("action_"):
                    action_name = memory.event_type.replace("action_", "").replace("_success", "").replace("_failed", "")
                    belief_subject = f"action_{action_name}_utility"
                    
                    if belief_subject not in agent.beliefs:
                        agent.beliefs[belief_subject] = BeliefItem(subject=belief_subject, value=0.5, confidence=0.1, source="experience", updated_tick=context.tick)
                        
                    belief = agent.beliefs[belief_subject]
                    
                    learning_rate = agent.cognition.learning_rate
                    
                    if memory.event_type.endswith("_success"):
                        # Increase belief value
                        belief.value = min(1.0, belief.value + learning_rate * 0.1)
                        belief.confidence = min(1.0, belief.confidence + learning_rate * 0.05)
                    elif memory.event_type.endswith("_failed"):
                        # Decrease belief value
                        belief.value = max(0.0, belief.value - learning_rate * 0.1)
                        belief.confidence = min(1.0, belief.confidence + learning_rate * 0.05)
                        
                    belief.updated_tick = context.tick
