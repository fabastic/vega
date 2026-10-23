from pydantic import BaseModel
from typing import Optional, Tuple

class ActionScore(BaseModel):
    need_benefit: float = 0.0
    goal_alignment: float = 0.0
    expected_reward: float = 0.0
    emotional_pull: float = 0.0
    personality_compat: float = 0.0
    value_alignment: float = 0.0
    social_influence: float = 0.0
    memory_evidence: float = 0.0
    perceived_success_prob: float = 0.0
    cost: float = 0.0
    risk: float = 0.0
    effort: float = 0.0
    uncertainty: float = 0.0
    total_score: float = 0.0

class Action(BaseModel):
    action_type: str
    agent_id: str
    target_id: Optional[str] = None
    target_location: Optional[Tuple[float, float]] = None
    score_breakdown: ActionScore
