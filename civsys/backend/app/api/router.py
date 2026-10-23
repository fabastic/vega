from fastapi import APIRouter
from app.api.endpoints import simulation, experiments
from app.api import websocket

api_router = APIRouter()
api_router.include_router(simulation.router, prefix="/simulation", tags=["simulation"])
api_router.include_router(experiments.router, prefix="/experiments", tags=["experiments"])
api_router.include_router(websocket.router, prefix="/simulation", tags=["websocket"])
