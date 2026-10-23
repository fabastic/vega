import pytest
import hashlib
import json
from app.simulation.experiments.runner import ExperimentEngine, ExperimentConfig, Intervention, InterventionScope
from app.simulation.state import SimulationState
from app.simulation.registry import ParameterDomain

def canonical_hash(state: SimulationState) -> str:
    """
    Produces a deterministic SHA-256 hash of the simulation state.
    """
    data = {
        "tick": state.tick,
        "world_crop_yield": getattr(state.world, "crop_yield_multiplier", 1.0),
        "agent_count": len(state.agents),
        "agents": {
            k: {
                "age": v.age,
                "hunger": round(v.needs.hunger, 3),
                "money": round(v.economic.money, 3)
            }
            for k, v in sorted(state.agents.items())
        }
    }
    canonical_json = json.dumps(data, sort_keys=True)
    return hashlib.sha256(canonical_json.encode('utf-8')).hexdigest()

def test_pure_determinism():
    """
    same seed/config -> identical trajectory
    """
    config1 = ExperimentConfig(
        id="exp_det_1",
        seed=101,
        population_size=50,
        world_width=32,
        world_height=32,
        duration_ticks=20,
        interventions=[]
    )
    
    config2 = ExperimentConfig(
        id="exp_det_2",
        seed=101,
        population_size=50,
        world_width=32,
        world_height=32,
        duration_ticks=20,
        interventions=[]
    )
    
    e1 = ExperimentEngine(config1)
    e2 = ExperimentEngine(config2)
    
    assert canonical_hash(e1.control_engine.state) == canonical_hash(e2.control_engine.state)
    
    e1.run_experiment()
    e2.run_experiment()
    
    assert canonical_hash(e1.control_engine.state) == canonical_hash(e2.control_engine.state)


def test_known_causal_intervention():
    """
    T0: control == treatment
    Ticks < intervention: control == treatment
    intervention: control != treatment
    """
    config = ExperimentConfig(
        id="exp_causal_1",
        seed=202,
        population_size=50,
        world_width=32,
        world_height=32,
        duration_ticks=20,
        interventions=[
            Intervention(
                target="crop_yield_multiplier",
                operation="set",
                value=0.2,
                start_tick=10,
                end_tick=20,
                scope=InterventionScope(scope_type="GLOBAL")
            )
        ]
    )
    
    engine = ExperimentEngine(config)
    
    # T0 check
    assert canonical_hash(engine.control_engine.state) == canonical_hash(engine.treatment_engine.state)
    
    # Step up to tick 9
    for _ in range(9):
        engine.control_engine.step()
        engine.treatment_engine.step()
        
    # Pre-intervention check
    assert canonical_hash(engine.control_engine.state) == canonical_hash(engine.treatment_engine.state)
    
    # Tick 10 (Intervention begins)
    for inv in config.interventions:
        if 10 == inv.start_tick:
            engine._apply_intervention(engine.treatment_engine, inv, revert=False)
            
    engine.control_engine.step()
    engine.treatment_engine.step()
    
    # Post-intervention check
    assert canonical_hash(engine.control_engine.state) != canonical_hash(engine.treatment_engine.state)
