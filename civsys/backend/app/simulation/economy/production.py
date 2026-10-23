from app.simulation.base import BaseSimulationSystem
from app.simulation.context import SimulationContext

class ActionSystem(BaseSimulationSystem):
    """
    Step 7: Action System
    Executes chosen primary physical actions (eat, work, rest, move towards workplace/farm).
    """
    def __init__(self):
        super().__init__(name="ActionSystem", step_number=7)

    def execute(self, context: SimulationContext) -> None:
        for agent in context.state.agents.values():
            if not agent.is_alive:
                continue
                
            # Only execute if the agent has arrived at their target destination
            if agent.movement_state == "traveling":
                continue
                
            act = agent.current_action
            
            # Reset intent after execution attempt
            def reset_intent():
                agent.movement_state = "idle"
                agent.action_intent = None
                agent.target_location = None
                agent.target_entity_id = None
                agent.target_type = None
            
            if act == "eat":
                from app.simulation.humans.agent import MemoryRecord, MemoryType
                if agent.economic.food_inventory >= 1.0:
                    agent.economic.food_inventory -= 1.0
                    agent.needs.hunger = max(0.0, agent.needs.hunger - 0.4)
                    agent.needs.thirst = max(0.0, agent.needs.thirst - 0.4)
                    agent.needs.health = min(1.0, agent.needs.health + 0.02)
                    agent.emotions.happiness.intensity = min(1.0, agent.emotions.happiness.intensity + 0.05)
                    agent.memories.append(MemoryRecord(
                        id=f"mem_eat_{agent.id}_{context.tick}",
                        tick=context.tick,
                        memory_type=MemoryType.EPISODIC,
                        event_type="action_eat_success",
                        description="Ate food successfully.",
                        emotional_weight=0.2,
                        importance=0.4
                    ))
                else:
                    agent.emotions.frustration.intensity = min(1.0, agent.emotions.frustration.intensity + 0.1)
                    agent.memories.append(MemoryRecord(
                        id=f"mem_eat_fail_{agent.id}_{context.tick}",
                        tick=context.tick,
                        memory_type=MemoryType.EPISODIC,
                        event_type="action_eat_failed",
                        description="Failed to eat: no food.",
                        emotional_weight=-0.3,
                        importance=0.5
                    ))
                    
            elif act == "work":
                agent.needs.energy = max(0.0, agent.needs.energy - 0.08)
                
                # Get current cell
                cx, cy = int(agent.current_location[0]), int(agent.current_location[1])
                # Ensure within bounds
                world_w = context.state.world.width
                world_h = context.state.world.height
                if 0 <= cx < world_w and 0 <= cy < world_h:
                    idx = cy * world_w + cx
                    cell = context.state.world.cells[idx] if idx < len(context.state.world.cells) else None
                else:
                    cell = None

                region = context.state.world.get_region(agent.current_location)
                region_crop_mult = region.crop_yield_multiplier if region else 1.0
                region_infra_mult = region.infrastructure_multiplier if region else 1.0

                occ = agent.economic.occupation
                success = False
                desc = "Worked."
                
                # Check for work_mechanized
                is_mechanized = getattr(agent, "action_intent", "work") == "work_mechanized"
                tech_mult = 3.5 if is_mechanized else 1.0
                
                if cell:
                    # Apply skill, base capability, environment, and world events
                    if occ == "farmer" and cell.terrain_type in ["farm", "grass"]:
                        yield_amt = 2.0 * agent.skills.farming * cell.fertility * region_crop_mult * tech_mult * region_infra_mult
                        if cell.food_resources >= yield_amt:
                            cell.food_resources -= yield_amt
                            agent.economic.food_inventory += yield_amt
                            success = True
                            desc = f"Farmed {yield_amt:.1f} food (Mech: {is_mechanized})."
                            agent.skills.farming = min(1.0, agent.skills.farming + 0.005)
                            
                    elif occ == "woodcutter" and cell.terrain_type == "forest":
                        yield_amt = 1.5 * agent.skills.woodcutting * tech_mult * region_infra_mult
                        if cell.wood_resources >= yield_amt:
                            cell.wood_resources -= yield_amt
                            agent.economic.wood_inventory += yield_amt
                            success = True
                            desc = f"Cut {yield_amt:.1f} wood (Mech: {is_mechanized})."
                            agent.skills.woodcutting = min(1.0, agent.skills.woodcutting + 0.005)
                            
                    elif occ == "miner" and cell.terrain_type == "rock":
                        stone_yield = 1.5 * agent.skills.mining * tech_mult * region_infra_mult
                        metal_yield = 0.5 * agent.skills.mining * tech_mult * region_infra_mult if cell.metal_resources > 0 else 0.0
                        
                        # Extract from discovered resource deposits in this region
                        if region:
                            for deposit in context.state.world.resource_deposits:
                                if deposit.region_id == region.id and deposit.discovered and deposit.amount > 0:
                                    bonus_yield = min(deposit.amount, 2.0 * agent.skills.mining * tech_mult * region_infra_mult)
                                    deposit.amount -= bonus_yield
                                    if deposit.resource_type == "metal":
                                        metal_yield += bonus_yield
                                    elif deposit.resource_type == "stone":
                                        stone_yield += bonus_yield
                        
                        if cell.stone_resources >= stone_yield:
                            cell.stone_resources -= stone_yield
                            agent.economic.stone_inventory += stone_yield
                            success = True
                            
                        if metal_yield > 0:
                            if cell.metal_resources >= metal_yield:
                                cell.metal_resources -= metal_yield
                            agent.economic.metal_inventory += metal_yield
                            success = True
                            
                        if success:
                            desc = f"Mined {stone_yield:.1f} stone, {metal_yield:.1f} metal (Mech: {is_mechanized})."
                            agent.skills.mining = min(1.0, agent.skills.mining + 0.005)
                            
                    elif occ == "crafter":
                        # Basic crafting: turns wood/stone into tools or higher value goods
                        req_amt = 0.5 if is_mechanized else 1.0
                        tool_yield = 4.0 if is_mechanized else 1.0
                        
                        if agent.economic.wood_inventory >= req_amt and agent.economic.stone_inventory >= req_amt:
                            agent.economic.wood_inventory -= req_amt
                            agent.economic.stone_inventory -= req_amt
                            agent.economic.tools_inventory += tool_yield * region_infra_mult
                            success = True
                            desc = f"Crafted {tool_yield:.1f} tools (Mech: {is_mechanized})."
                            agent.skills.crafting = min(1.0, agent.skills.crafting + 0.005)
                            
                if not success:
                    # Subsistence gathering fallback
                    fallback = 1.2 * region_crop_mult * region_infra_mult
                    agent.economic.food_inventory += fallback
                    desc = f"Gathered {fallback:.1f} food (fallback)."
                    success = True
                        
                if success:
                    from app.simulation.humans.agent import MemoryRecord, MemoryType
                    agent.memories.append(MemoryRecord(
                        id=f"mem_work_{agent.id}_{context.tick}",
                        tick=context.tick,
                        memory_type=MemoryType.EPISODIC,
                        event_type="action_work_success",
                        description=desc,
                        emotional_weight=0.1,
                        importance=0.3
                    ))
                else:
                    agent.emotions.frustration.intensity = min(1.0, agent.emotions.frustration.intensity + 0.05)
                    from app.simulation.humans.agent import MemoryRecord, MemoryType
                    agent.memories.append(MemoryRecord(
                        id=f"mem_work_fail_{agent.id}_{context.tick}",
                        tick=context.tick,
                        memory_type=MemoryType.EPISODIC,
                        event_type="action_work_failed",
                        description="Failed to work.",
                        emotional_weight=-0.1,
                        importance=0.3
                    ))
                
            elif act == "rest" or act == "sleep":
                agent.needs.energy = min(1.0, agent.needs.energy + 0.15)
                agent.needs.sleep_need = max(0.0, agent.needs.sleep_need - 0.3)
                from app.simulation.humans.agent import MemoryRecord, MemoryType
                agent.memories.append(MemoryRecord(
                    id=f"mem_{act}_{agent.id}_{context.tick}",
                    tick=context.tick,
                    memory_type=MemoryType.EPISODIC,
                    event_type=f"action_{act}_success",
                    description=f"Successfully rested.",
                    emotional_weight=0.1,
                    importance=0.2
                ))
                
            elif act == "learn":
                agent.cognition.learning_rate = min(1.0, agent.cognition.learning_rate + 0.01)
                agent.needs.energy = max(0.0, agent.needs.energy - 0.05)
                from app.simulation.humans.agent import MemoryRecord, MemoryType
                agent.memories.append(MemoryRecord(
                    id=f"mem_learn_{agent.id}_{context.tick}",
                    tick=context.tick,
                    memory_type=MemoryType.EPISODIC,
                    event_type="action_learn_success",
                    description="Successfully learned.",
                    emotional_weight=0.05,
                    importance=0.2
                ))
                
            elif act == "explore":
                agent.needs.energy = max(0.0, agent.needs.energy - 0.08)
                agent.emotions.curiosity.intensity = min(1.0, agent.emotions.curiosity.intensity + 0.1)
                from app.simulation.humans.agent import MemoryRecord, MemoryType
                agent.memories.append(MemoryRecord(
                    id=f"mem_explore_{agent.id}_{context.tick}",
                    tick=context.tick,
                    memory_type=MemoryType.EPISODIC,
                    event_type="action_explore_success",
                    description="Explored surroundings.",
                    emotional_weight=0.2,
                    importance=0.3
                ))
                
            elif act == "migrate":
                # Movement logic handled in Population/Migration system, but we log memory here
                from app.simulation.humans.agent import MemoryRecord, MemoryType
                agent.memories.append(MemoryRecord(
                    id=f"mem_mig_{agent.id}_{context.tick}",
                    tick=context.tick,
                    memory_type=MemoryType.EPISODIC,
                    event_type="action_migrate_success",
                    description="Decided to migrate to a new region.",
                    emotional_weight=0.5,
                    importance=0.8
                ))
            
            # Action has been executed, reset intent
            reset_intent()


