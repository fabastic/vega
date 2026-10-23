from app.simulation.base import BaseSimulationSystem
from app.simulation.context import SimulationContext

class EmotionSystem(BaseSimulationSystem):
    """
    Step 4: Emotion System
    Exponential decay of dynamic emotion channels toward baseline and reaction to hunger/fear/price spikes.
    """
    def __init__(self):
        super().__init__(name="EmotionSystem", step_number=4)

    def execute(self, context: SimulationContext) -> None:
        for agent in context.state.agents.values():
            if not agent.is_alive:
                continue
                
            emotions = agent.emotions
            # Exponential decay for all emotions
            for emotion_name, emotion_obj in emotions:
                if emotion_obj.intensity > 0:
                    emotion_obj.intensity = max(0.0, emotion_obj.intensity * (1.0 - emotion_obj.decay))
                    if emotion_obj.intensity < 0.01:
                        emotion_obj.intensity = 0.0
                        emotion_obj.source = None
                        emotion_obj.target = None
            
            # Emotional pull from hunger/price pressure
            if agent.needs.hunger > 0.5:
                emotions.anxiety.intensity = min(1.0, emotions.anxiety.intensity + 0.1)
                emotions.happiness.intensity = max(0.0, emotions.happiness.intensity - 0.05)
            if agent.needs.hunger > 0.8:
                emotions.fear.intensity = min(1.0, emotions.fear.intensity + 0.15)


