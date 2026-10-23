from app.simulation.base import BaseSimulationSystem
from app.simulation.context import SimulationContext

class NeedsSystem(BaseSimulationSystem):
    """
    Step 3: Needs System
    Calculates biological decay (hunger increases per tick, energy decreases if active) and need pressures.
    """
    def __init__(self):
        super().__init__(name="NeedsSystem", step_number=3)

    def execute(self, context: SimulationContext) -> None:
        for agent in context.state.agents.values():
            if not agent.is_alive:
                continue
                
            # Hunger increases naturally by 0.008 per tick
            # At this rate agents can go ~125 ticks without eating (vs 50 before)
            # This allows for more complex decision-making with a 1000-agent civilization
            prev_hunger = agent.needs.hunger
            agent.needs.hunger = min(1.0, agent.needs.hunger + 0.008)
            
            # Thirst increases by 0.015
            agent.needs.thirst = min(1.0, agent.needs.thirst + 0.015)
            
            # Sleep need increases by 0.02
            agent.needs.sleep_need = min(1.0, agent.needs.sleep_need + 0.02)

            # Energy depletion based on current action
            if agent.current_action == "rest" or agent.current_action == "sleep":
                agent.needs.energy = min(1.0, agent.needs.energy + 0.1)
                agent.needs.sleep_need = max(0.0, agent.needs.sleep_need - 0.2)
            else:
                agent.needs.energy = max(0.0, agent.needs.energy - 0.015)
                
            # Health depletion if starving (hunger > 0.85) or dying of thirst (thirst > 0.92)
            # Slower depletion rate (0.02 instead of 0.05) gives agents more time to react
            if agent.needs.hunger > 0.85 or agent.needs.thirst > 0.92:
                agent.needs.health = max(0.0, agent.needs.health - 0.02)
                # Log hunger increase causal record if reaching high stress
                if prev_hunger <= 0.8:
                    context.log_causal_event(
                        event_id=f"evt_hunger_{agent.id}_{context.tick}",
                        event_type="health_depletion",
                        subject_id=agent.id,
                        previous_state={"hunger": prev_hunger},
                        new_state={"hunger": agent.needs.hunger},
                        reason="food_scarcity_or_depletion"
                    )


