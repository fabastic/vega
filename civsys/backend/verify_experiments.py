import sys
from app.simulation.experiments.interpreter import HypothesisInterpreter
from app.simulation.experiments.runner import ExperimentEngine

queries = [
    ("Drought", "What if there is a drought?"),
    ("Famine", "What if a famine occurs?"),
    ("Flood in one region", "What if a flood hits the northern forest?"),
    ("Earthquake in one region", "What if an earthquake hits the eastern crags?"),
    ("Resource discovery", "What if we discover a new metal mine?"),
    ("Electricity delayed 200 years", "What if electricity is discovered 200 years later?"),
    ("Unsupported concept", "What if aliens invade?"),
    ("Social/behavioral hypothesis", "What if we erase all authoritarian behaviour?")
]

interpreter = HypothesisInterpreter()

for name, query in queries:
    print(f"\n{'='*80}")
    print(f"EXPERIMENT: {name}")
    print(f"QUERY: {query}")
    
    res = interpreter.interpret(query)
    print(f"VALID: {res.is_valid}")
    if not res.is_valid:
        print(f"ERROR: {res.error_message}")
        continue
        
    config = res.config
    for inv in config.interventions:
        if inv.start_tick > 0 and inv.operation != "delay_unlock":
            inv.start_tick = 0
    print(f"INTERVENTIONS: {config.interventions}")
    
    # Run short experiment to verify divergence
    config.duration_ticks = 25 # Run for 25 ticks to see divergence
    engine = ExperimentEngine(config)
    try:
        result = engine.run_experiment()
        print(f"CONTROL FINAL FOOD: {result.control_metrics[-1].total_food_produced if result.control_metrics else 'N/A'}")
        print(f"TREATMENT FINAL FOOD: {result.treatment_metrics[-1].total_food_produced if result.treatment_metrics else 'N/A'}")
        print(f"DIVERGENCE: {result.divergence_summary}")
        
        # Verify divergence
        c_food = result.control_metrics[-1].total_food_produced if result.control_metrics else 0
        t_food = result.treatment_metrics[-1].total_food_produced if result.treatment_metrics else 0
        if abs(c_food - t_food) > 0.01:
            print("STATUS: DIVERGED (SUCCESS)")
        else:
            print("STATUS: IDENTICAL (FAILURE - INTERVENTION DID NOT AFFECT FOOD SUPPLY)")
            
    except Exception as e:
        print(f"EXECUTION FAILED: {e}")
