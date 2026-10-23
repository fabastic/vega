from pydantic import BaseModel, Field
from typing import List, Dict, Optional, Tuple
from enum import Enum

class GoalTimescale(str, Enum):
    IMMEDIATE = "immediate"
    SHORT_TERM = "short_term"
    LONG_TERM = "long_term"
    LIFE = "life"

class NeedState(BaseModel):
    hunger: float = Field(default=0.0, ge=0.0, le=1.0, description="0 = full, 1 = starving")
    thirst: float = Field(default=0.0, ge=0.0, le=1.0, description="0 = quenched, 1 = dehydrated")
    energy: float = Field(default=1.0, ge=0.0, le=1.0, description="1 = energetic, 0 = exhausted")
    sleep_need: float = Field(default=0.0, ge=0.0, le=1.0, description="0 = rested, 1 = exhausted")
    health: float = Field(default=1.0, ge=0.0, le=1.0, description="1 = healthy, 0 = deceased")
    safety: float = Field(default=1.0, ge=0.0, le=1.0, description="1 = safe, 0 = endangered")
    pain: float = Field(default=0.0, ge=0.0, le=1.0, description="0 = no pain, 1 = agony")
    immune_strength: float = Field(default=1.0, ge=0.0, le=1.0, description="1 = strong, 0 = weak")

    def calculate_pressures(self) -> Dict[str, float]:
        return {
            "hunger": self.hunger,
            "thirst": self.thirst,
            "energy": 1.0 - self.energy,
            "sleep_need": self.sleep_need,
            "health": 1.0 - self.health,
            "safety": 1.0 - self.safety,
            "pain": self.pain,
            "immune_weakness": 1.0 - self.immune_strength
        }

class PersonalityState(BaseModel):
    openness: float = Field(default=0.5, ge=0.0, le=1.0)
    conscientiousness: float = Field(default=0.5, ge=0.0, le=1.0)
    extraversion: float = Field(default=0.5, ge=0.0, le=1.0)
    agreeableness: float = Field(default=0.5, ge=0.0, le=1.0)
    emotional_stability: float = Field(default=0.5, ge=0.0, le=1.0)
    ambition: float = Field(default=0.5, ge=0.0, le=1.0)
    curiosity: float = Field(default=0.5, ge=0.0, le=1.0)
    risk_tolerance: float = Field(default=0.5, ge=0.0, le=1.0)
    patience: float = Field(default=0.5, ge=0.0, le=1.0)
    impulsiveness: float = Field(default=0.5, ge=0.0, le=1.0)
    competitiveness: float = Field(default=0.5, ge=0.0, le=1.0)
    conformity: float = Field(default=0.5, ge=0.0, le=1.0)
    independence: float = Field(default=0.5, ge=0.0, le=1.0)
    generosity: float = Field(default=0.5, ge=0.0, le=1.0)
    loyalty: float = Field(default=0.5, ge=0.0, le=1.0)
    adaptability: float = Field(default=0.5, ge=0.0, le=1.0)
    persistence: float = Field(default=0.5, ge=0.0, le=1.0)
    status_drive: float = Field(default=0.5, ge=0.0, le=1.0)
    leadership_tendency: float = Field(default=0.5, ge=0.0, le=1.0)
    conflict_tolerance: float = Field(default=0.5, ge=0.0, le=1.0)
    frugality: float = Field(default=0.5, ge=0.0, le=1.0)

class Emotion(BaseModel):
    intensity: float = 0.0
    source: Optional[str] = None
    target: Optional[str] = None
    timestamp: int = 0
    decay: float = 0.05

class EmotionState(BaseModel):
    happiness: Emotion = Field(default_factory=Emotion)
    sadness: Emotion = Field(default_factory=Emotion)
    fear: Emotion = Field(default_factory=Emotion)
    anger: Emotion = Field(default_factory=Emotion)
    anxiety: Emotion = Field(default_factory=Emotion)
    excitement: Emotion = Field(default_factory=Emotion)
    frustration: Emotion = Field(default_factory=Emotion)
    hope: Emotion = Field(default_factory=Emotion)
    pride: Emotion = Field(default_factory=Emotion)
    shame: Emotion = Field(default_factory=Emotion)
    guilt: Emotion = Field(default_factory=Emotion)
    curiosity: Emotion = Field(default_factory=Emotion)
    surprise: Emotion = Field(default_factory=Emotion)
    trust: Emotion = Field(default_factory=Emotion)
    suspicion: Emotion = Field(default_factory=Emotion)
    loneliness: Emotion = Field(default_factory=Emotion)
    envy: Emotion = Field(default_factory=Emotion)
    gratitude: Emotion = Field(default_factory=Emotion)
    resentment: Emotion = Field(default_factory=Emotion)

class ValueState(BaseModel):
    family: float = Field(default=0.5, ge=0.0, le=1.0)
    freedom: float = Field(default=0.5, ge=0.0, le=1.0)
    security: float = Field(default=0.5, ge=0.0, le=1.0)
    wealth: float = Field(default=0.5, ge=0.0, le=1.0)
    knowledge: float = Field(default=0.5, ge=0.0, le=1.0)
    status: float = Field(default=0.5, ge=0.0, le=1.0)
    tradition: float = Field(default=0.5, ge=0.0, le=1.0)
    equality: float = Field(default=0.5, ge=0.0, le=1.0)
    community: float = Field(default=0.5, ge=0.0, le=1.0)
    achievement: float = Field(default=0.5, ge=0.0, le=1.0)
    fairness: float = Field(default=0.5, ge=0.0, le=1.0)
    authority: float = Field(default=0.5, ge=0.0, le=1.0)
    cooperation: float = Field(default=0.5, ge=0.0, le=1.0)

class CognitionState(BaseModel):
    intelligence: float = Field(default=0.5, ge=0.0, le=1.0)
    reasoning: float = Field(default=0.5, ge=0.0, le=1.0)
    learning_rate: float = Field(default=0.5, ge=0.0, le=1.0)
    planning: float = Field(default=0.5, ge=0.0, le=1.0)
    creativity: float = Field(default=0.5, ge=0.0, le=1.0)
    problem_solving: float = Field(default=0.5, ge=0.0, le=1.0)
    pattern_recognition: float = Field(default=0.5, ge=0.0, le=1.0)
    communication: float = Field(default=0.5, ge=0.0, le=1.0)
    attention: float = Field(default=0.5, ge=0.0, le=1.0)
    concentration: float = Field(default=0.5, ge=0.0, le=1.0)
    working_memory: float = Field(default=0.5, ge=0.0, le=1.0)
    memory_capacity: float = Field(default=0.5, ge=0.0, le=1.0)
    self_awareness: float = Field(default=0.5, ge=0.0, le=1.0)
    perspective_taking: float = Field(default=0.5, ge=0.0, le=1.0)

class BeliefItem(BaseModel):
    subject: str
    value: float = 0.5
    confidence: float = 0.5
    source: str = "observation"
    updated_tick: int = 0

class Goal(BaseModel):
    id: str
    name: str
    timescale: GoalTimescale = GoalTimescale.IMMEDIATE
    priority: float = 0.5
    urgency: float = 0.5
    progress: float = 0.0
    expected_value: float = 0.5
    completed: bool = False

class MemoryType(str, Enum):
    EPISODIC = "episodic"
    SEMANTIC = "semantic"
    SOCIAL = "social"
    PROCEDURAL = "procedural"

class MemoryRecord(BaseModel):
    id: str
    tick: int
    memory_type: MemoryType = MemoryType.EPISODIC
    event_type: str
    description: str
    emotional_weight: float = 0.0
    importance: float = 0.5
    confidence: float = 1.0
    source: str = "direct_experience"
    associated_agent_id: Optional[str] = None
    location: Tuple[float, float] = (0.0, 0.0)
    decay: float = 0.01

class PerceptionState(BaseModel):
    visible_cells: List[Tuple[int, int]] = Field(default_factory=list)
    visible_agents: List[str] = Field(default_factory=list)
    perceived_food_price: float = 10.0
    perceived_food_abundance: float = 1.0

class InformationState(BaseModel):
    known_farms: List[Tuple[int, int]] = Field(default_factory=list)
    known_markets: List[Tuple[int, int]] = Field(default_factory=list)
    known_opportunities: List[str] = Field(default_factory=list)
    known_buildings: Dict[str, dict] = Field(default_factory=dict)

class RelationshipState(BaseModel):
    target_id: str
    trust: float = Field(default=0.5, ge=0.0, le=1.0)
    affection: float = Field(default=0.5, ge=0.0, le=1.0)
    respect: float = Field(default=0.5, ge=0.0, le=1.0)
    loyalty: float = Field(default=0.5, ge=0.0, le=1.0)
    conflict: float = Field(default=0.0, ge=0.0, le=1.0)
    familiarity: float = Field(default=0.1, ge=0.0, le=1.0)
    influence: float = Field(default=0.5, ge=0.0, le=1.0)

class ReputationState(BaseModel):
    trustworthiness: float = Field(default=0.5, ge=0.0, le=1.0)
    contributions: int = 0

class SocialIdentity(BaseModel):
    family_id: Optional[str] = None
    community_id: Optional[str] = None
    workplace_id: Optional[str] = None
    life_stage: str = "adult"
    parents: List[str] = Field(default_factory=list)
    cause_of_death: Optional[str] = None
    death_tick: Optional[int] = None
    birth_tick: int = 0

class SkillState(BaseModel):
    farming: float = Field(default=0.1, ge=0.0, le=1.0)
    gathering: float = Field(default=0.1, ge=0.0, le=1.0)
    woodcutting: float = Field(default=0.1, ge=0.0, le=1.0)
    mining: float = Field(default=0.1, ge=0.0, le=1.0)
    crafting: float = Field(default=0.1, ge=0.0, le=1.0)
    trading: float = Field(default=0.1, ge=0.0, le=1.0)

class EconomicState(BaseModel):
    money: float = 100.0
    food_inventory: float = 10.0
    wood_inventory: float = 0.0
    stone_inventory: float = 0.0
    metal_inventory: float = 0.0
    tools_inventory: float = 0.0
    income: float = 0.0
    expenses: float = 0.0
    occupation: str = "farmer"

class AgentState(BaseModel):
    id: str
    name: str
    age: int = 25
    gender: str = "neutral"
    home_location: Tuple[float, float] = (0.0, 0.0)
    current_location: Tuple[float, float] = (0.0, 0.0)
    target_location: Optional[Tuple[float, float]] = None
    visual_profile: str = "worker_01"
    
    needs: NeedState = Field(default_factory=NeedState)
    personality: PersonalityState = Field(default_factory=PersonalityState)
    emotions: EmotionState = Field(default_factory=EmotionState)
    values: ValueState = Field(default_factory=ValueState)
    cognition: CognitionState = Field(default_factory=CognitionState)
    skills: SkillState = Field(default_factory=SkillState)
    beliefs: Dict[str, BeliefItem] = Field(default_factory=dict)
    goals: List[Goal] = Field(default_factory=list)
    memories: List[MemoryRecord] = Field(default_factory=list)
    perception: PerceptionState = Field(default_factory=PerceptionState)
    information: InformationState = Field(default_factory=InformationState)
    relationships: Dict[str, RelationshipState] = Field(default_factory=dict)
    reputation: ReputationState = Field(default_factory=ReputationState)
    social_identity: SocialIdentity = Field(default_factory=SocialIdentity)
    economic: EconomicState = Field(default_factory=EconomicState)
    
    current_action: str = "idle"
    action_intent: Optional[str] = None
    target_type: Optional[str] = None
    target_entity_id: Optional[str] = None
    target_location: Optional[Tuple[float, float]] = None
    movement_state: str = "idle" # idle, traveling, arrived
    home_building_id: Optional[str] = None
    
    is_migrating: bool = False
    is_alive: bool = True
