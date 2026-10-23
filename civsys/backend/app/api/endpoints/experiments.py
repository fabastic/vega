from fastapi import APIRouter
from pydantic import BaseModel
from app.simulation.experiments.runner import ExperimentConfig, ExperimentResult, ExperimentEngine
from app.simulation.experiments.interpreter import interpreter, SemanticInterpretationResult
from app.simulation.registry import registry
from app.simulation.experiments.presets import PRESET_LIBRARY

router = APIRouter()

class HypothesisRequest(BaseModel):
    query: str

@router.get("/status")
async def experiment_status():
    return {"status": "ready"}

@router.get("/registry")
async def get_registry():
    # Return all parameter definitions
    return {"parameters": [p.dict() for p in registry.get_all()]}

@router.get("/presets")
async def get_presets():
    """Return all named experiment presets. Frontend is a consumer only.
    Execution always occurs through /run using ExperimentConfig."""
    return {"presets": PRESET_LIBRARY}

@router.post("/interpret", response_model=SemanticInterpretationResult)
async def interpret_hypothesis(request: HypothesisRequest):
    result = interpreter.interpret(request.query)
    return result

@router.post("/run", response_model=ExperimentResult)
async def run_experiment(config: ExperimentConfig):
    engine = ExperimentEngine(config)
    result = engine.run_experiment()
    return result
