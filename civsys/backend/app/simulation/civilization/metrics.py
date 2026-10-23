from pydantic import BaseModel, Field

class MetricsSnapshot(BaseModel):
    tick: int
    population: int = 0
    living_population: int = 0
    migrated_count: int = 0
    death_count: int = 0
    total_food_produced: float = 0.0
    food_price_index: float = 10.0
    average_wealth: float = 0.0
    average_hunger: float = 0.0
    average_stress: float = 0.0
    social_cohesion_index: float = 0.5
    settlement_populations: dict = Field(default_factory=dict)
    settlement_hunger: dict = Field(default_factory=dict)


from app.simulation.base import BaseSimulationSystem
from app.simulation.context import SimulationContext
from app.simulation.civilization.metrics import MetricsSnapshot

class MetricsSystem(BaseSimulationSystem):
    """
    Step 15: Metrics & Analytics System
    Aggregates micro agent and market states into a MetricsSnapshot time-series frame.
    """
    def __init__(self):
        super().__init__(name="MetricsSystem", step_number=15)

    def execute(self, context: SimulationContext) -> None:
        agents = list(context.state.agents.values())
        world = context.state.world
        
        total_pop = len(agents)
        living_pop = sum(1 for a in agents if a.is_alive)
        migrated_cnt = sum(1 for a in agents if a.is_alive and a.is_migrating)
        death_cnt = sum(1 for a in agents if not a.is_alive)
        
        avg_wealth = sum(a.economic.money for a in agents if a.is_alive) / max(1, living_pop)
        avg_hunger = sum(a.needs.hunger for a in agents if a.is_alive) / max(1, living_pop)
        avg_stress = sum(a.emotions.anxiety.intensity + a.emotions.fear.intensity for a in agents if a.is_alive) / max(1, living_pop * 2)
        
        groups = list(context.state.groups.values())
        social_cohesion = sum(g.cohesion for g in groups) / max(1, len(groups))
        
        # Calculate per-settlement metrics
        settlement_pops = {}
        settlement_hunger_sums = {}
        
        for a in agents:
            if a.is_alive and a.social_identity.community_id:
                cid = a.social_identity.community_id
                settlement_pops[cid] = settlement_pops.get(cid, 0) + 1
                settlement_hunger_sums[cid] = settlement_hunger_sums.get(cid, 0.0) + a.needs.hunger
                
        settlement_hunger_avgs = {
            cid: round(settlement_hunger_sums[cid] / pop, 2)
            for cid, pop in settlement_pops.items()
        }

        snapshot = MetricsSnapshot(
            tick=context.tick,
            population=total_pop,
            living_population=living_pop,
            migrated_count=migrated_cnt,
            death_count=death_cnt,
            total_food_produced=world.market.food_supply,
            food_price_index=world.market.food_price,
            average_wealth=round(avg_wealth, 2),
            average_hunger=round(avg_hunger, 2),
            average_stress=round(avg_stress, 2),
            social_cohesion_index=round(social_cohesion, 2),
            settlement_populations=settlement_pops,
            settlement_hunger=settlement_hunger_avgs
        )
        context.state.metrics_history.append(snapshot)


