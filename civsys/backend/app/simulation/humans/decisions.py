import numpy as np
from typing import List, Dict
from app.simulation.base import BaseSimulationSystem
from app.simulation.context import SimulationContext
from app.simulation.action import Action, ActionScore
from app.simulation.spatial.spatial import TargetResolver

class DecisionSystem(BaseSimulationSystem):
    """
    Step 6: Decision System
    Bounded Rationality + Controlled Uncertainty.
    Scores utility for candidate actions and delegates target resolution.
    """
    def __init__(self):
        super().__init__(name="DecisionSystem", step_number=6)
        self.candidate_actions = [
            "eat", "work", "rest", "trade_buy", "trade_sell", "migrate", "cooperate_share",
            "learn", "talk", "help", "ask", "explore", "form_relationship",
            "join_group", "leave_group", "cooperate", "compete", "create"
        ]

    def execute(self, context: SimulationContext) -> None:
        for agent in context.state.agents.values():
            if not agent.is_alive:
                continue
                
            # Intent commitment: do not change mind while traveling unless interrupted
            if agent.movement_state == "traveling":
                continue
                
            scores: Dict[str, ActionScore] = {}
            utilities: List[float] = []
            
            # Dynamically determine available actions
            available_actions = self.candidate_actions.copy()
            if "electricity" in context.state.world.active_capabilities:
                available_actions.append("work_mechanized")
                
            for action_type in available_actions:
                score = self._score_action(action_type, agent, context)
                scores[action_type] = score
                utilities.append(score.total_score)
                
            # Softmax selection with temperature T = 0.5
            temp = 0.5
            utility_array = np.array(utilities, dtype=np.float64)
            exp_utilities = np.exp((utility_array - np.max(utility_array)) / temp)
            probabilities = exp_utilities / np.sum(exp_utilities)
            
            chosen_index = context.np_rng.choice(len(available_actions), p=probabilities)
            chosen_action_type = available_actions[chosen_index]
            
            # Assign action and intent
            agent.current_action = chosen_action_type
            agent.action_intent = chosen_action_type
            
            # Resolve Target (Sets target_location and movement_state)
            TargetResolver.resolve(agent, context)
            
            action_obj = Action(
                action_type=chosen_action_type,
                agent_id=agent.id,
                score_breakdown=scores[chosen_action_type]
            )
            context.pending_actions.append(action_obj)

    def _score_action(self, action_type: str, agent, context: SimulationContext) -> ActionScore:
        score = ActionScore()
        
        # Need pressures
        hunger = agent.needs.hunger
        energy = 1.0 - agent.needs.energy
        perceived_price = agent.perception.perceived_food_price
        money = agent.economic.money
        food_inv = agent.economic.food_inventory
        
        # We can increase weights for specific occupations to force distinct test patterns
        occ = agent.economic.occupation
        
        if action_type == "eat":
            if food_inv >= 1.0:
                score.need_benefit = hunger * 2.5
                score.cost = 0.0
            else:
                score.need_benefit = 0.0
                score.cost = 10.0
                
        elif action_type == "work":
            score.need_benefit = 0.5
            score.expected_reward = 1.5
            score.effort = 0.8 * energy
            # Occupation preference
            if occ in ["farmer", "crafter", "miner"]:
                score.expected_reward += 1.0
                
        elif action_type == "work_mechanized":
            score.need_benefit = 0.6
            score.expected_reward = 3.5  # High output expectation
            score.effort = 0.3 * energy  # Low physical effort due to machinery
            if occ in ["farmer", "crafter", "miner"]:
                score.expected_reward += 1.5
            
        elif action_type == "rest":
            score.need_benefit = energy * 2.0
            score.effort = 0.0
            
        elif action_type == "trade_buy":
            if money >= perceived_price:
                score.need_benefit = hunger * 2.0
                score.expected_reward = 1.5
                score.cost = perceived_price * 0.1
            else:
                score.need_benefit = 0.0
                score.cost = 5.0
                
        elif action_type == "trade_sell":
            excess_inv = (agent.economic.food_inventory > 5.0) or (agent.economic.wood_inventory > 2.0) or (agent.economic.stone_inventory > 2.0)
            score.expected_reward = 0.8 if excess_inv else 0.0
            score.effort = 0.05
            score.goal_alignment = 0.5 if (agent.economic.money < 10) else 0.0
                
        elif action_type == "migrate":
            if hunger > 0.8 or perceived_price > 20.0:
                score.need_benefit = (hunger + (perceived_price / 20.0)) * 2.0
                score.emotional_pull = agent.emotions.fear.intensity * 1.5
                score.personality_compat = agent.personality.risk_tolerance * 1.5
                score.cost = 1.0
                score.uncertainty = 0.5
            else:
                score.need_benefit = 0.1
                score.cost = 5.0
                
        elif action_type in ["cooperate_share", "cooperate"]:
            score.personality_compat = agent.personality.agreeableness * 1.5
            score.value_alignment = agent.values.cooperation * 1.2
            if agent.perception.visible_agents:
                score.social_influence = 1.0
            score.cost = 0.5
            
        elif action_type == "talk":
            score.personality_compat = agent.personality.extraversion * 1.5
            score.cost = 0.1
            if agent.perception.visible_agents:
                score.social_influence = 1.0
            
        elif action_type == "compete":
            score.personality_compat = agent.personality.competitiveness * 1.8
            score.emotional_pull = agent.emotions.anger.intensity * 1.2
            score.cost = 0.8
            
        else:
            score.uncertainty = 0.1
            score.cost = 0.1
            
        # Incorporate Learned Beliefs
        belief_key = f"action_{action_type}_utility"
        if belief_key in agent.beliefs:
            belief = agent.beliefs[belief_key]
            # belief.value ranges from 0 to 1 (0.5 is neutral)
            score.memory_evidence = (belief.value - 0.5) * 2.0 * belief.confidence
            
        score.total_score = (
            score.need_benefit +
            score.goal_alignment +
            score.expected_reward +
            score.emotional_pull +
            score.personality_compat +
            score.value_alignment +
            score.social_influence +
            score.memory_evidence +
            score.perceived_success_prob -
            (score.cost + score.risk + score.effort + score.uncertainty)
        )
        return score


