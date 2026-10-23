import math
from app.simulation.base import BaseSimulationSystem
from app.simulation.context import SimulationContext
from app.simulation.spatial.spatial import DirectPathPlanner

class MovementSystem(BaseSimulationSystem):
    """
    Handles physical travel, arrival checks, and lightweight collision avoidance.
    """
    def __init__(self):
        super().__init__(name="MovementSystem", step_number=6.5) # Executes right after decisions
        self.planner = DirectPathPlanner()
        self.arrival_threshold = 1.0
        self.speed = 1.5
        self.separation_radius = 0.8
        self.separation_force = 1.0

    def execute(self, context: SimulationContext) -> None:
        agents = list(context.state.agents.values())
        
        # First, update dynamic targets (e.g. if tracking another moving agent)
        for agent in agents:
            if not agent.is_alive or agent.movement_state != "traveling":
                continue
                
            if agent.target_type == "agent" and agent.target_entity_id:
                target_agent = context.state.agents.get(agent.target_entity_id)
                if target_agent and target_agent.is_alive:
                    agent.target_location = target_agent.current_location

        # Build spatial grid for agents
        agent_grid = {}
        for a in agents:
            if a.is_alive:
                cx, cy = int(a.current_location[0] // 5), int(a.current_location[1] // 5)
                if (cx, cy) not in agent_grid:
                    agent_grid[(cx, cy)] = []
                agent_grid[(cx, cy)].append(a)
                
        # Calculate movement velocities
        for i, agent in enumerate(agents):
            if not agent.is_alive:
                continue
                
            if agent.movement_state == "traveling" and agent.target_location:
                cx, cy = agent.current_location
                tx, ty = agent.target_location
                
                dist = math.sqrt((tx - cx)**2 + (ty - cy)**2)
                
                if dist <= self.arrival_threshold:
                    agent.movement_state = "arrived"
                else:
                    vx, vy = self.planner.get_velocity((cx, cy), (tx, ty), self.speed)
                    
                    # Lightweight Separation using grid
                    sep_x, sep_y = 0.0, 0.0
                    neighbors = 0
                    
                    gx, gy = int(cx // 5), int(cy // 5)
                    for dx in [-1, 0, 1]:
                        for dy in [-1, 0, 1]:
                            bucket = agent_grid.get((gx + dx, gy + dy))
                            if bucket:
                                for other in bucket:
                                    if other.id == agent.id or not other.is_alive:
                                        continue
                                    ox, oy = other.current_location
                                    d_agents = math.sqrt((ox - cx)**2 + (oy - cy)**2)
                                    if 0 < d_agents < self.separation_radius:
                                        sep_x -= (ox - cx) / d_agents
                                        sep_y -= (oy - cy) / d_agents
                                        neighbors += 1
                                        
                    if neighbors > 0:
                        vx += (sep_x / neighbors) * self.separation_force
                        vy += (sep_y / neighbors) * self.separation_force
                        
                    # Apply velocity
                    new_x = cx + vx
                    new_y = cy + vy
                    
                    # Keep within bounds
                    new_x = max(0.0, min(float(context.state.world.width - 1), new_x))
                    new_y = max(0.0, min(float(context.state.world.height - 1), new_y))
                    
                    agent.current_location = (round(new_x, 2), round(new_y, 2))
