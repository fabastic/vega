import math
from app.simulation.base import BaseSimulationSystem
from app.simulation.context import SimulationContext

class PopulationSystem(BaseSimulationSystem):
    """
    Step 14: Population & Migration System
    Evaluates health depletion for death, and executes spatial migration relocations.
    """
    def __init__(self):
        super().__init__(name="PopulationSystem", step_number=14)

    def execute(self, context: SimulationContext) -> None:
        for agent in context.state.agents.values():
            if not agent.is_alive:
                continue
                
            # Starvation / Deceased check
            if agent.needs.health <= 0.0:
                agent.is_alive = False
                context.log_causal_event(
                    event_id=f"evt_death_{agent.id}_{context.tick}",
                    event_type="agent_death",
                    subject_id=agent.id,
                    previous_state={"is_alive": True},
                    new_state={"is_alive": False},
                    reason="starvation_health_depletion"
                )
                continue
                
            # Execute Spatial Migration if action == "migrate"
            if agent.current_action == "migrate":
                prev_loc = agent.current_location
                
                # Pick target: if they know of buildings, move towards a farm/market. Otherwise random.
                if not agent.target_location:
                    # Deduct moving cost (money/energy) when starting migration
                    if agent.economic.money > 5.0:
                        agent.economic.money -= 5.0
                    agent.needs.energy = max(0.0, agent.needs.energy - 0.2)
                    
                    target_b = next((b for b in agent.information.known_buildings.values() if b.get("building_type") in ["farm", "market"]), None)
                    if target_b:
                        agent.target_location = (target_b.get("x", 28.0), target_b.get("y", 28.0))
                    else:
                        agent.target_location = (context.rng.uniform(0, context.state.world.width-1), context.rng.uniform(0, context.state.world.height-1))
                
                target_loc = agent.target_location
                
                dx = target_loc[0] - prev_loc[0]
                dy = target_loc[1] - prev_loc[1]
                dist = math.sqrt(dx**2 + dy**2)
                
                if dist > 1.0:
                    speed = 2.0
                    new_x = prev_loc[0] + (dx / dist) * speed
                    new_y = prev_loc[1] + (dy / dist) * speed
                    agent.current_location = (round(new_x, 1), round(new_y, 1))
                    agent.is_migrating = True
                else:
                    agent.current_location = target_loc
                    agent.is_migrating = False
                    agent.target_location = None
                    agent.home_location = target_loc
                    
                    context.log_causal_event(
                        event_id=f"evt_migrated_{agent.id}_{context.tick}",
                        event_type="agent_migrated",
                        subject_id=agent.id,
                        previous_state={"location": prev_loc},
                        new_state={"location": agent.current_location},
                        reason="seeking_better_opportunities"
                    )


