from app.simulation.experiments.runner import ExperimentEngine, ExperimentConfig, Intervention, InterventionScope

config = ExperimentConfig(
    id="test_exp",
    name="Test",
    seed=42,
    population_size=150,
    world_width=128,
    world_height=128,
    duration_ticks=50,
    interventions=[
        Intervention(
            target="progressivism",
            operation="set",
            value=0.0,
            start_tick=0,
            end_tick=50,
            scope=InterventionScope(scope_type="GLOBAL")
        )
    ]
)

engine = ExperimentEngine(config)
result = engine.run_experiment()
print(result)
