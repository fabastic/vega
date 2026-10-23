import math
from app.simulation.base import BaseSimulationSystem
from app.simulation.context import SimulationContext

class PerceptionSystem(BaseSimulationSystem):
    """
    Step 2: Perception System
    Strictly Bounded Perception: Agents query local spatial neighborhood & perceived market prices.
    Agents MUST NOT inspect global hidden state directly.
    """
    def __init__(self):
        super().__init__(name="PerceptionSystem", step_number=2)

    def execute(self, context: SimulationContext) -> None:
        world = context.state.world
        agents = context.state.agents
        width = world.width
        height = world.height
        
        # Build spatial grid for agents (cell_size = 10 for radius 5.0)
        agent_grid = {}
        for aid, a in agents.items():
            if a.is_alive:
                cx, cy = int(a.current_location[0] // 10), int(a.current_location[1] // 10)
                if (cx, cy) not in agent_grid:
                    agent_grid[(cx, cy)] = []
                agent_grid[(cx, cy)].append((aid, a.current_location[0], a.current_location[1]))
                
        # Build spatial grid for buildings
        building_grid = {}
        for b in world.buildings:
            cx, cy = int(b.x // 10), int(b.y // 10)
            if (cx, cy) not in building_grid:
                building_grid[(cx, cy)] = []
            building_grid[(cx, cy)].append(b)
                
        for agent in agents.values():
            if not agent.is_alive:
                continue
                
            ax, ay = agent.current_location
            iax, iay = int(ax), int(ay)
            
            # Perceived market food price
            agent.perception.perceived_food_price = world.market.food_price
            
            # Fast O(1) cell lookup for radius R=5
            visible_cells = []
            total_visible_food = 0.0
            for dx in range(-5, 6):
                for dy in range(-5, 6):
                    if dx*dx + dy*dy <= 25.0:
                        cx, cy = iax + dx, iay + dy
                        if 0 <= cx < width and 0 <= cy < height:
                            cell = world.cells[cy * width + cx]
                            visible_cells.append((cx, cy))
                            total_visible_food += cell.food_resources
                            
            agent.perception.visible_cells = visible_cells
            agent.perception.perceived_food_abundance = total_visible_food / max(1, len(visible_cells))
            
            # Fast agent lookup using buckets
            visible_agents = []
            gx, gy = int(ax // 10), int(ay // 10)
            for dx in [-1, 0, 1]:
                for dy in [-1, 0, 1]:
                    bucket = agent_grid.get((gx + dx, gy + dy))
                    if bucket:
                        for other_id, ox, oy in bucket:
                            if other_id != agent.id:
                                if (ox - ax)**2 + (oy - ay)**2 <= 25.0:
                                    visible_agents.append(other_id)
            agent.perception.visible_agents = visible_agents
            
            # Fast building lookup
            for dx in [-1, 0, 1]:
                for dy in [-1, 0, 1]:
                    b_bucket = building_grid.get((gx + dx, gy + dy))
                    if b_bucket:
                        for b in b_bucket:
                            if (b.x - ax)**2 + (b.y - ay)**2 <= 25.0:
                                agent.information.known_buildings[b.id] = {
                                    "id": b.id,
                                    "type": b.building_type,
                                    "x": b.x,
                                    "y": b.y,
                                    "settlement_id": b.settlement_id
                                }


