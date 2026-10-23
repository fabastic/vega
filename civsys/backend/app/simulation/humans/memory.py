from app.simulation.base import BaseSimulationSystem
from app.simulation.context import SimulationContext

class MemorySystem(BaseSimulationSystem):
    """
    Step 5: Memory System
    Applies decay to episodic and semantic memories. Memories with high emotional weight 
    or importance decay slower. Memories that drop below a confidence threshold are forgotten.
    """
    def __init__(self):
        super().__init__(name="MemorySystem", step_number=5)

    def execute(self, context: SimulationContext) -> None:
        for agent in context.state.agents.values():
            if not agent.is_alive:
                continue
                
            retained_memories = []
            for memory in agent.memories:
                # Calculate decay modifier based on emotional weight and importance
                # High emotion or high importance reduces the decay rate.
                retention_factor = max(0.1, (abs(memory.emotional_weight) + memory.importance) / 2.0)
                actual_decay = memory.decay * (1.0 - retention_factor)
                
                # Apply decay to confidence
                memory.confidence = max(0.0, memory.confidence - actual_decay)
                
                # If confidence is above 0.1, keep the memory
                if memory.confidence > 0.1:
                    retained_memories.append(memory)
                    
            agent.memories = retained_memories
