# CivSYS backend: code map (Step 1)

Scope: `backend/app/simulation/`, the API layer, and the test suite, as of the
fork's `main` branch (upstream `ashvyagni/CivSYS`). Line counts are approximate.

## 1. Where things live

| Concern | File(s) | Notes |
|---|---|---|
| Tick loop | `engine.py` (`SimulationEngine.step`, `systems` list) | Runs 23 systems in list order. Docstrings say 17 or 18; the list is the truth. |
| Shared state | `state.py` (`SimulationState`), `world.py` (`WorldState`, `MapCell`, `Building`, `MarketPriceIndex`, `Region`) | `SimulationState.agents` is a dict; iteration order is insertion order and matters for RNG. |
| Per-tick context | `context.py` (`SimulationContext`) | Holds `rng` (`random.Random`) and `np_rng` (numpy). Both are shared by all agents. Also `pending_causal_records`, `transient_data`. |
| Agent model | `humans/agent.py` | `AgentState` plus pydantic sub-states: `NeedState`, `PersonalityState` (21 traits), `EmotionState` (19 `Emotion` slots), `ValueState`, `CognitionState`, `BeliefItem`, `Goal`, `MemoryRecord`, `PerceptionState`, `InformationState`, `RelationshipState`, `EconomicState`, `SkillState`. |
| Needs | `humans/needs.py` | Hunger +0.008/tick, thirst +0.015/tick, sleep +0.02/tick. Health falls 0.02/tick while hunger > 0.85 or thirst > 0.92. |
| Emotions | `humans/emotions.py` | Exponential decay for all 19 channels. Only `anxiety`, `fear`, and `happiness` are driven here. Other channels are touched in `economy/production.py` (`frustration`, `curiosity`), `decisions.py` (`fear`, `anger`), `social/relationships.py` (none). |
| Memory | `humans/memory.py`, memories created in `economy/production.py` | Episodic records with `event_type` like `action_eat_success`. Decay per record, pruned at confidence ≤ 0.1. |
| Learning / beliefs | `humans/learning.py`, `civilization/society.py` (`CultureBeliefSystem`) | Learning updates `action_<x>_utility` beliefs from tick-1 memories. |
| Perception | `humans/perception.py` | Radius-5 disc (dx²+dy² ≤ 25) over cells, agents, and buildings. Bucketed grids. Known buildings persist in `information.known_buildings`. |
| Goals | `humans/goals.py` | `acquire_food` (hunger > 0.4), `earn_income`, `start_family`. |
| Decisions | `humans/decisions.py` (`DecisionSystem`) | 18 candidate actions. Utility is a sum of terms minus costs. Softmax with T = 0.5 via `np_rng.choice`. Agents with `movement_state == "traveling"` are skipped. `explore` and `learn` fall through to a generic score. |
| Targets | `spatial/spatial.py` (`TargetResolver`, `DirectPathPlanner`) | Maps intent to a building, agent, or location. Talk and cooperate targets are drawn with `context.rng`. |
| Movement | `spatial/movement.py` | Straight-line steps of 1.5 cells/tick, separation force, clamped to world bounds. |
| Actions | `economy/production.py` (`ActionSystem`) | Effects of eat, work (by occupation and terrain), rest, learn, explore, migrate. Work failures fall back to free "subsistence" food. |
| Interactions | `social/relationships.py` (`InteractionSystem`) | trade_buy, trade_sell, cooperate_share, talk (shares memories and beliefs), compete. |
| Markets | `economy/markets.py` (`EconomySystem`) | EMA price clearing with gamma = 0.15. Emits `price_spike` causal records. |
| Technology | `economy/technology.py` | Accumulates `tech_progress`; unlocks `electricity` past 1000. |
| Social / groups / institutions | `social/influence.py`, `social/groups.py`, `civilization/society.py` (`InstitutionSystem`) | Familiarity, community cohesion, food redistribution from wealthy to starving agents in cohesive groups. |
| Events | `events.py`, `registry.py` (`SimulationOntology`) | `ActiveEvent` applies a mechanism to `world.*` fields (e.g. `crop_yield_multiplier`). Restores defaults on expiry. |
| Population | `civilization/population.py` | Death at health ≤ 0. Migration movement. |
| Lifecycle | `civilization/lifecycle.py` | Starvation death at hunger > 0.95 (immediate). Aging every 100 ticks. Births every 10 ticks, using `context.rng`. |
| Metrics | `civilization/metrics.py` (`MetricsSnapshot`) | One snapshot per tick into `state.metrics_history`. |
| Causality | `experiments/causality.py`, `causal` records via `context.log_causal_event`, `causality` wiring in `CausalSystem` | Append-only `state.causal_ledger`. |
| Snapshot / clock | `snapshot.py` (`SnapshotSystem`) | Increments `state.tick` at the END of the tick. Sets `needs_db_snapshot` every 24 ticks. |
| Experiments | `experiments/runner.py` (`ExperimentEngine`), `presets.py`, `interpreter.py`, `comparison.py` (empty) | Builds two engines from the same seed (control and treatment). Steps both for `duration_ticks`. Applies interventions at `start_tick` and reverts at `end_tick`. Interventions target events, capabilities, or world parameters. There is no deprivation hook. |
| API | `app/api/router.py`, `app/api/endpoints/simulation.py`, `experiments.py`, `app/api/websocket.py` | In-memory `active_simulations` dict keyed by `sim_id`. WebSocket `/api/simulation/ws` calls `engine.step()` itself when `is_running`. |
| Persistence | `app/db/` (`session.py`, `models.py`, `crud.py`) | Snapshot flush every 24 ticks. `session.py` switches to `sqlite:///./civsys.db` whenever the URI points at `localhost:5432` (unless `USE_POSTGRES_LOCAL` is set). Importing `app.main` creates that file in the current directory. Not on the experiment path. |
| Config | `app/config.py` | `DEFAULT_SEED = 42`. |
| Tests | `backend/tests/` | `test_engine_determinism.py` (hash equality, intervention divergence), `test_drought_experiment.py`, `test_api.py`, `test_schemas.py`. Also `run_full_verification.py` and `verify_experiments.py` at backend root (scripts, not pytest). |

## 2. Data flow per tick

Order is the `systems` list in `engine.py`. Each step reads and writes `context.state`.
`context.tick` is the tick being computed; `SnapshotSystem` increments the counter at the end.

```
1  WorldSystem        weather from crop_yield_multiplier; cell fertility; food regrowth
2  PerceptionSystem   each agent: visible cells, agents, buildings; perceived market price
3  NeedsSystem        hunger, thirst, sleep up; energy down unless resting; health loss when starving
4  EmotionSystem      decay of all emotion channels; hunger pushes anxiety, fear, happiness
5  MemorySystem       memory confidence decays; forgetting below 0.1
6  LearningSystem     tick-1 memories update action_*_utility beliefs
7  GoalSystem         goal priorities from hunger; completion
8  DecisionSystem     utility per candidate action; softmax (np_rng); target resolution (context.rng)
9  MovementSystem     advance toward target; separation; arrival flag
10 ActionSystem       effects of arrived actions; writes memories and some emotions
11 InteractionSystem  trades; sharing; talk (memory and belief transfer); compete
12 EconomySystem      supply/demand EMA; prices; price_spike records
13 TechnologySystem   tech_progress from learning; electricity unlock
14 SocialSystem       familiarity with visible neighbours
15 GroupSystem        community membership; cohesion
16 InstitutionSystem  redistribution in cohesive groups
17 CultureBeliefSystem food_security belief; learning from memories (see bug note)
18 EventSystem        apply active events to world fields; restore on expiry
19 PopulationSystem   death at health ≤ 0; migration movement
20 LifecycleSystem    starvation death (hunger > 0.95); aging; births every 10 ticks
21 MetricsSystem      MetricsSnapshot appended
22 CausalSystem       attach pending causal records to the latest drought record
23 SnapshotSystem     state.tick += 1; DB flush flag every 24 ticks
```

Cross-cutting data facts that constrain new work:

- **RNG coupling.** `context.rng` (random.Random) is drawn by TargetResolver (talk, cooperate, compete), InteractionSystem (talk, compete), LifecycleSystem (births and mortality), PopulationSystem (migration targets), and InstitutionSystem. `np_rng` is drawn by DecisionSystem once per living agent per tick. Adding or removing any draw, for any agent, shifts every later draw in the run. This is the main source of counterfactual artifacts.
- **Agent iteration order** is dict insertion order. Births append to the end of the dict.
- **Perception is the only route to other agents.** Interaction targets come from `perception.visible_agents`, and some lookups go through `state.agents.get`. Removing an agent from the dict changes other agents' behaviour, not just its own.
- **Memory is copied between agents** (talk in `relationships.py`). An isolated agent that stops talking stops transmitting memories.
- **Starvation is fast.** Hunger reaches the lifecycle death threshold about 100 ticks after the last meal. Thirst is only reduced by eating. See Section 3.

## 3. Facts that affect the experiment design

1. **Full deprivation with no homeostatic support kills the agent in about 4 days.** Measured in an isolated run: starvation death at tick 99 from a hunger start of 0.15. Thirst reaches 1.0 by then and health is 0.22. Thirst is never reduced without eating, so the death happens within roughly 100 ticks however long the room lasts. A 7-day post-trigger window would be cut short.
2. **Affect is almost unmodelled.** Only three of 19 emotion channels drive behaviour. There is no valence, arousal, or dominance, and no mood.
3. **There is no neuroticism trait.** `PersonalityState` has `emotional_stability` (use 1 − it as neuroticism) and `conscientiousness`.
4. **Memory-sharing bug (pre-existing).** `CultureBeliefSystem` checks `event_type == "work_success"`. Real records are `action_work_success`, so that branch never runs. Left untouched in this fork; flagged for the user.
5. **Pre-existing test-environment gap.** The current Starlette `TestClient` needs `httpx2`, which `backend/requirements.txt` does not list. `test_api.py` fails at import without it. Baseline with `httpx2` installed: 10 passed.
6. **Speed (measured, 128×128 world, Python 3.14, this machine):** 0.014 s/tick at 50 agents, 0.031 s/tick at 150, 0.124 s/tick at 400. A 30-day trunk (720 ticks) plus a 7-day branch at 150 agents is about 30 s per run.
7. **`ExperimentEngine` runs both branches from tick 0.** A branch at tick T therefore needs either a checkpoint of the engine or a replay from the seed. See SPEC §A.4 (CivSYS checkpoint for the in-civilization control).
8. **The engine is not copy-safe as is.** `context.rng` and `engine.rng` are the same object, and `context` holds `state`. A deep copy must be taken as one object graph so the references stay aligned.

## 4. Upstream licence status

No `LICENSE` file exists upstream (`ashvyagni/CivSYS`) and the GitHub API reports no licence. Constraint 4 applies: a NOTICE file is required. The draft text is in [SPEC.md §G.2](../SPEC.md#g2-notice-text). The fork is currently public (see SPEC §0.1, D7).
