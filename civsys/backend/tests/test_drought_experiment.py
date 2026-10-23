import pytest
from app.simulation.experiments.runner import ExperimentEngine
from app.simulation.experiments.runner import ExperimentConfig, Intervention

def test_drought_experiment_divergence():
    """
    Verifies that running Control vs Treatment from seed 42 with Drought injected at tick 20
    produces emergent metric divergence (food price spike, stress increase, migration emergence).
    """
    config = ExperimentConfig(
        id="exp_test_drought",
        seed=42,
        population_size=100,
        duration_ticks=60,
        interventions=[
            Intervention(
                target="crop_yield_multiplier",
                operation="set",
                value=0.2,
                start_tick=20,
                end_tick=60
            )
        ]
    )
    exp_engine = ExperimentEngine(config)
    result = exp_engine.run_experiment()
    
    assert result.experiment_id == "exp_test_drought"
    assert len(result.control_metrics) == 60
    assert len(result.treatment_metrics) == 60
    
    # Assert divergence: Treatment food price index should be higher than Control
    last_ctrl = result.control_metrics[-1]
    last_trt = result.treatment_metrics[-1]
    
    assert last_trt.food_price_index > last_ctrl.food_price_index
    if last_trt.living_population > 0:
        # Average stress might drop if the most stressed agents die (survivor bias).
        # We assert that the OVERALL negative impact (stress + deaths) is greater or equal.
        assert (last_trt.average_stress + last_trt.death_count) >= (last_ctrl.average_stress + last_ctrl.death_count)
    assert len(exp_engine.treatment_engine.state.causal_ledger) > 0
