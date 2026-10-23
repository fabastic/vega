from fastapi import APIRouter, HTTPException, Query
from typing import Optional, Dict, Any
from app.simulation.engine import SimulationEngine
from app.simulation.events import ActiveEvent
from app.simulation.humans.agent import AgentState
from app.simulation.state import WebSocketStatePayload, AgentPosPayload

router = APIRouter()

# Global in-memory active simulation instance store
active_simulations: Dict[str, SimulationEngine] = {}

def get_or_create_sim(sim_id: str = "sim_default", seed: int = 42, pop_size: int = 800) -> SimulationEngine:
    if sim_id not in active_simulations:
        active_simulations[sim_id] = SimulationEngine(seed=seed, population_size=pop_size)
    return active_simulations[sim_id]

@router.get("/health")
async def health_check():
    return {"status": "ok", "service": "simulation"}

@router.post("/create")
async def create_simulation(seed: int = 42, population_size: int = 800, sim_id: str = "sim_default"):
    engine = SimulationEngine(seed=seed, population_size=population_size)
    engine.state.simulation_id = sim_id
    active_simulations[sim_id] = engine
    return {
        "status": "created",
        "simulation_id": sim_id,
        "seed": seed,
        "population_size": population_size,
        "tick": engine.state.tick
    }

@router.post("/step")
async def step_simulation(sim_id: str = "sim_default", steps: int = 1):
    if sim_id not in active_simulations:
        get_or_create_sim(sim_id)
    engine = active_simulations[sim_id]
    
    for _ in range(steps):
        engine.step()
        
    return {
        "simulation_id": sim_id,
        "tick": engine.state.tick,
        "living_population": sum(1 for a in engine.state.agents.values() if a.is_alive),
        "food_price": engine.state.world.market.food_price
    }

@router.post("/start")
async def start_simulation(sim_id: str = "sim_default"):
    if sim_id not in active_simulations:
        get_or_create_sim(sim_id)
    active_simulations[sim_id].state.is_running = True
    return {"status": "started", "simulation_id": sim_id}

@router.post("/pause")
async def pause_simulation(sim_id: str = "sim_default"):
    if sim_id in active_simulations:
        active_simulations[sim_id].state.is_running = False
    return {"status": "paused", "simulation_id": sim_id}

@router.post("/speed")
async def set_simulation_speed(speed: float = 1.0, sim_id: str = "sim_default"):
    if sim_id in active_simulations:
        active_simulations[sim_id].state.tick_rate_hz = 10.0 * speed
    return {"status": "speed_set", "speed": speed, "simulation_id": sim_id}

@router.post("/inject_event")
async def inject_event(sim_id: str = "sim_default", event_type: str = "drought", duration: int = 48):
    if sim_id not in active_simulations:
        get_or_create_sim(sim_id)
    engine = active_simulations[sim_id]
    
    from app.simulation.events import SpatialScope, SpatialScopeType
    event = ActiveEvent(
        id=f"evt_{event_type.lower()}_{engine.state.tick}",
        definition_id=event_type.lower(),
        spatial_scope=SpatialScope(scope_type=SpatialScopeType.GLOBAL),
        severity=0.8,
        start_tick=engine.state.tick,
        duration=duration,
        is_active=True
    )
    engine.inject_event(event)
    return {"status": "event_injected", "event": event}

@router.get("/inspect_agent/{agent_id}")
async def inspect_agent(agent_id: str, sim_id: str = "sim_default"):
    if sim_id not in active_simulations:
        get_or_create_sim(sim_id)
    engine = active_simulations[sim_id]
    
    agent = engine.state.agents.get(agent_id)
    if not agent:
        raise HTTPException(status_code=404, detail=f"Agent {agent_id} not found")
        
    return agent

@router.get("/causal_graph")
async def get_causal_graph(sim_id: str = "sim_default"):
    if sim_id not in active_simulations:
        get_or_create_sim(sim_id)
    engine = active_simulations[sim_id]
    
    return {
        "simulation_id": sim_id,
        "tick": engine.state.tick,
        "causal_ledger": engine.state.causal_ledger
    }

@router.get("/world-snapshot")
async def get_world_snapshot(sim_id: str = "sim_default"):
    """Returns a sampled terrain grid and full buildings list to the frontend."""
    if sim_id not in active_simulations:
        get_or_create_sim(sim_id)
        
    engine = active_simulations[sim_id]
    state = engine.state
    
    # We don't want to send 65536 cells, so we sample every 4th cell for the renderer (if >= 256)
    sample_rate = 4 if state.world.width >= 256 else 1
    
    sampled_cells = []
    for cell in state.world.cells:
        if cell.x % sample_rate == 0 and cell.y % sample_rate == 0:
            sampled_cells.append({
                "x": cell.x,
                "y": cell.y,
                "terrain_type": cell.terrain_type,
                "region_id": cell.region_id
            })
            
    return {
        "width": state.world.width,
        "height": state.world.height,
        "cells": sampled_cells,
        "buildings": [b.dict() for b in state.world.buildings]
    }

@router.get("/population")
async def get_population(sim_id: str = "sim_default"):
    if sim_id not in active_simulations:
        get_or_create_sim(sim_id)
    engine = active_simulations[sim_id]
    
    population_data = []
    for agent in engine.state.agents.values():
        stress = agent.emotions.anxiety.intensity if hasattr(agent.emotions, 'anxiety') else 0
        population_data.append({
            "id": agent.id,
            "name": agent.name,
            "age": agent.age,
            "gender": agent.gender,
            "occupation": agent.economic.occupation,
            "community_id": agent.social_identity.community_id,
            "is_alive": agent.is_alive,
            "is_migrating": agent.is_migrating,
            "health": agent.needs.health,
            "hunger": agent.needs.hunger,
            "stress": stress,
            "wealth": agent.economic.money,
            "current_action": agent.current_action
        })
    return {"population": population_data}

@router.get("/network")
async def get_network(sim_id: str = "sim_default"):
    if sim_id not in active_simulations:
        get_or_create_sim(sim_id)
    engine = active_simulations[sim_id]
    
    nodes = []
    edges = []
    
    for agent in engine.state.agents.values():
        if not agent.is_alive:
            continue
            
        nodes.append({
            "id": agent.id,
            "name": agent.name,
            "community_id": agent.social_identity.community_id,
            "group": agent.economic.occupation
        })
        
        for target_id, rel in agent.relationships.items():
            if rel.trust > 0.4 or rel.conflict > 0.4:
                edges.append({
                    "source": agent.id,
                    "target": target_id,
                    "trust": rel.trust,
                    "conflict": rel.conflict,
                    "familiarity": rel.familiarity
                })
                
    return {"nodes": nodes, "edges": edges}

@router.get("/economy")
async def get_economy(sim_id: str = "sim_default"):
    if sim_id not in active_simulations:
        get_or_create_sim(sim_id)
    engine = active_simulations[sim_id]
    state = engine.state
    
    total_wealth = sum(a.economic.money for a in state.agents.values() if a.is_alive)
    total_food_inventory = sum(a.economic.food_inventory for a in state.agents.values() if a.is_alive)
    
    return {
        "market": state.world.market.model_dump(),
        "aggregate": {
            "total_wealth": total_wealth,
            "total_food_inventory": total_food_inventory,
            "living_population": sum(1 for a in state.agents.values() if a.is_alive)
        }
    }
