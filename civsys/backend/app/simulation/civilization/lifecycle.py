from app.simulation.base import BaseSimulationSystem
from app.simulation.context import SimulationContext
from app.simulation.humans.agent import AgentState
from typing import List

class LifecycleSystem(BaseSimulationSystem):
    """
    Step 14.5: Century-Scale Lifecycle System
    Manages aging, starvation deaths, fertility, partner selection, gestation,
    and seeded offspring creation.
    """
    def __init__(self):
        super().__init__(name="LifecycleSystem", step_number=14.5)
        
    def execute(self, context: SimulationContext) -> None:
        agents = list(context.state.agents.values())
        if not agents:
            return
            
        ticks_per_year = 100 # Configurable in real setup
        
        # We need world parameters from registry
        # The mock ontology has mortality_rate
        # For simplicity, we just use a flat starvation + aging threshold
        
        for agent in agents:
            if not agent.is_alive:
                continue
                
            # 1. Starvation / Needs Deaths
            if agent.needs.hunger > 0.95:
                agent.is_alive = False
                agent.social_identity.cause_of_death = "starvation"
                agent.social_identity.death_tick = context.tick
                context.log_causal_event(
                    event_id=f"death_{agent.id}_{context.tick}",
                    event_type="agent_death",
                    subject_id=agent.id,
                    previous_state={"alive": True, "hunger": agent.needs.hunger},
                    new_state={"alive": False},
                    reason="starvation"
                )
                continue
                
            # 2. Aging
            # Age agents by 1 year every ticks_per_year
            if context.tick % ticks_per_year == 0 and context.tick > 0:
                agent.age += 1
                
                # Update life stage
                if agent.age < 18:
                    agent.social_identity.life_stage = "child"
                elif agent.age < 60:
                    agent.social_identity.life_stage = "adult"
                else:
                    agent.social_identity.life_stage = "elder"
                    
                # Natural mortality check
                base_mortality = 0.01 + max(0, (agent.age - 60) * 0.05)
                if context.rng.random() < base_mortality:
                    agent.is_alive = False
                    agent.social_identity.cause_of_death = "old_age"
                    agent.social_identity.death_tick = context.tick
                    continue
                    
        # 3. Reproduction Pipeline
        # Fertility Eligibility -> Partner Selection -> Gestation -> Offspring
        # For simplicity, evaluate every 10 ticks (a "month") to save computation
        if context.tick % 10 == 0:
            fertile_agents = [a for a in agents if a.is_alive and a.social_identity.life_stage == "adult"]
            
            # Very naive partner selection (random pairings within same settlement)
            # In a real model, this uses social networks and attraction
            for agent in fertile_agents:
                # 5% chance per "month" to try reproducing if happy and fed
                if agent.needs.hunger < 0.3 and agent.economic.money > 20.0 and context.rng.random() < 0.05:
                    # Find partner in same settlement
                    potentials = [p for p in fertile_agents if p.id != agent.id and p.social_identity.community_id == agent.social_identity.community_id]
                    if potentials:
                        partner = context.rng.choice(potentials)
                        
                        # Conception success
                        if context.rng.random() < 0.5:
                            # Generate offspring
                            offspring_id = f"agent_gen_{context.tick}_{len(context.state.agents)}"
                            
                            new_agent = AgentState(
                                id=offspring_id,
                                name=f"Child_of_{agent.name}",
                                age=0,
                                home_location=agent.home_location,
                                home_building_id=agent.home_building_id,
                                current_location=agent.current_location,
                                visual_profile=agent.visual_profile, # Could mix parents
                                needs={"hunger": 0.0, "energy": 1.0},
                                personality={
                                    # Blend of parents + mutation
                                    "openness": max(0.0, min(1.0, (agent.personality.openness + partner.personality.openness)/2.0 + context.rng.uniform(-0.1, 0.1))),
                                    "conscientiousness": max(0.0, min(1.0, (agent.personality.conscientiousness + partner.personality.conscientiousness)/2.0 + context.rng.uniform(-0.1, 0.1))),
                                    "extraversion": max(0.0, min(1.0, (agent.personality.extraversion + partner.personality.extraversion)/2.0 + context.rng.uniform(-0.1, 0.1))),
                                    "agreeableness": max(0.0, min(1.0, (agent.personality.agreeableness + partner.personality.agreeableness)/2.0 + context.rng.uniform(-0.1, 0.1))),
                                    "emotional_stability": max(0.0, min(1.0, (agent.personality.emotional_stability + partner.personality.emotional_stability)/2.0 + context.rng.uniform(-0.1, 0.1))),
                                    "risk_tolerance": max(0.0, min(1.0, (agent.personality.risk_tolerance + partner.personality.risk_tolerance)/2.0 + context.rng.uniform(-0.1, 0.1))),
                                    "frugality": max(0.0, min(1.0, (agent.personality.frugality + partner.personality.frugality)/2.0 + context.rng.uniform(-0.1, 0.1)))
                                },
                                economic={"money": 0.0, "food_inventory": 0.0, "occupation": "child"}
                            )
                            
                            new_agent.social_identity.life_stage = "child"
                            new_agent.social_identity.parents = [agent.id, partner.id]
                            new_agent.social_identity.birth_tick = context.tick
                            new_agent.social_identity.community_id = agent.social_identity.community_id
                            
                            context.state.agents[offspring_id] = new_agent
                            
                            context.log_causal_event(
                                event_id=f"birth_{offspring_id}_{context.tick}",
                                event_type="agent_birth",
                                subject_id=offspring_id,
                                previous_state={},
                                new_state={"parents": [agent.id, partner.id]},
                                reason="reproduction_pipeline"
                            )
