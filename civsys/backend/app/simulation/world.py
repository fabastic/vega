from pydantic import BaseModel, Field
from typing import List, Dict, Optional, Tuple

class Region(BaseModel):
    id: str
    name: str
    bounds: Tuple[int, int, int, int] # min_x, min_y, max_x, max_y
    biome: str # forest, plains, desert, mountains
    crop_yield_multiplier: float = 1.0
    infrastructure_multiplier: float = 1.0

class ResourceDeposit(BaseModel):
    id: str
    resource_type: str # metal, stone, coal
    amount: float
    x: int
    y: int
    region_id: str
    discovered: bool = False

class Settlement(BaseModel):
    id: str
    name: str
    settlement_type: str # village, town, city
    x: int
    y: int
    region_id: str

class MapCell(BaseModel):
    x: int
    y: int
    elevation: float = 0.0
    terrain_type: str = "grass" # grass, farm, forest, river, rock, road, desert
    fertility: float = 1.0     # Multiplier: 1.0 = normal, 0.2 = drought
    moisture: float = 0.5
    temperature: float = 22.0
    region_id: Optional[str] = None
    food_resources: float = 50.0
    wood_resources: float = 0.0
    stone_resources: float = 0.0
    metal_resources: float = 0.0
    building_id: Optional[str] = None

class Building(BaseModel):
    id: str
    name: str
    building_type: str # house, farm, market, workshop, mine, institution
    x: int
    y: int
    capacity: int = 10
    owner_id: Optional[str] = None
    region_id: Optional[str] = None
    settlement_id: Optional[str] = None

class MarketPriceIndex(BaseModel):
    food_price: float = 10.0
    food_supply: float = 500.0
    food_demand: float = 500.0
    wood_price: float = 15.0
    wood_supply: float = 200.0
    wood_demand: float = 200.0
    stone_price: float = 20.0
    stone_supply: float = 100.0
    stone_demand: float = 100.0
    metal_price: float = 50.0
    metal_supply: float = 50.0
    metal_demand: float = 50.0
    tools_price: float = 100.0
    tools_supply: float = 20.0
    tools_demand: float = 20.0

class WorldState(BaseModel):
    width: int = 256
    height: int = 256
    weather: str = "clear" # clear, drought, rain
    temperature: float = 22.0 # Celsius
    crop_yield_multiplier: float = 1.0 # Drought perturbation modifies this
    trade_friction: float = 1.0 # Trade friction for economy
    # Cultural & Political Zeitgeists
    progressivism: float = 0.5
    authoritarianism: float = 0.5
    religiosity: float = 0.5
    trust_decay: float = 0.05
    crop_yield_multiplier: float = 1.0
    active_capabilities: List[str] = Field(default_factory=list) # e.g. ["electricity", "mechanized_production"]
    tech_progress: float = 0.0
    regions: List[Region] = Field(default_factory=list)
    settlements: List[Settlement] = Field(default_factory=list)
    cells: List[MapCell] = Field(default_factory=list)
    buildings: List[Building] = Field(default_factory=list)
    resource_deposits: List[ResourceDeposit] = Field(default_factory=list)
    market: MarketPriceIndex = Field(default_factory=MarketPriceIndex)

    def get_region(self, pos: Tuple[int, int]) -> Optional[Region]:
        for r in self.regions:
            x, y = pos
            if r.bounds[0] <= x <= r.bounds[2] and r.bounds[1] <= y <= r.bounds[3]:
                return r
        return None


from app.simulation.base import BaseSimulationSystem
from app.simulation.context import SimulationContext

class WorldSystem(BaseSimulationSystem):
    """
    Step 1: World System
    Updates environmental variables, weather, temperature, and cell fertility based on active multipliers.
    Observes parameters modified by EventSystem on tick T-1.
    """
    def __init__(self):
        super().__init__(name="WorldSystem", step_number=1)

    def execute(self, context: SimulationContext) -> None:
        world = context.state.world
        
        # Weather update
        if world.crop_yield_multiplier < 0.5:
            world.weather = "drought"
        else:
            world.weather = "clear"
            
        # Update map cells fertility
        for cell in world.cells:
            cell.fertility = world.crop_yield_multiplier
            # Natural food regeneration on unharvested farm/grass cells
            if cell.terrain_type in ["farm", "grass"]:
                cell.food_resources = min(100.0, cell.food_resources + (2.0 * cell.fertility))


