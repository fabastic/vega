import random
import numpy as np
from typing import List, Optional
from app.simulation.state import SimulationState
from app.simulation.humans.agent import AgentState
from app.simulation.world import WorldState, MapCell, Building
from app.simulation.events import ActiveEvent
from app.simulation.context import SimulationContext

from app.simulation.base import BaseSimulationSystem
from app.simulation.world import WorldSystem
from app.simulation.humans.perception import PerceptionSystem
from app.simulation.humans.needs import NeedsSystem
from app.simulation.humans.emotions import EmotionSystem
from app.simulation.humans.memory import MemorySystem
from app.simulation.humans.learning import LearningSystem
from app.simulation.humans.goals import GoalSystem
from app.simulation.humans.decisions import DecisionSystem
from app.simulation.economy.production import ActionSystem
from app.simulation.social.relationships import InteractionSystem
from app.simulation.economy.markets import EconomySystem
from app.simulation.economy.technology import TechnologySystem
from app.simulation.social.influence import SocialSystem
from app.simulation.social.groups import GroupSystem
from app.simulation.civilization.society import InstitutionSystem
from app.simulation.civilization.society import CultureBeliefSystem
from app.simulation.events import EventSystem
from app.simulation.spatial.movement import MovementSystem
from app.simulation.civilization.population import PopulationSystem
from app.simulation.civilization.lifecycle import LifecycleSystem
from app.simulation.civilization.metrics import MetricsSystem
from app.simulation.experiments.causality import CausalSystem
from app.simulation.snapshot import SnapshotSystem

class SimulationEngine:
    """
    Orchestrates the 17-step master tick loop with deterministic RNG.
    Enforces pure Python domain execution and deterministic seed reproducibility.
    """
    def __init__(self, seed: int = 42, population_size: int = 800, width: int = 512, height: int = 512):
        self.seed: int = seed
        self.rng: random.Random = random.Random(seed)
        self.np_rng: np.random.Generator = np.random.default_rng(seed)
        
        # Initialize master SimulationState
        self.state: SimulationState = SimulationState(
            simulation_id=f"sim_{seed}",
            seed=seed,
            tick=0,
            is_running=False,
            world=WorldState(width=width, height=height)
        )
        
        # Initialize SimulationContext
        self.context: SimulationContext = SimulationContext(
            state=self.state,
            rng=self.rng,
            np_rng=self.np_rng
        )
        
        # Instantiate 17 Master Tick Pipeline Systems
        self.systems: List[BaseSimulationSystem] = [
            WorldSystem(),            # Step 1
            PerceptionSystem(),       # Step 2
            NeedsSystem(),            # Step 3
            EmotionSystem(),          # Step 4
            MemorySystem(),           # Step 4.1
            LearningSystem(),         # Step 4.2
            GoalSystem(),             # Step 5
            DecisionSystem(),         # Step 6
            MovementSystem(),         # Step 6.5
            ActionSystem(),           # Step 7
            InteractionSystem(),      # Step 8
            EconomySystem(),          # Step 9
            TechnologySystem(),       # Step 9.5
            SocialSystem(),           # Step 10
            GroupSystem(),            # Step 11
            InstitutionSystem(),      # Step 12
            CultureBeliefSystem(),    # Step 12 (Culture/Beliefs)
            EventSystem(),            # Step 13
            PopulationSystem(),       # Step 14
            LifecycleSystem(),        # Step 14.5
            MetricsSystem(),          # Step 15
            CausalSystem(),           # Step 16
            SnapshotSystem()          # Step 17
        ]
        
        # Bootstrap world cells and population
        self._initialize_world(width, height)
        self._initialize_population(population_size)

    def _initialize_world(self, width: int, height: int):
        from app.simulation.world import Region, Settlement
        
        # 1. Define Regions
        self.state.world.regions = [
            Region(id="north_forest", name="Northern Woods", bounds=(0, 0, width, height//2), biome="forest"),
            Region(id="central_valley", name="Central Valley", bounds=(width//4, height//4, 3*width//4, 3*height//4), biome="plains"),
            Region(id="east_mines", name="Eastern Crags", bounds=(3*width//4, 0, width, height), biome="mountains"),
            Region(id="south_desert", name="Southern Wastes", bounds=(0, height//2, width, height), biome="desert")
        ]
        
        # 2. Define Settlements
        self.state.world.settlements = [
            Settlement(id="set_riverside", name="Riverside", settlement_type="city", x=128, y=128, region_id="central_valley"),
            Settlement(id="set_woodhaven", name="Woodhaven", settlement_type="village", x=40, y=40, region_id="north_forest"),
            Settlement(id="set_stonegate", name="Stonegate", settlement_type="town", x=210, y=150, region_id="east_mines")
        ]
        
        # 3. Dormant Resource Deposits (for Discovery events)
        from app.simulation.world import ResourceDeposit
        self.state.world.resource_deposits = [
            ResourceDeposit(
                id="hidden_metal_vein",
                resource_type="metal",
                amount=50000.0,
                x=215,
                y=155,
                region_id="east_mines",
                discovered=False
            )
        ]
        
        # Generate base noise (we'll just use random with spatial correlation roughly if possible, but pure random for now)
        base_noise = self.np_rng.random((width, height))
        # Simple smoothing
        for _ in range(2):
            base_noise = (base_noise + np.roll(base_noise, 1, axis=0) + np.roll(base_noise, -1, axis=0) + 
                          np.roll(base_noise, 1, axis=1) + np.roll(base_noise, -1, axis=1)) / 5.0
                          
        elevation = base_noise
        moisture = self.np_rng.random((width, height))
        for _ in range(2):
            moisture = (moisture + np.roll(moisture, 1, axis=0) + np.roll(moisture, -1, axis=0) + 
                        np.roll(moisture, 1, axis=1) + np.roll(moisture, -1, axis=1)) / 5.0
        
        cells = []
        for x in range(width):
            for y in range(height):
                e = elevation[x, y]
                m = moisture[x, y]
                
                # Determine region and biome logic
                if x > 3*width//4:
                    terrain = "rock" if e > 0.4 else "grass"
                    region_id = "east_mines"
                elif y > height//2 and x < 3*width//4:
                    terrain = "desert" if m < 0.6 else "rock"
                    region_id = "south_desert"
                elif y < height//2 and x < 3*width//4:
                    terrain = "forest" if m > 0.4 else "grass"
                    region_id = "north_forest"
                else:
                    terrain = "grass"
                    region_id = "central_valley"
                
                # Override for Central Valley
                if width//4 <= x < 3*width//4 and height//4 <= y < 3*height//4:
                    terrain = "grass"
                    region_id = "central_valley"

                # Rivers and Roads
                if abs(x - width//2) < 2 and terrain != "rock":
                    terrain = "river"
                
                cells.append(MapCell(
                    x=x, y=y,
                    elevation=float(e), moisture=float(m),
                    terrain_type=terrain,
                    fertility=1.0 if terrain in ["grass", "forest", "farm"] else 0.0,
                    # Scaled food reserves: 1000 agents need much more food capacity per cell
                    # farm=500, grass=100, forest=30 — supports large-scale harvesting
                    food_resources=500.0 if terrain == "farm" else (100.0 if terrain == "grass" else (30.0 if terrain == "forest" else 0.0)),
                    wood_resources=300.0 if terrain == "forest" else 0.0,
                    stone_resources=300.0 if terrain == "rock" else 0.0,
                    metal_resources=150.0 if terrain == "rock" and e > 0.75 else 0.0,
                    region_id=region_id
                ))
        self.state.world.cells = cells
        
        buildings = []
        
        def add_buildings_for_settlement(s: Settlement, farms: int, markets: int, workshops: int, homes: int, mines: int):
            for i in range(farms):
                bx, by = s.x + self.rng.randint(-15, 15), s.y + self.rng.randint(-15, 15)
                buildings.append(Building(id=f"bld_farm_{s.id}_{i}", name=f"{s.name} Farm", building_type="farm", x=bx, y=by, capacity=30, region_id=s.region_id, settlement_id=s.id))
            for i in range(markets):
                bx, by = s.x + self.rng.randint(-5, 5), s.y + self.rng.randint(-5, 5)
                buildings.append(Building(id=f"bld_market_{s.id}_{i}", name=f"{s.name} Market", building_type="market", x=bx, y=by, capacity=200, region_id=s.region_id, settlement_id=s.id))
            for i in range(workshops):
                bx, by = s.x + self.rng.randint(-8, 8), s.y + self.rng.randint(-8, 8)
                buildings.append(Building(id=f"bld_workshop_{s.id}_{i}", name=f"{s.name} Workshop", building_type="workshop", x=bx, y=by, capacity=30, region_id=s.region_id, settlement_id=s.id))
            for i in range(mines):
                bx, by = s.x + self.rng.randint(-12, 12), s.y + self.rng.randint(-12, 12)
                buildings.append(Building(id=f"bld_mine_{s.id}_{i}", name=f"{s.name} Mine", building_type="mine", x=bx, y=by, capacity=30, region_id=s.region_id, settlement_id=s.id))
            for i in range(homes):
                bx, by = s.x + self.rng.randint(-20, 20), s.y + self.rng.randint(-20, 20)
                buildings.append(Building(id=f"bld_home_{s.id}_{i}", name=f"{s.name} House", building_type="home", x=bx, y=by, capacity=5, region_id=s.region_id, settlement_id=s.id))
                
        # Populate settlements with buildings scaled for 1000 citizens
        # Riverside (city) — handles ~600 citizens, Woodhaven (village) ~200, Stonegate (town) ~200
        add_buildings_for_settlement(self.state.world.settlements[0], farms=18, markets=5, workshops=6, homes=60, mines=0)  # Riverside
        add_buildings_for_settlement(self.state.world.settlements[1], farms=8,  markets=2, workshops=3, homes=25, mines=0)  # Woodhaven
        add_buildings_for_settlement(self.state.world.settlements[2], farms=4,  markets=2, workshops=3, homes=20, mines=5)  # Stonegate
        
        # Institution for Riverside
        s_riv = self.state.world.settlements[0]
        buildings.append(Building(id=f"bld_inst_{s_riv.id}_0", name=f"{s_riv.name} Hall", building_type="institution", x=s_riv.x, y=s_riv.y, capacity=100, region_id=s_riv.region_id, settlement_id=s_riv.id))
        
        self.state.world.buildings = buildings

    def _initialize_population(self, population_size: int):
        settlements = self.state.world.settlements
        buildings = self.state.world.buildings
        
        for i in range(population_size):
            agent_id = f"agent_{i:04d}"
            
            # Setup specific demo fixtures for testing distinct paths
            if i == 0:
                s = settlements[0] # Riverside
                occ = "farmer"
            elif i == 1:
                s = settlements[0]
                occ = "crafter"
            elif i == 2:
                s = settlements[2] # Stonegate
                occ = "miner"
            else:
                s = self.rng.choices(settlements, weights=[100, 30, 20])[0]
                if s.id == "set_woodhaven":
                    occ = self.rng.choice(["farmer", "woodcutter"])
                elif s.id == "set_stonegate":
                    occ = self.rng.choice(["miner", "crafter"])
                else:
                    occ = self.rng.choice(["farmer", "crafter", "woodcutter", "teacher"])
            
            # Find a home in this settlement
            home_buildings = [b for b in buildings if b.settlement_id == s.id and b.building_type == "home"]
            home = self.rng.choice(home_buildings) if home_buildings else None
            
            rx = float(home.x) if home else float(s.x)
            ry = float(home.y) if home else float(s.y)
            
            # Profile maps to occupation
            vprof = "farmer_01" if occ == "farmer" else "worker_01"
            if occ == "crafter": vprof = "shopkeeper_01"
            if occ == "teacher": vprof = "teacher_01"
            
            agent = AgentState(
                id=agent_id,
                name=f"Human_{i}",
                age=self.rng.randint(18, 60),
                home_location=(rx, ry),
                home_building_id=home.id if home else None,
                current_location=(rx, ry),
                visual_profile=vprof,
                needs={"hunger": self.rng.uniform(0.0, 0.3), "energy": self.rng.uniform(0.7, 1.0)},
                personality={
                    "openness": self.rng.uniform(0.2, 0.8),
                    "conscientiousness": self.rng.uniform(0.2, 0.8),
                    "extraversion": self.rng.uniform(0.2, 0.8),
                    "agreeableness": self.rng.uniform(0.2, 0.8),
                    "emotional_stability": self.rng.uniform(0.2, 0.8),
                    "risk_tolerance": self.rng.uniform(0.1, 0.9),
                    "frugality": self.rng.uniform(0.1, 0.9)
                },
                economic={"money": round(self.rng.uniform(50.0, 200.0), 2), "food_inventory": 5.0, "occupation": occ}
            )
            # Set community identity
            agent.social_identity.community_id = s.id
            self.state.agents[agent_id] = agent

    def step(self) -> SimulationState:
        """
        Executes exactly 1 tick cycle across all 17 master tick pipeline systems.
        """
        for system in self.systems:
            system.execute(self.context)
        return self.state

    def inject_event(self, event: ActiveEvent):
        """
        Injects an external event (e.g. Drought) into active events.
        Enforces LOCKED Event Timing semantics (takes yield effect on step 13 -> step 1 of next tick).
        """
        self.state.active_events.append(event)
