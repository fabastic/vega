import argparse
import sys
import os

# Add backend to path so we can import app
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), 'backend')))

from app.simulation.engine import SimulationEngine
from app.simulation.humans.decisions import DecisionSystem
from app.simulation.experiments.runner import ExperimentEngine, ExperimentConfig
from app.simulation.events import Event

def format_agent(agent, engine):
    print(f"TICK {engine.state.tick} | DAY {engine.state.tick // 24 + 1} | YEAR {engine.state.tick // (24 * 365) + 1}\n")
    print(f"AGENT {agent.id}")
    print(f"  Action: {agent.current_action}")
    print(f"  Hunger: {agent.needs.hunger:.2f}")
    print(f"  Energy: {agent.needs.energy:.2f}")
    print(f"  Health: {agent.needs.health:.2f}")
    print(f"  Money: {agent.economic.money:.0f}")
    print(f"  Food: {agent.economic.food_inventory:.0f}\n")
    
    print("  Beliefs:")
    if not agent.beliefs:
        print("    (none)")
    for k, b in agent.beliefs.items():
        print(f"    {k}: {b.value:.2f}")
    print("")
    
    print("  Relationships:")
    if not agent.relationships:
        print("    (none)")
    for target_id, rel in agent.relationships.items():
        print(f"    {target_id}: trust {rel.trust:.2f}")
    print("")

    print("  Decision utilities (Transient calculation):")
    # In Review 1, utilities are not permanently saved on the agent state.
    # We instantiate the DecisionSystem purely to expose the mathematical evaluation.
    decision_sys = DecisionSystem()
    context = engine.context
    
    candidates = ["eat", "work", "rest", "migrate", "cooperate_share"]
    for action in candidates:
        score = decision_sys._score_action(action, agent, context)
        marker = "  <- selected" if action == agent.current_action else ""
        print(f"    {action}: {score.total_score:.2f}{marker}")


def cmd_inspect(agent_id, ticks):
    engine = SimulationEngine(seed=42, population_size=50)
    for _ in range(ticks):
        engine.step()
    
    agent = engine.state.agents.get(agent_id)
    if not agent:
        print(f"Error: Agent {agent_id} not found.")
        return
    
    format_agent(agent, engine)


def cmd_interaction():
    engine = SimulationEngine(seed=42, population_size=5)
    
    agent_a = engine.state.agents["agent_0000"]
    agent_b = engine.state.agents["agent_0001"]
    
    print("Agent A → cooperate/share → Agent B\n")
    
    # tick 0
    trust_before = agent_a.relationships.get("agent_0001").trust if "agent_0001" in agent_a.relationships else 0.5
    rep_before = agent_b.reputation.trustworthiness
    print("Before:")
    print(f"  A trust(B): {trust_before:.2f}")
    print(f"  B reputation: {rep_before:.2f}\n")
    
    # Step simulation so interaction can happen
    engine.step()
    
    trust_after = agent_a.relationships.get("agent_0001").trust if "agent_0001" in agent_a.relationships else 0.5
    rep_after = agent_b.reputation.trustworthiness
    
    print("After:")
    print(f"  A trust(B): {trust_after:.2f}")
    print(f"  B reputation: {rep_after:.2f}")


def cmd_drought():
    config = ExperimentConfig(
        id="exp_demo",
        seed=42,
        population_size=30,
        world_width=64,
        world_height=64,
        intervention_tick=10
    )
    
    print("Running Drought Experiment (Control vs Treatment) for 40 ticks...")
    experiment = ExperimentEngine(config)
    result = experiment.run_experiment(total_ticks=40)
    
    print("\n                    CONTROL       TREATMENT")
    
    # Fetch final metrics
    ctrl_m = result.control_metrics[-1]
    trt_m = result.treatment_metrics[-1]
    
    # Current Review 1 metrics mapping
    print(f"Food production     {getattr(ctrl_m, 'total_food_produced', 0.0):<13.2f} {getattr(trt_m, 'total_food_produced', 0.0):.2f}")
    print(f"Food price          {getattr(ctrl_m, 'food_price_index', 0.0):<13.2f} {getattr(trt_m, 'food_price_index', 0.0):.2f}")
    print(f"Average hunger      {getattr(ctrl_m, 'average_hunger', 0.0):<13.2f} {getattr(trt_m, 'average_hunger', 0.0):.2f}")
    print(f"Average stress      {getattr(ctrl_m, 'average_stress', 0.0):<13.2f} {getattr(trt_m, 'average_stress', 0.0):.2f}")
    print(f"Living Population   {getattr(ctrl_m, 'living_population', 0):<13} {getattr(trt_m, 'living_population', 0)}")
    
    print("\n=== CAUSAL LEDGER (Treatment Branch, Last 5 Transitions) ===")
    
    ledger = experiment.treatment_engine.state.causal_ledger
    if not ledger:
        print("No causal transitions recorded.")
    else:
        for entry in ledger[-5:]:
            print(f"{entry.event_type} | {entry.subject_id} | reason: {entry.reason}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Civilization Systems Review 1 Demo CLI")
    subparsers = parser.add_subparsers(dest="command")
    
    p_inspect = subparsers.add_parser("inspect", help="Inspect an agent state")
    p_inspect.add_argument("agent_id", type=str, help="e.g. agent_0000")
    p_inspect.add_argument("--ticks", type=int, default=10, help="Ticks to run before inspecting")
    
    p_interact = subparsers.add_parser("interaction", help="Demonstrate interaction between agents")
    
    p_drought = subparsers.add_parser("drought", help="Run the Control vs Treatment Drought experiment")
    
    args = parser.parse_args()
    
    if args.command == "inspect":
        cmd_inspect(args.agent_id, args.ticks)
    elif args.command == "interaction":
        cmd_interaction()
    elif args.command == "drought":
        cmd_drought()
    else:
        parser.print_help()
