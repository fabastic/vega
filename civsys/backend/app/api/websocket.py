import asyncio
import json
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from app.api.endpoints.simulation import get_or_create_sim
from app.simulation.state import WebSocketStatePayload, AgentPosPayload

router = APIRouter()

@router.websocket("/ws")
async def websocket_stream(websocket: WebSocket, sim_id: str = "sim_default", seed: int = 42):
    await websocket.accept()
    engine = get_or_create_sim(sim_id, seed=seed)
    
    try:
        while True:
            # Advance simulation by 1 step if running
            if engine.state.is_running:
                engine.step()
                
            # Check if a snapshot needs to be flushed to DB
            if engine.context.transient_data.get("needs_db_snapshot"):
                engine.context.transient_data["needs_db_snapshot"] = False
                # Clone state/context properties needed for flush if necessary, or just run it. 
                # Since we are in a single-threaded execution loop (fastapi task), this thread will block slightly
                # To avoid blocking the event loop completely:
                from app.db.crud import flush_simulation_to_db
                await asyncio.to_thread(
                    flush_simulation_to_db,
                    sim_id,
                    seed,
                    engine.state,
                    engine.context
                )
                
            # Prepare payload frame
            agents_pos = [
                AgentPosPayload(
                    id=a.id,
                    name=a.name,
                    x=a.current_location[0],
                    y=a.current_location[1],
                    visual_profile=a.visual_profile,
                    current_action=a.current_action,
                    health=round(a.needs.health, 2),
                    hunger=round(a.needs.hunger, 2),
                    is_migrating=a.is_migrating,
                    chat_bubble=a.current_action if a.current_action not in ['idle', 'sleep', 'rest'] else None
                )
                for a in engine.state.agents.values()
                if a.is_alive
            ]
            
            latest_m = engine.state.metrics_history[-1] if engine.state.metrics_history else None
            
            payload = WebSocketStatePayload(
                simulation_id=engine.state.simulation_id,
                tick=engine.state.tick,
                is_running=engine.state.is_running,
                weather=engine.state.world.weather,
                crop_yield_multiplier=engine.state.world.crop_yield_multiplier,
                food_price=engine.state.world.market.food_price,
                agents=agents_pos,
                buildings=[
                    {
                        "id": b.id,
                        "building_type": b.building_type,
                        "x": b.x,
                        "y": b.y,
                        "scale": [3.0, 3.0, 3.0]
                    } for b in engine.state.world.buildings
                ],
                latest_metrics=latest_m
            )
            
            await websocket.send_json(payload.model_dump())
            sleep_duration = 1.0 / max(0.1, engine.state.tick_rate_hz)
            await asyncio.sleep(sleep_duration)
            
    except WebSocketDisconnect:
        pass
    except Exception as e:
        print(f"WebSocket Error: {e}")
