import math
from typing import Optional, Tuple, Dict
from app.simulation.context import SimulationContext
from app.simulation.humans.agent import AgentState
from app.simulation.world import WorldState

class TargetResolver:
    """
    Resolves an abstract action intent into a specific spatial target.
    """
    @staticmethod
    def resolve(agent: AgentState, context: SimulationContext) -> None:
        action = agent.current_action
        world = context.state.world
        
        # Determine target type and ID
        if action == "work":
            if agent.economic.occupation == "farmer":
                TargetResolver._find_nearest_building(agent, world, "farm")
            elif agent.economic.occupation == "crafter":
                TargetResolver._find_nearest_building(agent, world, "workshop")
            elif agent.economic.occupation == "miner":
                # Mines might be terrain (rock), not buildings. For now, target nearest rock cell.
                TargetResolver._find_nearest_terrain(agent, world, "rock")
            else:
                TargetResolver._set_target(agent, "location", None, agent.home_location)
                
        elif action in ["eat", "rest", "sleep"]:
            if agent.home_building_id:
                TargetResolver._set_target(agent, "building", agent.home_building_id, agent.home_location)
            else:
                TargetResolver._set_target(agent, "location", None, agent.home_location)
            
        elif action == "trade_buy":
            TargetResolver._find_nearest_building(agent, world, "market")
            
        elif action in ["talk", "cooperate", "cooperate_share", "compete"]:
            # Pick a visible agent to interact with
            if agent.perception.visible_agents:
                target_id = context.rng.choice(agent.perception.visible_agents)
                target_agent = context.state.agents.get(target_id)
                if target_agent and target_agent.is_alive:
                    TargetResolver._set_target(agent, "agent", target_id, target_agent.current_location)
                else:
                    TargetResolver._set_target(agent, "location", None, agent.home_location)
            else:
                TargetResolver._find_nearest_building(agent, world, "market")
                
        elif action == "migrate":
            TargetResolver._find_nearest_building(agent, world, "house") # Migrate to another settlement

    @staticmethod
    def _set_target(agent: AgentState, t_type: str, t_id: Optional[str], loc: Tuple[float, float]):
        agent.target_type = t_type
        agent.target_entity_id = t_id
        agent.target_location = loc
        agent.movement_state = "traveling"
        
    @staticmethod
    def _find_nearest_building(agent: AgentState, world: WorldState, b_type: str):
        best_b = None
        best_dist = float('inf')
        
        community_id = agent.social_identity.community_id
        
        for b_id, b in agent.information.known_buildings.items():
            if b["type"] == b_type:
                # Apply distance penalty if the building is outside the agent's home settlement
                penalty = 1.0 if b["settlement_id"] == community_id else 5.0
                dist = math.sqrt((b["x"] - agent.current_location[0])**2 + (b["y"] - agent.current_location[1])**2) * penalty
                if dist < best_dist:
                    best_dist = dist
                    best_b = b
                    
        if best_b:
            TargetResolver._set_target(agent, "building", best_b["id"], (float(best_b["x"]), float(best_b["y"])))
        else:
            TargetResolver._set_target(agent, "location", None, agent.home_location)

    @staticmethod
    def _find_nearest_terrain(agent: AgentState, world: WorldState, t_type: str):
        # A simple scanner for nearest terrain
        cx, cy = agent.current_location
        best_loc = (cx, cy)
        best_dist = float('inf')
        
        # Don't scan entire world, just a local radius for performance
        search_radius = 30
        for cell in world.cells:
            if cell.terrain_type == t_type:
                dist = math.sqrt((cell.x - cx)**2 + (cell.y - cy)**2)
                if dist < search_radius and dist < best_dist:
                    best_dist = dist
                    best_loc = (cell.x, cell.y)
                    
        TargetResolver._set_target(agent, "location", None, best_loc)


class PathPlanner:
    """Interface for path planning."""
    def get_velocity(self, current: Tuple[float, float], target: Tuple[float, float], speed: float) -> Tuple[float, float]:
        raise NotImplementedError

class DirectPathPlanner(PathPlanner):
    """Phase 5: Euclidean direct paths."""
    def get_velocity(self, current: Tuple[float, float], target: Tuple[float, float], speed: float) -> Tuple[float, float]:
        dx = target[0] - current[0]
        dy = target[1] - current[1]
        dist = math.sqrt(dx**2 + dy**2)
        if dist == 0:
            return (0.0, 0.0)
        return ((dx / dist) * speed, (dy / dist) * speed)
