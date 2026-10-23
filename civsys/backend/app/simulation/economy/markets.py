from app.simulation.base import BaseSimulationSystem
from app.simulation.context import SimulationContext

class EconomySystem(BaseSimulationSystem):
    """
    Step 9: Economy System
    Calculates total crop production output from land fertility & labor,
    and updates market price index using Exponential Moving Average (EMA) price clearing.
    """
    def __init__(self):
        super().__init__(name="EconomySystem", step_number=9)

    def execute(self, context: SimulationContext) -> None:
        world = context.state.world
        market = world.market
        agents = context.state.agents.values()
        
        # Calculate total production output this tick by checking inventories delta or just estimating
        # Actually, since agents updated their inventories in ActionSystem, the market supply can be based on 
        # what agents have and are willing to sell. For simplicity, let's say a fraction of agent inventory 
        # is added to market supply, and agents consume market supply.
        # Alternatively, we just use the original EMA logic for all goods based on agent needs.
        
        total_pop = sum(1 for a in agents if a.is_alive)
        if total_pop == 0:
            return
            
        # Tally inventories across all agents to represent 'supply' (or available supply)
        total_wood = sum(a.economic.wood_inventory for a in agents if a.is_alive)
        total_stone = sum(a.economic.stone_inventory for a in agents if a.is_alive)
        total_metal = sum(a.economic.metal_inventory for a in agents if a.is_alive)
        total_tools = sum(a.economic.tools_inventory for a in agents if a.is_alive)
        
        # Calculate food production directly from working farmers to decouple market supply from hoarded inventory
        working_farmers = sum(1 for a in agents if a.is_alive and a.current_action == "work" and a.economic.occupation == "farmer")
        food_production = working_farmers * 0.5 * world.crop_yield_multiplier
        
        # Market available supply updates
        market.food_supply = max(5.0, (market.food_supply * 0.9) + food_production)
        market.wood_supply = max(5.0, (market.wood_supply * 0.8) + (total_wood * 0.2))
        market.stone_supply = max(5.0, (market.stone_supply * 0.8) + (total_stone * 0.2))
        market.metal_supply = max(1.0, (market.metal_supply * 0.8) + (total_metal * 0.2))
        market.tools_supply = max(1.0, (market.tools_supply * 0.8) + (total_tools * 0.2))
        
        # Calculate demand
        hungry_count = sum(1 for a in agents if a.is_alive and a.needs.hunger > 0.3)
        market.food_demand = (total_pop * 0.5) + (hungry_count * 1.5)
        
        # Wood/Stone/Metal demand is driven by crafters or agents wanting tools/houses
        market.wood_demand = total_pop * 0.2
        market.stone_demand = total_pop * 0.1
        market.metal_demand = total_pop * 0.05
        market.tools_demand = total_pop * 0.3
        
        # EMA Price Clearing Formula: Price_{t+1} = Price_t * (1 + gamma * (Demand - Supply) / Supply)
        gamma = 0.15
        
        resources = ["food", "wood", "stone", "metal", "tools"]
        for res in resources:
            prev_price = getattr(market, f"{res}_price")
            supply = getattr(market, f"{res}_supply")
            demand = getattr(market, f"{res}_demand")
            
            demand_supply_ratio = (demand - supply) / max(1.0, supply)
            new_price = max(1.0, prev_price * (1.0 + gamma * demand_supply_ratio))
            setattr(market, f"{res}_price", round(new_price, 2))
            
            # Log price spike causal event if price increased significantly
            if new_price >= prev_price * 1.2:
                context.log_causal_event(
                    event_id=f"evt_price_spike_{res}_{context.tick}",
                    event_type="price_spike",
                    subject_id=f"market_{res}",
                    previous_state={f"{res}_price": prev_price},
                    new_state={f"{res}_price": new_price},
                    reason=f"{res}_scarcity_demand_supply_imbalance"
                )


