from app.simulation.base import BaseSimulationSystem
from app.simulation.context import SimulationContext
from app.simulation.humans.agent import Goal, GoalTimescale

class GoalSystem(BaseSimulationSystem):
    """
    Step 5: Goal System
    Re-evaluates competing goal priorities and deadlines based on need pressures and values.
    """
    def __init__(self):
        super().__init__(name="GoalSystem", step_number=5)

    def execute(self, context: SimulationContext) -> None:
        for agent in context.state.agents.values():
            if not agent.is_alive:
                continue
                
            # Dynamic immediate goal prioritization based on hunger
            if agent.needs.hunger > 0.4:
                # Prioritize food acquisition goal
                food_goal = next((g for g in agent.goals if g.name == "acquire_food"), None)
                if not food_goal:
                    food_goal = Goal(id=f"g_food_{agent.id}", name="acquire_food", timescale=GoalTimescale.IMMEDIATE, priority=0.9, urgency=0.9)
                    agent.goals.append(food_goal)
                else:
                    food_goal.priority = min(1.0, agent.needs.hunger + 0.2)
                    food_goal.urgency = agent.needs.hunger
            else:
                food_goal = next((g for g in agent.goals if g.name == "acquire_food"), None)
                if food_goal:
                    food_goal.completed = True

            # Normal work/rest balance goal
            work_goal = next((g for g in agent.goals if g.name == "earn_income"), None)
            if not work_goal:
                agent.goals.append(Goal(id=f"g_work_{agent.id}", name="earn_income", timescale=GoalTimescale.SHORT_TERM, priority=0.6, urgency=0.5))
            else:
                work_goal.progress = min(1.0, agent.economic.money / 200.0)
                if work_goal.progress >= 1.0:
                    work_goal.completed = True
                    
            # Long term goals
            family_goal = next((g for g in agent.goals if g.name == "start_family"), None)
            if not family_goal and agent.values.family > 0.6:
                agent.goals.append(Goal(id=f"g_fam_{agent.id}", name="start_family", timescale=GoalTimescale.LONG_TERM, priority=agent.values.family, urgency=0.1))
                
            # Remove completed goals
            agent.goals = [g for g in agent.goals if not g.completed]


