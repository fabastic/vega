export interface NeedState {
  hunger: number;
  thirst: number;
  energy: number;
  sleep_need: number;
  health: number;
  safety: number;
  pain: number;
  immune_strength: number;
}

export interface PersonalityState {
  openness: number;
  conscientiousness: number;
  extraversion: number;
  agreeableness: number;
  emotional_stability: number;
  ambition: number;
  curiosity: number;
  risk_tolerance: number;
  patience: number;
  impulsiveness: number;
  competitiveness: number;
  conformity: number;
  independence: number;
  generosity: number;
  loyalty: number;
  adaptability: number;
  persistence: number;
  status_drive: number;
  leadership_tendency: number;
  conflict_tolerance: number;
  frugality: number;
}

export interface Emotion {
  intensity: number;
  source?: string;
  target?: string;
  timestamp: number;
  decay: number;
}

export interface EmotionState {
  happiness: Emotion;
  sadness: Emotion;
  fear: Emotion;
  anger: Emotion;
  anxiety: Emotion;
  excitement: Emotion;
  frustration: Emotion;
  hope: Emotion;
  pride: Emotion;
  shame: Emotion;
  guilt: Emotion;
  curiosity: Emotion;
  surprise: Emotion;
  trust: Emotion;
  suspicion: Emotion;
  loneliness: Emotion;
  envy: Emotion;
  gratitude: Emotion;
  resentment: Emotion;
}

export interface ValueState {
  family: number;
  freedom: number;
  security: number;
  wealth: number;
  knowledge: number;
  status: number;
  tradition: number;
  equality: number;
  community: number;
  achievement: number;
  fairness: number;
  authority: number;
  cooperation: number;
}

export interface CognitionState {
  intelligence: number;
  reasoning: number;
  learning_rate: number;
  planning: number;
  creativity: number;
  problem_solving: number;
  pattern_recognition: number;
  communication: number;
  attention: number;
  concentration: number;
  working_memory: number;
  memory_capacity: number;
  self_awareness: number;
  perspective_taking: number;
}

export interface BeliefItem {
  subject: string;
  value: number;
  confidence: number;
  source: string;
  updated_tick: number;
}

export interface Goal {
  id: string;
  name: string;
  timescale: 'immediate' | 'short_term' | 'long_term' | 'life';
  priority: number;
  urgency: number;
  progress: number;
  expected_value: number;
  completed: boolean;
}

export interface MemoryRecord {
  id: string;
  tick: number;
  memory_type: 'episodic' | 'semantic' | 'social' | 'procedural';
  event_type: string;
  description: string;
  emotional_weight: number;
  importance: number;
  confidence: number;
  source: string;
  associated_agent_id?: string;
  location: [number, number];
  decay: number;
}

export interface PerceptionState {
  visible_cells: [number, number][];
  visible_agents: string[];
  perceived_food_price: number;
  perceived_food_abundance: number;
}

export interface InformationState {
  known_farms: [number, number][];
  known_markets: [number, number][];
  known_opportunities: string[];
}

export interface RelationshipState {
  target_id: string;
  trust: number;
  affection: number;
  respect: number;
  loyalty: number;
  conflict: number;
  familiarity: number;
  influence: number;
}

export interface ReputationState {
  trustworthiness: number;
  contributions: number;
}

export interface SocialIdentity {
  family_id?: string;
  community_id: string;
  workplace_id?: string;
}

export interface SkillState {
  farming: number;
  gathering: number;
  woodcutting: number;
  mining: number;
  crafting: number;
  trading: number;
}

export interface EconomicState {
  money: number;
  food_inventory: number;
  wood_inventory: number;
  stone_inventory: number;
  metal_inventory: number;
  tools_inventory: number;
  income: number;
  expenses: number;
  occupation: string;
}

export interface AgentState {
  id: string;
  name: string;
  age: number;
  gender: string;
  home_location: [number, number];
  current_location: [number, number];
  target_location?: [number, number];
  visual_profile: string;
  
  needs: NeedState;
  personality: PersonalityState;
  emotions: EmotionState;
  values: ValueState;
  cognition: CognitionState;
  skills: SkillState;
  beliefs: Record<string, BeliefItem>;
  goals: Goal[];
  memories: MemoryRecord[];
  perception: PerceptionState;
  information: InformationState;
  relationships: Record<string, RelationshipState>;
  reputation: ReputationState;
  social_identity: SocialIdentity;
  economic: EconomicState;
  
  current_action: string;
  action_intent?: string;
  target_type?: string;
  target_entity_id?: string;
  movement_state: string;
  
  is_migrating: boolean;
  is_alive: boolean;
}

export interface MapCell {
  x: number;
  y: number;
  elevation: number;
  terrain_type: string;
  fertility: number;
  moisture: number;
  temperature: number;
  region_id?: string;
  food_resources: number;
  wood_resources: number;
  stone_resources: number;
  metal_resources: number;
  building_id?: string;
}

export interface Building {
  id: string;
  name: string;
  building_type: string;
  x: number;
  y: number;
  capacity: number;
  owner_id?: string;
}

export interface MarketPriceIndex {
  food_price: number;
  food_supply: number;
  food_demand: number;
  wood_price: number;
  wood_supply: number;
  wood_demand: number;
  stone_price: number;
  stone_supply: number;
  stone_demand: number;
  metal_price: number;
  metal_supply: number;
  metal_demand: number;
  tools_price: number;
  tools_supply: number;
  tools_demand: number;
}

export interface WorldBounds {
  width: number;
  height: number;
}

export interface TerrainCellSnapshot {
  x: number;
  y: number;
  terrain_type: string;
  region_id: string | null;
}

export interface BuildingSnapshot {
  id: string;
  name: string;
  building_type: string;
  x: number;
  y: number;
  capacity: number;
  owner_id: string | null;
  region_id: string | null;
  settlement_id: string | null;
}

export interface WorldState {
  width: number;
  height: number;
  weather: string;
  temperature: number;
  crop_yield_multiplier: number;
  cells: MapCell[];
  buildings: Building[];
  market: MarketPriceIndex;
}

export interface Event {
  id: string;
  event_type: string;
  target_region: string;
  severity: number;
  start_tick: number;
  duration: number;
  is_active: boolean;
  parameters: Record<string, any>;
}

export interface ActionScore {
  need_benefit: number;
  goal_alignment: number;
  expected_reward: number;
  emotional_pull: number;
  personality_compat: number;
  value_alignment: number;
  social_influence: number;
  memory_evidence: number;
  perceived_success_prob: number;
  cost: number;
  risk: number;
  effort: number;
  uncertainty: number;
  total_score: number;
}

export interface Action {
  action_type: string;
  agent_id: string;
  target_id?: string;
  target_location?: [number, number];
  score_breakdown: ActionScore;
}

export interface MetricsSnapshot {
  tick: number;
  population: number;
  living_population: number;
  migrated_count: number;
  death_count: number;
  total_food_produced: number;
  food_price_index: number;
  average_wealth: number;
  average_hunger: number;
  average_stress: number;
  social_cohesion_index: number;
}

export interface CausalRecord {
  event_id: string;
  source_event_id?: string;
  subject_id: string;
  event_type: string;
  previous_state: Record<string, any>;
  new_state: Record<string, any>;
  reason: string;
  related_event_ids: string[];
  tick: number;
}

export interface InterventionScope {
  scope_type: string;
  target_id: string | null;
}

export interface Intervention {
  target: string;
  operation: string;
  value: any;
  start_tick: number;
  end_tick: number;
  scope: InterventionScope;
}

export interface ExperimentConfig {
  id: string;
  name: string;
  seed: number;
  population_size: number;
  world_width: number;
  world_height: number;
  duration_ticks: number;
  interventions: Intervention[];
}

export interface ExperimentResult {
  experiment_id: string;
  control_metrics: MetricsSnapshot[];
  treatment_metrics: MetricsSnapshot[];
  divergence_summary: Record<string, number>;
}

export interface AgentPosPayload {
  id: string;
  name: string;
  x: number;
  y: number;
  visual_profile: string;
  current_action: string;
  health: number;
  hunger: number;
  is_migrating: boolean;
  chat_bubble?: string;
}

export interface WebSocketStatePayload {
  simulation_id: string;
  tick: number;
  is_running: boolean;
  weather: string;
  crop_yield_multiplier: number;
  food_price: number;
  agents: AgentPosPayload[];
  buildings?: any[];
  latest_metrics: MetricsSnapshot | null;
}
