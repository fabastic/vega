from app.simulation.base import BaseSimulationSystem
from app.simulation.context import SimulationContext

class InteractionSystem(BaseSimulationSystem):
    """
    Step 8: Interaction System
    Executes agent-to-agent exchanges (trade_buy, cooperate_share).
    """
    def __init__(self):
        super().__init__(name="InteractionSystem", step_number=8)

    def execute(self, context: SimulationContext) -> None:
        market = context.state.world.market
        
        for agent in context.state.agents.values():
            if not agent.is_alive:
                continue
                
            if agent.movement_state == "traveling":
                continue
                
            # Utility function to clear intention
            def reset_intent():
                agent.movement_state = "idle"
                agent.action_intent = None
                agent.target_location = None
                agent.target_entity_id = None
                agent.target_type = None

            if agent.current_action == "trade_buy":
                # Buy 1 unit of food from market clearing
                price = market.food_price
                if agent.economic.money >= price and market.food_supply >= 1.0:
                    agent.economic.money -= price
                    agent.economic.food_inventory += 1.0
                    market.food_supply -= 1.0
                    market.food_demand += 1.0
                    
            elif agent.current_action == "trade_sell":
                # Sell excess inventory (food, wood, stone, metal, tools) to market
                price = market.food_price
                if agent.economic.food_inventory >= 5.0:
                    agent.economic.food_inventory -= 1.0
                    agent.economic.money += price
                    market.food_supply += 1.0
                    
                wood_price = market.wood_price
                if agent.economic.wood_inventory >= 2.0:
                    agent.economic.wood_inventory -= 1.0
                    agent.economic.money += wood_price
                    market.wood_supply += 1.0
                    
                stone_price = market.stone_price
                if agent.economic.stone_inventory >= 2.0:
                    agent.economic.stone_inventory -= 1.0
                    agent.economic.money += stone_price
                    market.stone_supply += 1.0
                    
                tool_price = market.tools_price
                if agent.economic.tools_inventory >= 1.0:
                    agent.economic.tools_inventory -= 1.0
                    agent.economic.money += tool_price
                    market.tools_supply += 1.0
            
            elif agent.current_action == "cooperate_share":
                # Share food with visible neighbor in need if inventory permits
                if agent.economic.food_inventory >= 2.0 and agent.perception.visible_agents:
                    target_id = agent.perception.visible_agents[0]
                    target = context.state.agents.get(target_id)
                    if target and target.is_alive and target.needs.hunger > 0.5:
                        agent.economic.food_inventory -= 1.0
                        target.economic.food_inventory += 1.0
                        target.needs.hunger = max(0.0, target.needs.hunger - 0.3)
                        
                        # Initialize relationship if missing
                        if target_id not in agent.relationships:
                            from app.simulation.humans.agent import RelationshipState
                            agent.relationships[target_id] = RelationshipState(target_id=target_id)
                        if agent.id not in target.relationships:
                            from app.simulation.humans.agent import RelationshipState
                            target.relationships[agent.id] = RelationshipState(target_id=agent.id)
                            
                        # Strengthen trust and affection
                        agent.relationships[target_id].trust = min(1.0, agent.relationships[target_id].trust + 0.1)
                        agent.relationships[target_id].affection = min(1.0, agent.relationships[target_id].affection + 0.05)
                        agent.relationships[target_id].familiarity = min(1.0, agent.relationships[target_id].familiarity + 0.05)
                        
                        target.relationships[agent.id].trust = min(1.0, target.relationships[agent.id].trust + 0.15)
                        target.relationships[agent.id].affection = min(1.0, target.relationships[agent.id].affection + 0.1)
                        target.relationships[agent.id].familiarity = min(1.0, target.relationships[agent.id].familiarity + 0.05)
                        
                        # Reputation signal for cooperation
                        agent.reputation.contributions += 1
                        agent.reputation.trustworthiness = min(1.0, agent.reputation.trustworthiness + 0.01)

            elif agent.current_action == "talk":
                if agent.perception.visible_agents:
                    # Pick a random visible agent to talk to
                    target_id = context.rng.choice(agent.perception.visible_agents)
                    target = context.state.agents.get(target_id)
                    if target and target.is_alive:
                        if target_id not in agent.relationships:
                            from app.simulation.humans.agent import RelationshipState
                            agent.relationships[target_id] = RelationshipState(target_id=target_id)
                        if agent.id not in target.relationships:
                            from app.simulation.humans.agent import RelationshipState
                            target.relationships[agent.id] = RelationshipState(target_id=agent.id)
                            
                        agent.relationships[target_id].familiarity = min(1.0, agent.relationships[target_id].familiarity + 0.1)
                        target.relationships[agent.id].familiarity = min(1.0, target.relationships[agent.id].familiarity + 0.1)
                        
                        # Information Transmission (Memories)
                        if agent.memories:
                            mem_to_share = max(agent.memories, key=lambda m: m.importance, default=None)
                            if mem_to_share and not any(m.id == mem_to_share.id for m in target.memories):
                                import copy
                                shared_mem = copy.deepcopy(mem_to_share)
                                shared_mem.source = f"social_{agent.id}"
                                shared_mem.confidence *= 0.8
                                target.memories.append(shared_mem)
                                
                        # Information Transmission (Beliefs)
                        if agent.beliefs:
                            belief_key = context.rng.choice(list(agent.beliefs.keys()))
                            belief_to_share = agent.beliefs[belief_key]
                            
                            if belief_key not in target.beliefs:
                                import copy
                                shared_belief = copy.deepcopy(belief_to_share)
                                shared_belief.source = f"social_{agent.id}"
                                shared_belief.confidence *= 0.8
                                target.beliefs[belief_key] = shared_belief
                            else:
                                target_belief = target.beliefs[belief_key]
                                blend_factor = 0.2 * agent.relationships[target_id].trust
                                target_belief.value = target_belief.value * (1 - blend_factor) + belief_to_share.value * blend_factor
                                target_belief.confidence = min(1.0, target_belief.confidence + 0.05)

            elif agent.current_action == "compete":
                if agent.perception.visible_agents:
                    target_id = context.rng.choice(agent.perception.visible_agents)
                    target = context.state.agents.get(target_id)
                    if target and target.is_alive:
                        if target_id not in agent.relationships:
                            from app.simulation.humans.agent import RelationshipState
                            agent.relationships[target_id] = RelationshipState(target_id=target_id)
                        if agent.id not in target.relationships:
                            from app.simulation.humans.agent import RelationshipState
                            target.relationships[agent.id] = RelationshipState(target_id=agent.id)
                            
                        agent.relationships[target_id].conflict = min(1.0, agent.relationships[target_id].conflict + 0.2)
                        agent.relationships[target_id].trust = max(0.0, agent.relationships[target_id].trust - 0.1)
                        
                        target.relationships[agent.id].conflict = min(1.0, target.relationships[agent.id].conflict + 0.2)
                        target.relationships[agent.id].trust = max(0.0, target.relationships[agent.id].trust - 0.1)
                        
            # Interaction processed, agent is now idle
            if agent.current_action in ["trade_buy", "trade_sell", "cooperate_share", "talk", "compete"]:
                reset_intent()


