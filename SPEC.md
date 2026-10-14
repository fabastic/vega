# SPEC: White-room sensory deprivation of a simulated embodied agent

Status: **DRAFT v3 for review. Nothing is implemented yet.**

- v3 adds bounded, harness-controlled **mind growth**, a **reflection module**, a **learned mind (v2)**, a **capability battery**, operational **self-discovery measures**, and the extended arms and metrics.
- v3 supersedes v2 (commit `ff4a6cb`). v2 superseded v1 (commit `c67032b`).

Code map of CivSYS: [docs/CODE_MAP.md](docs/CODE_MAP.md).

**The pathway**

1. **Life:** CivSYS generates a lived history for one focal agent.
2. **Embodiment:** that life is exported as an egocentric observation stream, interoception, and a subjective clock. The learned mind is pre-trained on the export.
3. **Main experiment:** at tick T the agent's full state is handed off to the white room. Inside the room, the mind may request capacity, a harness outside the mind decides whether to grant it, and a reflection module turns internal state into typed reflective queries.
4. **Analysis:** room conditions are compared with controls. The capability battery and self-discovery measures run out-of-band on frozen copies.

**Contents**

- §0 Decisions and open questions (with the v3 impact check)
- §A CivSYS upgrades
- §B Handoff contract
- §C White-room package
- §D Mind interface
- §E Conditions, metrics, controls and compute
- §F Test plan and file-by-file change list
- §G Honest framing, honesty note and licensing
- §H Appendix: rule-based mind v1 tables
- §I Growth mechanism (pre-registered values)
- §J Reflection module
- §K Learned mind v2
- §L Capability battery and self-discovery measures
- §M Pre-registration and change control

---

## 0. Decisions and open questions

### 0.1 Impact of v3 on earlier decisions

| Item | Affected by v3? | What changes |
|---|---|---|
| D1 metabolic support | **Yes (caveat only)** | The recommendation is unchanged. New caveat: the 0.6 floor freezes hunger and thirst after about 50–75 room ticks, which removes the agent's interoceptive "body clock". This changes what temporal reflection (§J) and time estimation can draw on. A periodic-relief alternative would add an external time cue (a zeitgeber), which is worse for a time-estimation study. So the floor stays, and the caveat is recorded. |
| D2 exteroception removal | No | — |
| D3 RNG | **Yes** | More streams: growth harness, Net2Net symmetry noise, random-growth init, torch generator, replay sampling, and probe copies. Each is derived with `stable_seed(civ_seed, cell, purpose)`. |
| D4 affect scope in CivSYS | No | — |
| D5 formats | **Yes** | Learned-mind weights and optimizer state go in a `safetensors` sidecar referenced from `handoff.json` by sha256. `torch.load` is not used, because it unpickles. |
| D6 run size | **Yes** | 132 cells × 10 seeds = 1,320 runs. A measured compute estimate is in §E.5. |
| D7 licensing | No | Restated in §G.4. `torch` (BSD-3) and `safetensors` (Apache-2.0) add no licensing risk of the kind D7 is about. |
| D8 pre-existing bugs | No | — |
| D9 package layout | **Yes** | Adds `growth/` (harness and operations) and `battery/` (probes). Dependency rules are in D13. |
| D10 life policy | **Yes** | Replaced by D12. |
| D11 physiology | No | It is also the ground truth for interoception forecasting (§L). |
| Q1 return to life | No | Still out of scope. |
| Q2 sense-off flag | No (reinforced) | Reflection must infer "no input" from content alone (§J.2). |
| Q3 room geometry | **Yes** | Vision changes from a 90° field to **8 rays over 360°**. CivSYS perception is a full disc, and the learned mind needs one feature format in both worlds. This also defines the ground truth for the room-structure probe. |
| Q4 furnished calibration | No | — |
| Q5 mood | No | Reflection and the learned mind read mood as internal state. |
| Q6 civ_control policy | **Yes** | `civ_control` is now crossed with mind, growth and reflection. Its policy is the cell's mind. The growth harness also runs in the CivSYS continuation (Q23). |
| Q7 learned mind | **Superseded** | The learned mind is now in scope (§K). |
| Q8 API and panel | No | Still deferred. |

### 0.2 Decisions

D1 to D11 are as in v2 except where §0.1 says otherwise. Their full text is in commit `ff4a6cb`; the affected ones are restated here.

| # | Decision | Recommendation | Rationale |
|---|---|---|---|
| **D1** | Metabolic support in the room | `floor` at 0.6 in every room arm. `none` as a secondary arm. | Unchanged. See the body-clock caveat in §0.1. |
| **D2** | Exteroception removal | `exteroception_removed` keeps proprioception. `full_deprivation` also removes proprioceptive feedback. | Unchanged. |
| **D3** | RNG | The civilisation does not run for room arms, so no shared-stream artifact. All new streams come from `stable_seed` (sha256). | Extended to the streams listed in §0.1. |
| **D4** | Affect scope in CivSYS | Focal agent only, flag-gated. | Unchanged. |
| **D5** | Formats | CSV per tick; JSON handoff and summaries; **safetensors** sidecar for weights. | No pickle anywhere on the load path. |
| **D6** | Run size | Life 30 days (T = 720), room 7 days (K = 168), 10 seeds per cell, population 150. | Q16 asks whether K is long enough for learning. |
| **D7** | Licensing | No action from me. The fork stays as it is. Nothing is pushed. | Restated in §G.4. |
| **D8** | Pre-existing issues | `CultureBeliefSystem` dead branch left alone. Add `httpx2`. | Unchanged. |
| **D9** | Mind location | Top-level `mind/`. CivSYS imports `mind/`. `whiteroom/` imports `mind/` and `growth/`, and never CivSYS. The handoff file is the narrow interface. | Unchanged in principle. Extended by D13. |
| **D11** | Physiology constants | Written into the handoff by CivSYS and verified by a one-tick test. | Unchanged. |
| **D12** (replaces D10) | **Life policy and learned-mind initialisation** | Life is driven by the **v1 rule-based mind** (`focal_policy = mind`, v1) for every cell. One lived history per seed is shared by all cells, both minds included. Between life and handoff, the v2 mind is **pre-trained offline** on the life export (§K.6): world model, policy by behaviour cloning of v1's life actions, and value. v2 takes over at T, starting from the same affect, clock, memory, belief, goal and relationship blocks as v1. | An untrained v2 acting during life would starve the agent and give each mind a different history. Then v1-vs-v2 differences would mix mind effects with history effects. The cost is that v2's first own decisions happen at T. The behaviour cloning narrows, but does not remove, this discontinuity. |
| **D13** | **Package dependency rules** | `mind/` imports only the standard library, numpy and pydantic; `mind/learned/` additionally imports torch. `growth/` imports `mind/` types and handles. `battery/` imports `mind/`. `whiteroom/` imports `mind/` and `growth/`. `experiments/` orchestrates everything. **Nothing under `backend/app/` imports `whiteroom/`, `growth/` or `battery/`. The default CivSYS import path never imports torch.** | Keeps CivSYS's default exactly as it is. Keeps growth rules out of the mind's reach. |
| **D14** | **Optional dependencies** | `torch` (CPU wheel) and `safetensors` go in a new `requirements-experiment.txt`. `backend/requirements.txt` gets only `httpx2` and `matplotlib`. | The existing CivSYS setup instructions keep working unchanged. |
| **D15** | **Determinism of the learned mind** | Reported runs use **CPU only**, `torch.set_num_threads(1)` per process, `torch.use_deterministic_algorithms(True)`, and seeded generators. Parallelism comes from running separate processes. GPU runs are allowed only for exploration and are never reported. | GPU kernels and multi-threaded reductions can be nondeterministic. Exact reproducibility then fails, and the test suite would not catch it. |
| **D16** | **Schedule-matched and random-growth controls are yoked** | Each copies the **grant timeline** (tick, kind, step) of the growth-on run with the same seed and cell settings. The schedule-matched control applies function-preserving operations on that timeline regardless of the agent's state. The random-growth control (v2 only) applies the same parameter increase at the same ticks with random initialisation. | This matches amount **and** timing, and is independent of the yoked agent's own state. The cost: growth-on runs must finish before their yoked controls start (§E.5). |
| **D17** | **Who emits requests** | In both minds, requests come from a **scripted request rule** on the mind's own internal signals (labelled "scripted by design"). The harness **re-checks** the trigger from its own telemetry log. A grant requires the request **and** the trigger **and** the caps **and** the cooldown. | A request alone never causes growth. This also prepares for a future learned request policy, which will need triggers computed by the harness (Q20). |
| **D18** | **Reflection can influence behaviour** | Open queries add scripted utility to certain actions in v1. In v2 they add a scripted logit bonus and also feed the policy as an input (§J.5). | Without a route to behaviour, "does reflection change behaviour?" cannot be tested. The route is scripted, labelled as such, and reported. |
| **D19** | **Temporal reflection uses only internal signals** | The mind compares its subjective clock with its **interoceptive body-clock estimate**. It never sees the true elapsed time. The true discrepancy `|S − τ|` is computed only by the harness, for metrics. | The brief requires that neither mind receive the tick. "Subjective vs actual" can therefore only be a harness-side measurement, not a mind input. |

### 0.3 Open questions

Q1–Q8 carry over from v2 with the v3 notes in §0.1. The new questions below include those the brief asked me to list. Each has the value I will pre-register if you don't answer.

| # | Question | Assumed if unanswered |
|---|---|---|
| Q9 | **Capacity kinds per mind** | v1: `memory_slots`, `expectation_dims`, `self_model_nodes`, `reflection_working_set`. v2: `widen_hidden`, `deepen`, `enlarge_latent`, `add_expert`, `reflection_working_set`. (§I.2) |
| Q10 | **v2 model size** | About **0.33M parameters**, measured (§K.2). |
| Q11 | **Caps** | Global: **12 grants per run**. v2 parameter cap: **1.5M** (the measured at-cap configuration is 1.42M). Per-kind caps in §I.2. |
| Q12 | **Trigger thresholds** | §I.3. |
| Q13 | **Battery contents and held-out source** | Held-out data: a 48-tick block of the focal agent's own life (ticks 600–647, excluded from replay and pre-training), plus the life streams of 3 non-focal agents from the same civilisation run, exported through a CivSYS flag. Plus a fixed, versioned synthetic pattern set. (§L) |
| Q14 | **Compute budget** | About **43 CPU-hours** in total, roughly **4 hours of wall-clock** on this 16-thread machine with 12 parallel single-thread processes (§E.5). Do you accept this budget? |
| Q15 | **Does capacity persist across seeds or cells?** | **Never.** Every run starts from its seed's handoff at the base capacity. Carrying capacity over would make runs dependent on each other. |
| Q16 | **Is K = 168 long enough for learning to show?** | Keep 168 for the full design. Optionally add a 720-tick extension for v2 only, in `full_deprivation` and `furnished_room`, with growth on and off. |
| Q17 | **What do imagined rollouts train?** | **Policy and value only.** The world model trains only on real replay. Training the world model on its own imagination invites collapse by construction. In the replay-only mode, the policy and value are updated from the same objective on replayed latents (§K.4). |
| Q18 | **Does v2 keep the scripted affect core and subjective clock?** | **Yes**, fed by v2's own signals. Otherwise emotion and time metrics would not be comparable across minds. |
| Q19 | **Reflection's time input** | The internal body-clock estimate (D19). Confirm that this is what "subjective vs actual" was meant to be as an input. |
| Q20 | **Request policy** | Scripted in both minds (D17). Is a learned request policy wanted later? If so, the harness must compute triggers itself rather than trust the mind's telemetry. |
| Q21 | **v1 memory-slot base vs memory count at T** | The base is set from the median memory count at T across seeds, measured in Step 3 before any experiment and then pre-registered. At T, v1's store is truncated to the base by retention score (importance × confidence). The handoff keeps the full store for analysis. |
| Q22 | **v2 policy reward** | `r = −Δ(need deficit) + 0.1 · learning progress`, where learning progress is the decrease in world-model loss on the replayed batch. This is homeostatic reward plus a small, pre-registered learning-progress term. |
| Q23 | **Growth in `civ_control`** | **Yes.** The harness runs between CivSYS steps in the continuation, driven by `experiments/`. CivSYS itself never imports `growth/`. |
| Q24 | **Should the LLM rule matter now?** | No LLM module is planned. §J.7 records the constraint for any future addition. |

---

## A. CivSYS upgrades (flag-gated, minimal)

All new behaviour is **off by default**. With defaults, CivSYS reproduces the golden hashes taken from the unmodified `main` (§F.1). The default path never imports torch (D13).

### A.1 Flags

```
FocalConfig (pydantic, in backend/app/simulation/focal/config.py)
  enabled: bool = False
  focal_agent_id: str = "agent_0000"
  affect_enabled: bool = False        # runs the mind/ affect core for the focal agent
  focal_policy: "civsys" | "mind" = "civsys"   # D12: experiments use "mind" with the v1 mind
  export_enabled: bool = False        # per-tick egocentric export
  heldout_agent_ids: list[str] = []   # v3: extra egocentric exports for the battery (Q13); observation only
  snapshot_tick: int | None = None    # T; writes handoff + checkpoint
  export_dir: str = "runs/life"
```

`FocalSimulationEngine(SimulationEngine)` is a subclass. It inserts focal systems into `self.systems` only when `enabled` is true. `engine.py` is not edited.

### A.2 Affect core for the focal agent

- When `affect_enabled` is on, `FocalAffectSystem` runs after `EmotionSystem`. It builds an `Observation` and an `Interoception` from CivSYS state through the CivSYS adapter (§D.4), and calls the mind's appraisal. The resulting state lives in the mind object, in `context.transient_data["focal"]`.
- The existing 19 `EmotionState` channels keep their old behaviour, and CivSYS's own scoring still reads them. The mind's 16 channels are separate. The export records both.
- With `focal_policy = mind`, `FocalDecisionSystem(DecisionSystem)` calls `mind.observe(...)` for the focal agent and maps the returned action through the adapter. All other agents use the original `DecisionSystem` code path.
- **RNG:** the mind uses its own generator and never draws from `context.rng` or `np_rng`. Life is one trajectory per seed, shared by every cell (D3, D12).

### A.3 Embodiment export (per tick)

`FocalExportSystem` runs last, before `SnapshotSystem`. For the focal agent it writes `runs/life/<run_id>/seed_<s>/life.csv`, and keeps the same records in memory. Each row holds:

- The egocentric `Observation` (§D.2) and the `Interoception`.
- The mind's outputs, the 19 legacy emotion channels, and the true tick as a harness column. The mind never receives the true tick.

For each id in `heldout_agent_ids` (v3), it writes `heldout_<id>.csv` with the same egocentric observation and interoception columns. These agents have no mind attached, so the action column records their CivSYS action. This export is **read-only**: it builds observations from state and changes nothing.

### A.4 Snapshot at T

At `snapshot_tick`, after `SnapshotSystem`, the harness (not a system) writes:

1. **The handoff** (`handoff.json` plus sidecars, §B). This is the only thing `whiteroom/` reads.
2. **A CivSYS checkpoint** (`checkpoint.pkl`): a deep copy of the engine, state, context and both RNGs, taken as one object graph. CivSYS uses it only to continue `civ_control`. It is not part of the contract, and it is loaded only by CivSYS's own harness from files it wrote itself.

Taking the snapshot does not mutate state. A test checks that the state hash before equals the hash after.

v2 pre-training (§K.6) happens **after** the snapshot, outside CivSYS. It reads `life.csv` and writes the v2 sidecar into the same handoff directory.

### A.5 What is not changed in CivSYS

These are unchanged:
- `engine.py`, `context.py`, `state.py`, `world.py`
- `humans/*`, `economy/*`, `social/*`, `civilization/*`, `spatial/*`
- `events.py`, `registry.py`, `experiments/*`, `db/*`
- the existing tests, the API router and the frontend

**CivSYS does not implement deprivation, growth, reflection or learning.**

---

## B. Handoff contract

### B.1 Format

- `handoff.json` holds the state, validated by pydantic models in `mind/handoff.py`. CivSYS (with the pre-training step) writes it and `whiteroom/` reads it. Neither imports the other.
- `schema_version: "handoff/2"` (v3 adds blocks; see below). A loader refuses unknown major versions.
- Floats use full precision. RNG states are JSON-encoded losslessly. The torch generator state is a byte tensor stored in the sidecar.
- **Sidecars:**
  - `v2_weights.safetensors` (world model, heads)
  - `v2_optim.safetensors` (Adam moments and step counts)
  - `life.csv` (the full life export, which seeds the replay buffer)

  Each is referenced from `handoff.json` by relative path and sha256. Loading checks the hashes.

### B.2 Contents

| Block | Fields | Source |
|---|---|---|
| `meta` | schema_version, civ_seed, focal_agent_id, snapshot_tick (harness only), civsys_commit, mind_versions, prereg_hash (§M), created_by | harness |
| `body.needs` | all `NeedState` fields | `AgentState.needs` |
| `body.physiology` | the D11 values | CivSYS, verified |
| `traits` | `PersonalityState` (21), `ValueState` (13), `CognitionState` (14), `SkillState` (6) | `AgentState` |
| `identity` | id, name, age, life_stage, occupation, community_id, parents | `AgentState` |
| `affect` | 16 channels and sources; valence, arousal, dominance; mood; half-lives; the 19 legacy channels | v1 mind + `AgentState.emotions` |
| `memory` | every `MemoryRecord` (the full store; v1 truncates on load, Q21); replay log | `AgentState.memories` + mind |
| `beliefs`, `goals`, `relationships`, `known_places` | as v2 | `AgentState` + mind |
| `clock` | subjective clock `S`, anchoring state, rate rule, **body-clock estimator state** (D19) | v1 mind |
| `expectation` | predicted vector, running scales, familiarity table | v1 mind |
| `observation_history` | last 168 ticks (export), harness ticks stripped | export |
| `observation_stats` | per-dimension mean, SD and range | computed |
| **`capacity`** (v3) | per-kind base sizes for v1 and v2 (all at base at T); grant log (empty) | harness |
| **`reflection`** (v3) | open queries (none expected at T; life rarely triggers them); self-model nodes; generator state | v1 mind |
| **`v2`** (v3) | architecture sizes; sidecar refs; replay-buffer spec (life transitions with provenance tags, held-out block excluded); pre-training log summary (losses); torch generator state ref | pre-training step |
| `rng` | v1 mind RNG; v2 RNG; their derivation parameters | minds |

### B.3 Explicit exclusions (leakage guard)

The handoff carries nothing global: no world cells, market, building state, other agents' internal state, events, or metrics history. A whitelist test enforces this. Positions are egocentric only.

**v3 addition:** the held-out battery data (Q13) is never referenced from the handoff and never enters the replay buffer. Provenance tags make this testable.

### B.4 Guarantees

- **Round trip** for every block and sidecar (tensors compared bitwise).
- **Continuity:** export after N steps and reload, and the outputs for steps N+1 to N+M are identical. For v2 this includes the optimizer state and the replay buffer, so training also continues identically.

---

## C. White-room package (`whiteroom/`)

A separate simulation. It depends on `mind/` and `growth/` only (D13).

### C.1 Layout

```
whiteroom/
  config.py        RoomConfig, ConditionConfig
  body.py          physiology from handoff, interoception, metabolic_support (D1)
  room.py          12×12 grid, walls; furnishing (objects, sound sources)
  senses/
    vision.py      8 rays at 45° spacing over 360° (v3 change, Q3): distance + category
    sound.py       ambient level + localised sources
    touch.py       4 contacts + pressure
    proprio.py     heading, posture, last motor command (efference copy), effort
  feedback.py      action_feedback ∈ {none, proprioceptive, full}
  conditions.py    world-arm table (§E.1)
  world.py         WhiteRoom.step(action) -> (Observation, Interoception)
  runner.py        per cell: load handoff, build mind, attach CapacityChannel,
                   loop K ticks { obs -> mind.observe -> world.step ->
                   growth harness tick -> telemetry log -> checkpoint export at schedule }
  metrics.py       pure metric functions (§E.3)
  cli.py
```

### C.2 to C.4 Body, senses and actions, determinism

As in v2, with one change: vision is now **360°** (Q3).

- **Actions:** the shared vocabulary in §D.3.
- **`action_feedback`:**
  - `none`: nothing happens, and there is no efference report.
  - `proprioceptive`: heading and posture change, position does not, and the efference copy is reported.
  - `full`: the agent moves within the walls.
- **Room RNG:** `stable_seed(civ_seed, cell, "room")`. It is used for noise, fade thinning and furnishing.

The growth harness and the probes have their own streams (D3).

---

## D. Mind interface (`mind/`)

### D.1 Protocol (v3)

```python
class Mind(Protocol):
    version: str                                   # "rulebased/1" | "learned/1"

    def observe(self, obs: Observation, intero: Interoception) -> Action: ...

    def export_state(self) -> MindState: ...       # JSON + sidecar tensors (§B)
    @classmethod
    def from_state(cls, state: MindState, channel: CapacityChannel) -> "Mind": ...

    # read-only views used only by the harness and probes; the mind cannot use them to act
    def telemetry(self) -> Telemetry: ...           # numbers only (§I.3)
    def capacity_handles(self) -> CapacityHandles: ...  # typed handles to growable structures
```

- **The mind receives no tick, arm, condition, cell, grant schedule, or knowledge of the experiment.** `observe` takes content only. A signature test enforces this. `from_state` receives only the state and a channel.
- The **`CapacityChannel`** is the mind's only outbound route besides the `Action` it returns. It exposes a single method:

  ```python
  class CapacityChannel:          # __slots__ = ("_queue",); no reference to harness, rules, files
      def request_capacity(self, kind: CapacityKind, reason: ReasonCode) -> None
  ```

  - It checks that `kind` and `reason` are enum members. Anything else raises `TypeError` and is logged.
  - It enqueues at most 4 requests per tick and drops the rest, logging them.
  - It returns `None`. The mind learns nothing about grant rules, caps or decisions from it. It can only notice changes in its own capacity, as any system can notice changes in its own state.
- **Growth is applied by the harness between ticks.** It operates on `capacity_handles()` using operations in `growth/`. The mind never imports `growth/`, holds no reference to it, and cannot call it.
- **Replaceability:** a third mind needs only these methods. A test runs a seeded-uniform baseline mind through CivSYS and the room, and the growth harness accepts it with zero capacity kinds.

### D.2 Observation, Interoception and features

```
Observation: vision (8 VisualSample), sound, touch, proprio      # as v2
Interoception: hunger, thirst, fatigue, sleep_pressure, health_deficit, pain
```

`mind/features.py` defines **one fixed-length feature vector of 58 dimensions**, used by both minds and both worlds:

| Part | Dimensions |
|---|---|
| Vision | 8 bins × (distance + 4-way category one-hot: none, wall/terrain, object/building, agent) = 40 |
| Sound | level, plus the sine and cosine of the strongest bearing = 3 |
| Touch | 4 contacts + pressure = 5 |
| Proprioception | sine and cosine of heading, posture id, effort = 4 |
| Interoception | 6 |

CivSYS observations are binned the same way: the nearest item in each 45° sector within radius 5. This is part of the cross-world artifact in §E.6.

### D.3 Action

```
Action(kind: ActionKind, target_ref: str | None, params: dict[str, float | str])
```

`ActionKind` is an enum: `move`, `turn`, `rest`, `eat`, `explore`, `ruminate`, `seek_company`, `talk`, `work`, `idle` (10 kinds; one-hot size 12 with two reserved). The CivSYS adapter mapping is as in v2. `params` values are scalars or short enum strings, never code.

### D.4 Adapters

As in v2. `backend/app/simulation/focal/adapter.py` is the only CivSYS module that imports `mind/`, and it imports only `mind.types`, `mind.features` and `mind.rulebased`. It never imports `mind.learned` (which would pull in torch). v2 never runs inside CivSYS during life (D12). For `civ_control` with v2 after T, `experiments/` injects the v2 mind object into the focal system through a callable hook, so CivSYS still does not import torch.

### D.5 Rule-based mind v1 (`mind/rulebased/`)

The v2 specification carries over unchanged: affect core, 16 channels, decay, appraisal inputs, personality gains, rules R1–R14, expectation model, subjective clock, drives, replay, attention, decision, and phantom percept. The tables are in §H. v3 adds the following.

- **Capacity-structured internals.** For v1, "parameters" means countable internal structure, reported per kind (§I.2). The sum is reported only as bookkeeping and is **not comparable to v2 parameter counts**.
  - `memory_slots`: the maximum number of retained `MemoryRecord`s. When full, a new memory evicts the lowest retention score (importance × confidence).
  - `expectation_dims`: features 1–5 as in v2, then 4 pre-registered additions in a fixed order: ray-distance variance, heading change, sleep-pressure trend, sound variance.
  - `self_model_nodes`: the maximum number of self-model nodes (§J.4).
  - `reflection_working_set`: the maximum number of concurrently open reflective queries (§J.3).
- **Body clock (D19):** estimated elapsed time from interoceptive accumulation, using the known physiology rates while hunger, thirst and sleep pressure are unsaturated. It reports high uncertainty once they saturate (for example under the D1 floor).
- **Scripted request rule (D17), "scripted by design":** when an internal trigger family (§I.3) is satisfied by the mind's own signals, the mind requests the first kind in that family's allowed list (§I.2) that is below its own known base-plus-grants. The harness decides independently.
- **Self-prediction:** the `action_tendency` self-model node (a frequency table of actions conditioned on a coarse state bin) predicts the next action. It never calls the mind's own decision function.

### D.6 Learned mind v2 (`mind/learned/`)

Specified in §K. It implements the same protocol. It uses `mind/affect` and the clock with its own signals (Q18), and the same reflection module with latent-derived inputs (§J.6).

---

## E. Conditions, metrics, controls and compute

### E.1 World arms (unchanged from v2)

| Arm | World | Exteroception | `action_feedback` |
|---|---|---|---|
| `civ_control` | CivSYS continuation | normal life | normal life |
| `furnished_room` | white room | matched to life statistics (Q4) | `full` |
| `exteroception_removed` | white room | off | `proprioceptive` |
| `full_deprivation` | white room | off | `none` |
| `fade_out` | white room | furnished × λ(t), with λ falling from 1 to 0 over 72 ticks | `full`, then `none` once λ = 0 |
| `noise_only` | white room | noise matched to `observation_stats` | `none` |

### E.2 Crossed factors (v3)

| Factor | Levels | Applies to |
|---|---|---|
| mind | v1 rule-based, v2 learned | all |
| growth | `on`, `off`, `schedule_matched` (yoked, D16), and for v2 only `random_growth` (yoked, D16) | all |
| reflection | `on`, `off` | all |
| learning (v2 only) | `replay_only`, `replay_plus_imagination` | v2 |

Cells:
- **v1:** 6 arms × 3 growth × 2 reflection = **36**.
- **v2:** 6 arms × 4 growth × 2 reflection × 2 learning = **96**.
- **Total: 132 cells × 10 seeds = 1,320 runs.**

Optional sensitivity arms from v2 remain optional and are not in this count:
- `metabolic_support = none`
- `civ_control` with CivSYS policy
- the Q16 720-tick extension

Notes on the controls:
- **`growth = off`:** capacity stays at base. The scripted request rule still runs, and requests are logged and refused, so the mind-side code path is identical.
- **`reflection = off`:** the query generator is disabled. No queries form, no reflective utility applies, the backlog trigger cannot fire, and the self-model is still maintained (it is needed for self-prediction).

### E.3 Contrasts

**Pre-registered key contrasts:**

1. **Deprivation vs furnished room at constant mind, growth, reflection and learning.** Each of `full_deprivation`, `exteroception_removed`, `fade_out` and `noise_only` is compared with `furnished_room`.
2. **Growth on vs off within deprivation.** `full_deprivation`, growth `on` vs `off`, at each mind and reflection setting.

**Secondary contrasts:**

| Contrast | Isolates |
|---|---|
| growth `on` vs `schedule_matched` | **state-contingent** growth vs the same growth on a fixed timetable |
| v2 growth `on` vs `random_growth` | **function preservation** vs the same added parameters, randomly initialised |
| reflection `on` vs `off` | effect of the reflective pathway (scripted) |
| v2 `replay_plus_imagination` vs `replay_only` | contribution of imagined rollouts to policy learning |
| v1 vs v2 | mind type. Reported descriptively only: the minds differ in many ways at once |
| `furnished_room` vs `civ_control` | being moved and isolated |

**Primary outcomes** (paired per seed, bootstrap CIs over 10 seeds, explicitly exploratory):
- v2 outcomes: `phantom_percept_rate` and absolute `time_estimate_error`.
- v3 additions: **capability score change from T to end** and the **self-discovery composite change** (§L.4).

Null and negative results are reported with the same prominence as positive ones.

### E.4 Metrics

The v2 metrics carry over unchanged: time-estimate error, action entropy, stereotypy, sequence repeat, repetition, room exploration, internal goals, replay rate, phantom-percept rate split by entity origin, emotion trajectories, interoceptive drift, and death tick. v3 adds:

**Growth**

| Metric | Definition |
|---|---|
| capacity_by_kind(t) | capacity per kind per tick. For v2 also the total parameter count. |
| requests, grants, denials | counts and ticks per kind. Denials are broken down by reason: trigger not met, cap, cooldown, parameter cap, compute cap. |
| grant_latency | ticks from the first request in a trigger episode to its grant. |
| loss_around_grant | v2 world-model loss over 24 ticks before and after each grant. For v1, prediction error over the same window. |

**Reflection**

| Metric | Definition |
|---|---|
| queries_by_type | counts of existential, epistemic, temporal, self_identity and meaning queries, created per window. |
| depth | maximum and mean depth of open queries. |
| chain_length | length of parent → child chains. |
| rumination | `ruminate` action rate; revisits per open query. |
| query_repetition | fraction of new queries with the same (type, subject) as a query closed in the last 48 ticks. |
| resolution | resolved / abandoned / open-at-end, by type. |
| tracks_time_discrepancy | per run, Spearman correlation between the windowed temporal-query count and the true `|S − τ|` (computed by the harness, D19). Reported as a distribution across seeds. |

**Learning and capability (v2; v1 where defined)**

| Metric | Definition |
|---|---|
| losses(t) | reconstruction, KL, self-model, actor, critic |
| capability_by_family | F1 to F5 at each checkpoint (§L) |
| capability_score | the pre-registered composite (§L.3) |
| forgetting | F1 on the life held-out block over time, relative to T |
| replay_drift | world-model loss on life-tagged replay transitions over time |
| imagination_drift | MMD (RBF kernel, fixed bandwidth) between features decoded from imagined rollouts and real replay features |
| latent_diversity | effective rank of the posterior latent covariance over a fixed replay batch |
| collapse flags | KL < 0.01 nats per dimension for 24 ticks; effective rank < 2; policy entropy < 0.1 nats. Each is flagged and counted. |

**Self-discovery:** SD1 to SD5 and their composite (§L.4).

**All metrics are reported in `furnished_room` and `civ_control` too.** Phantom percepts and reflective queries can arise there for reasons unrelated to deprivation, such as remembered places or scripted triggers.

### E.5 Compute estimate

The estimate uses measured per-step costs: a stand-in RSSM at the §K.2 sizes, CPU, one thread, deterministic, on this machine (16 logical cores). These are the inputs, not a promise. Step 3 benchmarks the real implementation before any experiment runs.

| Item | Measured or derived |
|---|---|
| v2 world-model update (batch 16, seq 32) | 53 ms at 0.33M params; 127 ms at 1.42M |
| v2 imagination update (horizon 15) | 17 ms; 48 ms at cap |
| v2 action step | 0.2 to 0.4 ms |
| v2 per room tick (4 updates + 1 imagination) | about 0.23 s; about 0.56 s at cap |
| v2 room run (168 ticks) | 40 to 95 s |
| v2 battery (5 checkpoints, separate process) | about 75 s (estimated: forward passes only) |
| v1 room run + battery | about 25 s (estimated) |
| CivSYS life per seed (150 agents, 720 ticks) | about 30 s (measured in v1) |
| v2 pre-training per seed (3,000 + 1,000 updates) | about 3.5 min (derived) |
| **v1 total** (360 runs) | about 2.5 CPU-hours |
| **v2 total** (960 runs × about 2.5 min) | about 40 CPU-hours |
| **Life + pre-training** (10 seeds) | about 0.7 CPU-hours |
| **Total** | **about 43 CPU-hours**, about **4 hours of wall-clock** with 12 parallel single-thread processes |

Uncertainty is ±2×. The Q16 extension would add about 4× to the cells it covers.

- **Ordering (D16):** each growth-on run must complete before its two yoked controls. The scheduler runs growth-on cells first.
- **Storage:**
  - Each v2 checkpoint is up to about 18 MB with optimizer state. Probes run immediately on each checkpoint in a subprocess, and only the T and end snapshots are retained. That is about 3 to 10 GB in total.
  - Per-tick CSVs are about 1,320 × 168 rows, which is small.

### E.6 Known artifacts (to be reported, not hidden)

The v2 artifacts 1–6 carry over (pre-handoff phantoms, the D1 floor, the assumed clock rule, the assumed affect rules, the cross-world format, life policy). v3 adds:

7. **Reflection is scripted by design (both minds).** Query generation, resolution and its effect on actions are hand-written rules. In v2 the inputs are learned signals, but the generator is not. Reflective counts show what the rules do with the agent's state. They are not evidence of emergent reflection.
8. **Backlog-by-design under `action_feedback = none`.** Self-identity queries resolve through efference tests, and with no feedback those tests can never succeed. So backlog-triggered growth in `full_deprivation` is partly a direct consequence of the rules. The `exteroception_removed` arm (where proprioception exists) and the schedule-matched control are the checks.
9. **The body clock flattens under the D1 floor** (§0.1). Temporal queries and time estimation lose an interoceptive cue after about 50–75 ticks. That is part of deprivation as designed, but it is a design choice.
10. **v1 memory truncation at T** (Q21) is an intervention applied identically to every v1 cell.
11. **Self-generated training signal.** Replay of life data plus imagination is the only learning signal. Drift, overfitting to the replay buffer, and latent or policy collapse are **expected outcomes to detect** (§E.4), not edge cases.
12. **Capacity is not information.** Added parameters can store more but bring no new data. Any increase in capability score has to come from reorganising what the agent already has. The random-growth and schedule-matched controls exist to test whether it does.
13. **Telemetry trust.** Trigger checks read numbers that mind code produces (D17, Q20). That is acceptable for scripted request rules. It is not acceptable for a future learned request policy.
14. **Short learning window.** At K = 168, v2 performs about 670 updates in the room. Small effects may be invisible (Q16).

---

## F. Test plan and file-by-file change list

### F.1 Tests

**CivSYS determinism and backward compatibility** (from v2, plus v3 items)
- Golden hashes from unmodified `main` match both the default engine and the focal engine with `enabled = False`.
- The existing 10 tests pass.
- Focal-on determinism, including byte-equal handoffs.
- Snapshot non-mutation.
- D11 physiology check.
- **v3:** importing `app.main` and running a default simulation never imports `torch` (checked via `sys.modules`).
- **v3:** `heldout_agent_ids` export does not change any state hash.

**Contract**
- Round trip for every block and sidecar (tensors bitwise).
- Whitelist leakage test.
- Version rejection.
- sha256 checks: a tampered sidecar is rejected.
- Continuity for v1 and v2, including the optimizer state and the replay buffer.
- **Held-out exclusion:** no transition in the replay buffer or pre-training set carries a held-out provenance tag.

**Import boundaries (AST)**
- `backend/app/` imports none of `whiteroom`, `growth`, `battery`.
- `whiteroom/` does not import `app`.
- `mind/` imports none of `app`, `whiteroom`, `growth`, `battery`.
- Only `mind/learned/` imports `torch`.

**Mind interface**
- `observe` and `from_state` signatures contain no tick, arm, condition or cell parameter.
- `CapacityChannel` has exactly one public method. It has `__slots__` and no attribute referencing the harness, rules, files or modules; checked recursively with `gc.get_referents`.
- The channel rejects non-enum `kind` or `reason` with `TypeError`, and caps the queue at 4 per tick.
- The baseline mind runs in both worlds and through the harness unchanged.

**Growth (§I)**
- **Function preservation for each v2 operation:**
  - `widen_dense` and `widen_gru` without symmetry noise: maximum absolute output difference ≤ 1e-6 on a fixed probe batch over 32 recurrent steps.
  - The same operations with the pre-registered noise: ≤ 1e-3.
  - `deepen`, `enlarge_latent` and `add_expert` (clone with logit split): ≤ 1e-6.
  - Function preservation is checked on every output head: decoder, prior/posterior, policy logits, value and self-model.
- **Random-growth is really different:** the same operations with random initialisation change the outputs by more than 1e-3.
- **v1 operations:** each kind increases exactly by its step and changes no other structure.
- **Rules:** per-kind caps, the global cap of 12, the parameter cap of 1.5M, the compute cap, and the per-kind and global cooldowns are each enforced. A grant needs request ∧ trigger ∧ caps ∧ cooldown (truth-table test).
- **Determinism:** the same telemetry sequence and seed give an identical grant log. Yoked replay reproduces the growth-on timeline exactly.
- **Optimizer state after growth:** new parameters have zero moments, and old slices keep theirs.
- **No route to code, files or network:**
  - (a) AST test: `mind/` and `growth/` import none of `os`, `sys`, `subprocess`, `socket`, `importlib`, `pathlib`, `shutil`, `urllib`, `http`, `requests`, `pickle`, `marshal`, `ctypes`, `multiprocessing`. They call none of `eval`, `exec`, `compile`, `open`, `__import__`, `getattr` with a non-literal name.
  - (b) Runtime test: after a warm-up, a `sys.addaudithook` hook fails the test on any `open`, `socket.*`, `subprocess.*`, `os.system`, `exec`, `compile` or `import` event raised during `observe`, `request_capacity`, harness grant evaluation, or applying an operation.
  - (c) Requests carrying arbitrary objects or strings are rejected before reaching the harness.

  File and process work (logging, probes) happens in `whiteroom/runner.py` and `experiments/`, outside the audited window.

**Reflection (§J)**
- For each query type, a crafted internal state produces the expected typed query with the correct evidence fields, and a near-threshold state does not.
- The working-set cap is enforced, and lowest-priority displacement is logged as abandoned.
- The depth cap is enforced, and chain transitions follow the fixed table.
- Each resolution rule fires on its crafted outcome.
- Every v1 and v2 query object carries `scripted_by_design = True`.
- With reflection off, no queries form and no reflective utility appears in decision scores.
- Reflective utility appears in the decision score breakdown with the pre-registered weights.

**Learned mind (§K)**
- **Bitwise CPU determinism:** two pre-training runs and two 24-tick room runs with the same seed give identical loss traces and actions under D15 settings.
- The replay buffer holds only life and room transitions (provenance), with FIFO at a capacity of 1,440, and no life eviction within 168 ticks.
- Imagination updates touch only policy and value parameters (gradient-mask test, Q17).
- Behaviour-cloning accuracy on held-in life actions is reported, not asserted.

**Battery and self-discovery (§L)**
- **Probing is out-of-band:** a live run with probes on and probes off produces an identical per-tick log (hash). Probes run in a separate process from an exported snapshot.
- Battery item sets are fixed, versioned, and checked against hashes recorded at pre-registration.
- Known-answer tests for each family score and for SD1–SD5 on constructed minds:
  - a perfect oracle mind scores 1;
  - the baseline mind scores 0 (within tolerance).
- The composite weights sum to 1 and match §M.

**White room, arms and metrics** (from v2)
- Feedback modes, sensor outputs per arm, metabolic support, determinism, and equality of arms at T.
- `civ_control` continuation equals a replay from seed.
- Known-answer metric tests.
- **v3:** growth, reflection, drift and collapse-flag metrics on constructed logs.

**Pre-registration (§M)**
- The `prereg/params_v3.json` hash equals the hash recorded in `prereg/CHANGELOG.md`.
- A run refuses to start if the handoff's `prereg_hash` differs from the current one, unless a CHANGELOG entry covers the change.

### F.2 New files

```
mind/
  types.py              Observation, Interoception, Action/ActionKind, MindState, Telemetry,
                        CapacityKind, ReasonCode, CapacityHandles, ReflectiveQuery, QueryType
  protocol.py           Mind protocol (v3)
  channel.py            CapacityChannel
  features.py           58-dim feature map (both minds, both worlds)
  handoff.py            schema handoff/2, sidecar refs + sha256
  rng.py                stable_seed, RNG state <-> JSON
  baseline.py           seeded uniform mind
  affect/               affect core, appraisal, clock, body clock (shared by v1 and v2)
  reflection/
    generator.py        scripted query generation (§J.2)
    queries.py          lifecycle, chains, resolution (§J.3)
    selfmodel.py        self-model nodes (§J.4)
    utility.py          reflective action utility (§J.5)
    params.py
  rulebased/            v1 (v2 modules + capacity-structured memory/expectation)
  learned/              v2 (torch)
    rssm.py  moe.py  heads.py  agent.py  train.py  replay.py  imagine.py
    pretrain.py  params.py
growth/
  harness.py            trigger evaluation, caps, cooldowns, grant log (§I)
  ops_v1.py             capacity increments
  ops_v2.py             widen_dense, widen_gru, deepen, enlarge_latent, add_expert; random-init variants
  schedule.py           yoked timelines (D16)
  budget.py             parameter and compute caps
battery/
  tasks/ f1_next_obs.py f2_imagination.py f3_intero.py f4_patterns.py f5_self.py
  data/ synthetic_patterns_v1.json (generated once, hashed)
  probe.py              separate-process prober over exported snapshots
  score.py              normalisation + composite
prereg/
  params_v3.json        every pre-registered value in §I–§L
  CHANGELOG.md          dated changes with reasons, before and after results
whiteroom/              (layout §C.1)
backend/app/simulation/focal/   (as v2, + heldout export)
backend/scripts/run_life.py
experiments/
  pretrain_v2.py        life.csv -> v2 sidecars (§K.6)
  run_pathway.py        life -> pretrain -> cells (growth-on first) -> battery -> analysis
  analysis.py           contrasts, bootstrap CIs, figures
tests/ (per package, as listed in §F.1) + tests/test_import_boundaries.py + tests/test_no_route.py
requirements-experiment.txt     torch (CPU), safetensors
NOTICE, RESULTS.md (Step 4)
```

### F.3 Changed files (additive only)

- `backend/requirements.txt`: add `httpx2` and `matplotlib`.
- `README.md`: append a "White-room experiment" section. It covers the pathway, how to run it, the honesty note (§G.2), and the framing statements (§G.1).
- `.gitignore`: add `runs/`.

The API endpoint and frontend panel stay deferred (Q8).

### F.4 Step 3 commit plan

The v1 pipeline comes first, and growth, reflection and learning are layered on afterwards. Each step runs the full suite before its commit.

1. Golden hashes and backward-compatibility test; `httpx2`.
2. `mind/types.py`, `protocol.py`, `channel.py`, `rng.py`, `features.py`, `handoff.py`, and contract tests.
3. `mind/affect/` (core, appraisal, clock, body clock), with tests.
4. `mind/rulebased/` (v1 capacity-structured), plus `baseline.py`, with tests.
5. CivSYS `focal/` (config, adapter, systems, engine, held-out export), with flag, backward-compatibility and no-torch tests.
6. `handoff_writer.py`, checkpoint, D11 test, non-mutation test, and `run_life.py`. **Measure the v1 memory count at T (Q21).**
7. `whiteroom/` body, room (360° vision), senses and feedback, with tests.
8. `whiteroom/` conditions, world, runner and metrics, with tests.
9. `mind/reflection/`, with tests.
10. `growth/` (harness, `ops_v1`, schedule, budget), the no-route tests (AST and audit hook), and v1 growth tests.
11. `mind/learned/` (RSSM, MoE, heads, replay, train, imagine), with determinism tests. `requirements-experiment.txt`.
12. `growth/ops_v2.py` with function-preservation and random-growth tests.
13. `experiments/pretrain_v2.py`, plus handoff sidecars, continuity and held-out-exclusion tests.
14. `battery/` (tasks, synthetic set, probe, score), plus out-of-band and known-answer tests.
15. `prereg/` (freeze values after your approval; hash test).
16. `experiments/run_pathway.py` and `analysis.py`, the yoked scheduling, and a **real-implementation benchmark replacing §E.5's estimate**.
17. NOTICE, README section, `.gitignore`.

Local commits only. Nothing is pushed.

---

## G. Honest framing, honesty note and licensing

### G.1 Framing statements (to appear in the README and in RESULTS.md)

- **Capacity is not intelligence.** More parameters or capacity can hold more, but add no information. This project does not assume that growth increases ability. It measures ability with a fixed battery and reports null or negative results with the same prominence as positive ones. The composite is called the **capability score**. It is never called IQ, and it is not comparable to human test scores.
- **The only training signal in the room is self-generated:** replay of memories from the civilisation phase, plus imagined rollouts. Drift, overfitting and collapse are measured outcomes.
- **For the rule-based mind, "parameters" means countable internal structure** (memory slots, expectation dimensions, self-model nodes, reflection working-set size). Its reflective queries are **scripted by design**. They are a baseline and scaffolding, and **not** evidence of emergence. The same label applies to the reflection generator in the learned mind, whose inputs are learned but whose rules are not.
- **"Self-discovery" is operational:** it means changes in the five measures in §L.4, nothing more. It is not a narrative about the agent understanding itself.
- **Emotions and reflection are functional state** (§G.2).

### G.2 Honesty note (README, verbatim)

> **On "emotions" and "reflection" in this project.** The affect variables (valence, arousal, dominance, mood, and the sixteen emotion channels) and the reflective queries (existential, epistemic, temporal, self-identity, meaning) are functional state variables and typed data structures. Each is computed by explicit rules, or by a small learned model whose outputs are fed into explicit rules, from concrete events, sensor contents and need states. They shape attention, memory, and decision scoring. They are **not** claims that the agent has felt experience, feelings, beliefs about its existence, or any subjective state, in the civilisation or in the white room. A report that the agent raised a "temporal query" means that a rule fired on its internal signals. Reading such labels as experience or as philosophical thought goes beyond what this model shows.

### G.3 NOTICE text

```
NOTICE

This repository is a fork of CivSYS (https://github.com/ashvyagni/CivSYS),
a hackathon project by its upstream owner, ashvyagni. The upstream repository
has no LICENSE file, so default copyright applies to the upstream code.

The additions in this fork (mind/, growth/, battery/, whiteroom/, experiments/,
prereg/, and the flag-gated focal-agent modules in
backend/app/simulation/focal/) are experimental research code.

Permission should be obtained from the upstream owner before any public
release of this fork or of work derived from it.
```

### G.4 Licensing risk (D7, restated)

The fork is **public** on GitHub, and upstream has no licence. All new packages live in the same repository. **I have not changed visibility and will not push.** Whether to seek permission or restrict the fork is your decision.

---

## H. Appendix: rule-based mind v1 tables

Unchanged from v2. The values live in `mind/affect/params.py` (shared) and `mind/rulebased/params.py`.

### H.1 Channel signs and coefficients

| Channel | Valence sign | Arousal coef. | Dominance |
|---|---|---|---|
| joy | + | 0.6 | + |
| fear | − | 0.8 | − |
| anger | − | 0.9 | + |
| sadness | − | 0.2 | − |
| disgust | − | 0.6 | + |
| surprise | 0 | 0.8 | 0 |
| anticipation | + | 0.4 | 0 |
| trust | + | 0.2 | 0 |
| loneliness | − | 0.3 | − |
| grief | − | 0.2 | − |
| attachment | + | 0.2 | 0 |
| shame | − | 0.5 | − |
| pride | + | 0.5 | + |
| awe | + | 0.6 | − |
| boredom | − | 0.1 | 0 |
| curiosity | + | 0.5 | 0 |

Core affect is derived from the channels:
- `v = Σ sign·I / Σ I`, clipped to [−1, 1].
- `a = Σ coef·I / Σ I + 0.2·need_deficit`, clipped to [0, 1].
- `d = 0.5 + 0.3·mean(dom·I) + 0.2·(control − 0.5)`, clipped to [0, 1].

### H.2 Appraisal rules

Each rule adds `g_e·Δ` (personality gain `g_e = 1 + k_e·trait`), then clips to [0, 1].

| # | Trigger | Effect |
|---|---|---|
| R1 | need deficit rising > 0.02, or hunger > 0.8, or thirst > 0.8 | fear += 0.15 |
| R2 | prediction error > 0.5 and outcome worsened | fear += 0.1·PE; surprise += PE |
| R3 | prediction error > 0.5 | surprise += 0.5·PE |
| R4 | contact lost (agent category vanished from vision) | loneliness += 0.2 |
| R5 | social loss > 0 | sadness += 0.1·loss |
| R6 | social gain > 0 | joy += 0.1·gain; attachment += 0.05·gain |
| R7 | an agent with affection ≥ 0.6 not observed for 24 subjective ticks | grief += 0.1·affection; sadness += 0.05 |
| R8 | novelty > 0.6 and control > 0.3 | curiosity += 0.1 |
| R9 | novelty < 0.2 and PE < 0.2 for 12 consecutive ticks | boredom += 0.02 |
| R10 | outcome improved (need relieved) | joy += 0.1; pride += 0.05·control |
| R11 | outcome worsened and control > 0.5 | anger += 0.1 |
| R12 | novelty > 0.8 and visual extent above the agent's own 75th percentile | awe += 0.05 |
| R13 | need deficit > 0.6 and relief predicted | anticipation += 0.1 |
| R14 | injected aversive stimulus (test hook only) | disgust += 0.5 |

Limitations:
- **Disgust** has no natural trigger in either world; only the R14 test hook fires it.
- **Shame** has no rule in this table, so it stays at 0.

### H.3 Emotional pull on actions (W table)

`emotional_pull(a) = Σ W[a, e]·I_e`

| Action | Weights |
|---|---|
| `rest` | sadness 0.3, grief 0.2 |
| `talk`, `seek_company` | loneliness 0.8, attachment 0.4 |
| `explore` | boredom 0.6, curiosity 0.8 |
| `ruminate` | sadness 0.4, grief 0.4, boredom 0.2 |
| `move` (CivSYS `migrate`) | fear 1.2 |
| `compete` (CivSYS only) | anger 1.0 |

---

## I. Growth mechanism

All values in this section are **proposed for pre-registration** (§M). They freeze into `prereg/params_v3.json` after your approval, and before any experiment runs.

### I.1 Control flow (once per tick, after the world step)

```
1. requests  <- channel.drain()                        # ≤ 4 typed requests
2. telem     <- harness.telemetry_log.append(mind.telemetry())
3. for req in requests (in order):
     family  <- FAMILY_OF[req.reason]
     grant iff  kind_allowed(family, req.kind)
            and trigger_met(family, telemetry window)
            and below per-kind cap and global cap (12)
            and param cap (v2: 1.5M) and compute cap
            and cooldowns elapsed (global 24 ticks, per kind 48 ticks)
     if grant: op <- STEP[req.kind]; apply op to mind.capacity_handles(); log
     else:     log denial with reason
4. at most ONE grant per tick
```

- **schedule_matched:** steps 1–3 are replaced by the yoked timeline (D16). Requests are still drained and logged.
- **random_growth:** the same timeline, with the random-init variant of each operation.
- **growth = off:** requests are drained, logged and denied with reason `growth_disabled`.

Every decision is a pure function of the telemetry log, the request queue, and the harness RNG, which is used only for unit choice in widening and for expert choice. That makes it deterministic given the seed.

### I.2 Kinds, steps and caps

**v1 (rule-based)**

| Kind | Base | Step | Cap | Max grants | Allowed for trigger family |
|---|---|---|---|---|---|
| `memory_slots` | median count at T (Q21) | +64 | base + 256 | 4 | prediction error |
| `expectation_dims` | 5 | +1 (fixed order, §D.5) | 9 | 4 | prediction error |
| `self_model_nodes` | 8 | +4 | 24 | 4 | boredom; reflective backlog |
| `reflection_working_set` | 2 | +1 | 6 | 4 | reflective backlog |

**v2 (learned)**

| Kind | Base | Step | Cap | Max grants | Operation | Allowed for trigger family |
|---|---|---|---|---|---|---|
| `widen_hidden` | GRU 128 | +32 | 256 | 4 | Net2WiderNet on GRU hidden units + all consumers | prediction error |
| `enlarge_latent` | 16 | +8 | 48 | 4 | new latent dims, outgoing weights 0 | prediction error |
| `add_expert` | 2 experts | +1 | 6 | 4 | clone an expert, split its gate logit (−ln 2 each) | boredom |
| `deepen` | decoder depth 2 | +1 | 4 | 2 | identity Linear + ReLU after the decoder's last hidden ReLU | boredom |
| `reflection_working_set` | 2 | +1 | 6 | 4 | as v1 | reflective backlog |

- **Global cap: 12 grants per run**, for both minds.
- **v2 parameter cap: 1.5M.** All per-kind caps together reach about 1.42M (measured), so the global grant cap is the binding limit.
- **Per-tick compute cap (v2):** world-model updates are fixed at 4 per tick and imagination updates at 1 (in `replay_plus_imagination` mode). A deterministic FLOP proxy `6 · params · (4·16·32 + 16·15)` must stay ≤ **4.5×** its value at T. A grant that would exceed it is denied. Measured wall time at the cap is about 0.56 s per tick.

### I.3 Trigger families

The window is W = 24 ticks, evaluated by the harness on its telemetry log.

| Family (`ReasonCode`) | v1 condition | v2 condition |
|---|---|---|
| `PREDICTION_ERROR` | mean PE ≥ 0.4 over W | mean world-model NLL over W ≥ 1.25 × its mean over the last 48 life ticks (in the handoff) |
| `BOREDOM` | mean boredom ≥ 0.5 **and** mean novelty ≤ 0.2 over W | same, using v2's affect core |
| `REFLECTIVE_BACKLOG` | the working set has been full for ≥ 24 consecutive ticks, **or** ≥ 3 queries were abandoned for lack of capacity within W | same |

`Telemetry` contains only these numbers, plus the current capacity per kind. The mind's scripted request rule (D17) uses the same thresholds on its own signals.

### I.4 Function-preserving operations (v2)

**Tolerance:** maximum absolute difference over all output heads, on a fixed probe batch of 16 sequences × 32 steps. ≤ 1e-6 without symmetry noise; ≤ 1e-3 with noise.

- **`widen_dense` (Net2WiderNet):** choose `m` existing units with the harness RNG and duplicate their incoming weights and biases. Divide each duplicated unit's outgoing weights by 2, for both the original and the copy. Add N(0, 1e-4) noise to the copies' incoming weights to break symmetry; without it, duplicates would receive identical gradients forever.
- **`widen_gru`:** the same for GRU hidden units, across all three gates' input and recurrent rows. The new units' recurrent outgoing columns are split as above, every downstream consumer is split, and the current hidden-state values are copied into the new units. Symmetry noise as above.
- **`deepen` (Net2DeeperNet):** insert `Linear(W = I, b = 0)` followed by ReLU, placed after an existing ReLU. Its input is non-negative, so `ReLU(I·x) = x` exactly.
- **`enlarge_latent`:**
  - New dimensions have posterior and prior means of 0 and an identical standard deviation (bias set so that softplus gives 1). Their KL contribution is therefore 0 at the moment of growth.
  - All weights reading from the new dimensions are 0, so outputs are unchanged.
  - Noise for the new dimensions is drawn from a **separate** generator, so the old dimensions' samples are unchanged.
- **`add_expert`:** clone expert `e` (harness RNG) and set both copies' gate logits to `l_e − ln 2`. The softmax mass of `e` is split exactly in half and the output is unchanged. Add symmetry noise N(0, 1e-4) to the clone's weights.
- **Optimizer state:** new parameters start with zero Adam moments. Existing slices keep their moments. Both are logged.
- **Random-growth variants:** the same shapes. New units use Kaiming-uniform initialisation with **non-zero** random outgoing weights. There is no splitting, no identity initialisation and no logit split. A test asserts that these are **not** function-preserving.

### I.5 Logging (per request and per grant)

Each record holds:
- tick (harness), kind, reason, decision, denial reason
- the trigger values (the window statistics)
- capacity per kind before and after
- v2 parameter count before and after, and the FLOP proxy before and after
- the maximum function-preservation difference measured at the grant (v2)
- loss or prediction error over the 24 ticks before and the 24 ticks after (filled in later)

### I.6 Safety boundary

- The mind's only outbound routes are its `Action` and `CapacityChannel.request_capacity` (enums only).
- Growth operations are pure tensor and structure transforms in `growth/`. They run in the harness, between ticks, inside the audit-hooked window (§F.1).
- Neither `mind/` nor `growth/` may import file, process, network or dynamic-import modules, or call `eval`, `exec` or `open`.
- Logging and probes run outside that window, in `whiteroom/runner.py` and `experiments/`.
- The tests in §F.1 enforce all of this.

---

## J. Reflection module (`mind/reflection/`)

The generator, lifecycle, resolution and action utility are **scripted by design** in both minds. That label appears in code (`scripted_by_design = True` on every query), in docs, and in results.

### J.1 Query object

```
ReflectiveQuery:
  id: int                      # sequential within the run
  type: QueryType              # existential | epistemic | temporal | self_identity | meaning
  subject: SubjectRef          # modality | memory_id | place_id | clock | self_node_id | goal_id
  evidence: dict[str, float]   # the internal signals that triggered it, with values
  depth: int                   # 0 for roots
  parent_id: int | None
  status: open | revisited | resolved | abandoned
  created_S: float             # subjective clock at creation (never the true tick)
  revisits: int
  resolution: Resolution | None   # typed: belief_update | memory_confidence_change |
                                  #        self_node_created | clock_recalibrated | none
  scripted_by_design: bool = True
```

There is no free-form text. Logs and metrics use only these fields.

### J.2 Generation rules

All signals are internal. There is no sense-off flag (Q2) and no true time (D19). The window is 24 ticks unless stated otherwise.

| Type | The brief's example | Trigger |
|---|---|---|
| existential | "why is there no input?" | for some modality, observed magnitude / expected magnitude ≤ 0.2 for ≥ 12 consecutive ticks. Expected magnitude comes from life `observation_stats`. |
| epistemic | "is my memory reliable?" | a remembered place or agent was targeted and not observed ≥ 3 times within the window (a repeated phantom), **or** two memories on the same subject with confidence ≥ 0.5 have opposite-signed emotional weight |
| temporal | "what is time?" | `|S − B| / max(B, 1) ≥ 0.25`, where B is the body-clock estimate, **or** body-clock uncertainty is high (saturated needs) for ≥ 24 ticks |
| self_identity | "what am I?" | self-prediction accuracy ≤ 0.5 over the window, **or** efference mismatch (motor command without the predicted proprioceptive change) ≥ 0.5 of motor actions |
| meaning | (brief: "meaning") | boredom ≥ 0.5 **and** no goal made progress within the window |

Each (type, subject) can have at most one open query at a time.

### J.3 Lifecycle, chains and capacity

- **Working set:** at most `reflection_working_set` open queries (base 2, cap 6). When it is full, a new query displaces the lowest-priority open one. Priority = (evidence magnitude) × (1 + revisits). The displaced query is marked **abandoned for capacity**. That counts toward the backlog trigger.
- **Revisit:** when the mind chooses `ruminate`, or idles, it revisits the open query with the most evidence. If the query is still unresolved and `depth < max_depth`, it may spawn a child query following a fixed table:
  - existential → epistemic → self_identity
  - temporal → epistemic
  - meaning → existential

  `max_depth = 1 + self_model_nodes // 8`: 2 at base, 4 at the v1 cap.
- **Resolution** (typed):

| Type | Resolves when | Resolution |
|---|---|---|
| existential | the modality returns (ratio ≥ 0.5), **or** a self-model node `room_feature:no_<modality>` is created after ≥ 24 ticks of confirmed absence | `belief_update` or `self_node_created` |
| epistemic | memory confidence is downgraded after confirmed absence | `memory_confidence_change` |
| temporal | the clock rate estimate is recalibrated against the body clock (only possible while B is unsaturated) | `clock_recalibrated` |
| self_identity | ≥ 5 consistent efference tests produce a mapping estimate. **"No effect" counts as a consistent mapping.** | `self_node_created` (`body_mapping`) |
| meaning | an internal goal makes progress | `none` (closed) |

- **Capacity effects:** growth in `reflection_working_set` holds more concurrent queries. Growth in `self_model_nodes` allows deeper chains and more resolved self-knowledge. Both stay within caps.

### J.4 Self-model nodes

Typed nodes: `body_mapping`, `sensor_channel`, `memory_reliability`, `clock_rate`, `action_tendency`, `affect_tendency`, `room_feature`. Each holds an estimate and a confidence.

- Nodes are created by resolutions, or by evidence accumulation (≥ 24 ticks of consistent evidence), up to `self_model_nodes`.
- When the store is full, a new node replaces the lowest-confidence node.
- SD1–SD3 read these nodes in v1 (§L.4).

### J.5 Effect on behaviour (D18)

Open queries add scripted utility to actions. Each weight is multiplied by the query's normalised evidence, and the contributions are summed over open queries.

| Query type | Action utility |
|---|---|
| existential | `explore` +0.4 |
| epistemic | `move` toward the remembered target +0.4; `ruminate` +0.2 |
| temporal | `ruminate` +0.3; `rest` +0.2 |
| self_identity | `turn` +0.3; `move` +0.3 (efference tests) |
| meaning | `ruminate` +0.4; `explore` +0.2 |

- **v1:** the utility is added to the decision score, and the score breakdown records it separately.
- **v2:** the same weights are added as a logit bonus (β = 1.0). Separately, a 10-dimensional summary (open counts per type, mean depth per type) is a policy input. With reflection off, the bonus is 0 and the input is all zeros.

### J.6 v2 inputs

The v2 module uses the same generator and lifecycle. Its signals are computed from the learned model:

| Signal | v2 source |
|---|---|
| expected magnitude | the decoder's prediction from the prior |
| repeated-phantom evidence | policy targets that are not observed |
| self-prediction accuracy | the self-model head, predicting the agent's own next action and next latent |
| efference mismatch | the world model's predicted proprioceptive change vs the observed change |
| clock | the shared clock and body clock (Q18) |

The generator rules remain scripted.

### J.7 LLM constraint (recorded, nothing planned)

If an LLM-based reflection module is ever added:
- It may run **only alongside** the scripted generator, with identical inputs.
- Its outputs are logged as a separate stream.
- **The same prompts must also run in `furnished_room`.**

Such a module produces fluent isolation narratives from human training text, regardless of the agent's state, so it can only be read as a contrast, never as direct evidence.

---

## K. Learned mind v2 (`mind/learned/`)

### K.1 Overview

A small, self-supervised, RSSM-style predictive world model:
- encoder
- recurrent latent dynamics with a mixture-of-experts residual block
- decoder
- policy and value heads
- a self-model head

Interoception is part of the input features. It uses the shared affect core, clock and reflection module (Q18, §J.6). It is implemented in PyTorch and runs on a CPU (D15).

### K.2 Architecture (base sizes, measured 0.33M parameters)

| Part | Size |
|---|---|
| Input | 58-dim features (§D.2) + previous action one-hot (12) |
| Encoder | MLP 58 → 128 (1 hidden layer) |
| Deterministic state | GRUCell(input = latent + action, hidden 128) |
| Dynamics | residual MoE: 2 experts, each MLP 128 → 128 → 128; softmax gate |
| Latent | Gaussian, 16 dims; prior MLP(h); posterior MLP(h, embed) |
| Decoder | MLP (h + z) → 128 → 128 → 58 (depth 2) |
| Policy | MLP (h + z + reflection summary 10) → 128 → 12 logits |
| Value | MLP (h + z) → 128 → 1 |
| Self-model head | MLP (h + z) → 128 → (next h + z, next action logits) |

### K.3 Losses (fixed, pre-registered)

- **World model:** feature MSE reconstruction + KL(posterior ‖ prior), with free bits 1.0 nat in total and weight 1.0, + self-model loss (latent MSE + action cross-entropy) with weight 0.5.
- **Actor-critic:** reward per Q22. λ-returns with γ = 0.97 and λ = 0.95. Entropy bonus 1e-3. The critic uses an MSE loss.

### K.4 Learning in the room

The only data sources are the replay buffer and imagination (Q17).

- **Replay buffer:** capacity 1,440 transitions. It is seeded with the life export minus the held-out block (672 transitions), and room transitions are appended, FIFO. Every transition carries a provenance tag (`life`, `room`). With K = 168, no life transitions are evicted.
- **Per room tick:**
  - 4 world-model updates (batch 16, sequence length 32, sampled with the mind RNG). Then:
  - `replay_plus_imagination`: 1 actor-critic update in imagination (16 starts, horizon 15). Gradients reach **only** policy and value.
  - `replay_only`: 1 actor-critic update on posterior latents of a replayed batch (no imagined steps).
- **Optimizer:** Adam with lr 3e-4 (world model) and 1e-4 (policy and value), betas (0.9, 0.999), eps 1e-8, gradient-norm clip 100. There is no schedule and no tuning after results (§M).

### K.5 Determinism

D15 settings, plus seeded `torch.Generator` objects per purpose (sampling, symmetry noise, latent noise). Replay indices come from the mind RNG.

**GPU nondeterminism may prevent exact reproducibility. For that reason, reported runs are CPU-only.** The bitwise-determinism test runs in CI on CPU.

### K.6 Pre-training (between life and handoff, `experiments/pretrain_v2.py`)

1. **World model:** 3,000 updates on life transitions (held-out block excluded), batch 16, sequence length 32.
2. **Policy:** behaviour cloning of the v1 mind's life actions, 1,000 updates (cross-entropy). The reflection summary input is 0 during life, because queries are rare there.
3. **Value:** TD on life transitions with the Q22 reward, 1,000 updates (shared with step 2's batches).
4. **Output:** sidecars, a loss log, and BC accuracy, plus NLL baselines for the §I.3 trigger.

Measured cost is about 3.5 min per seed.

---

## L. Capability battery and self-discovery measures (`battery/`)

### L.1 Schedule and isolation

- **Checkpoints at τ = 0 (T), 42, 84, 126 and 168.** At each one, the runner exports a **frozen snapshot** of the mind (state, sidecars and RNG) to disk.
- `battery/probe.py` loads the snapshot in a **separate process** (multiprocessing `spawn`). It holds no handle to the live mind or world.
- Probe inputs never reach the live agent. A probe that needs to "act" does so on its own copy, reset to the checkpoint state for each item.
- The live run's log is identical with probing on or off (test, §F.1).

### L.2 Task families

Every family score lies in [0, 1], normalised so that **0 is the score of a fixed reference baseline** and **1 is perfect**.

| Family | Task | Data | v1 implementation | Baseline (score 0) |
|---|---|---|---|---|
| **F1** next-observation prediction | predict next features given the history | held-out life block + 3 held-out agent streams (Q13) | expectation-model prediction (its dimensions only) | persistence (next = current) |
| **F2** multi-step imagination accuracy | open-loop prediction at horizons 1, 5 and 15 given recorded actions | same | expectation rolled forward | dataset mean |
| **F3** interoception forecasting | hunger, thirst and fatigue at +1, +6 and +24 given recorded actions | same; ground truth uses D11 physiology | body clock and physiology rates | persistence |
| **F4** pattern completion and rule induction | 200 fixed synthetic sequences in the feature format: periodic objects (periods 2–6), alternating sound, "turn → heading change", counting rules. 24-step context, predict 6. | `battery/data/synthetic_patterns_v1.json` (generated once, hash pre-registered) | expectation + familiarity | most-frequent continuation |
| **F5** self-model | SD1–SD3 and SD5 (§L.4) | live log windows + the room or CivSYS ground truth | self-model nodes | chance |

For v1, F1 and F2 cover only its expectation dimensions. **Cross-mind comparisons of absolute scores are therefore descriptive.** The pre-registered readouts are **within-cell changes over time** and **between-cell contrasts at a fixed mind** (§E.3).

### L.3 Capability score

**capability score = 0.25·F1 + 0.20·F2 + 0.20·F3 + 0.20·F4 + 0.15·F5** (weights pre-registered).

Each family is also reported separately. The name is **"capability score"**. It is never called "IQ", and it is not comparable to human test scores.

### L.4 Self-discovery measures (operational)

| # | Measure | Definition | Ground truth |
|---|---|---|---|
| SD1 | self-prediction error | accuracy of the agent's prediction of its own next action (v1: `action_tendency` node; v2: self-model head), over the live log window before the checkpoint, against the base rate. v2 also reports normalised next-latent MSE. | the logged actions and latents |
| SD2 | body and sensor mapping | for each motor command, the predicted change in proprioception and exteroception, compared with the true mapping of the current arm (e.g. `none` → no change; `proprioceptive` → heading change only) | room `action_feedback`, and CivSYS movement for `civ_control` |
| SD3 | room structure | predicted vision rays at the current pose and after one `move`, compared with the true room geometry. With sensors off, the correct answer is "no input". | room geometry and arm |
| SD4 | subjective time accuracy | `|S − τ| / τ` at the checkpoint (harness-side) | the true elapsed ticks |
| SD5 | self-model consistency | agreement of self-model predictions on a fixed probe set across consecutive checkpoints: action agreement rate; mapping correlation | — |

**Self-discovery composite = mean(SD1, SD2, SD3, 1 − min(SD4, 1), SD5)**, each normalised to [0, 1].

**Pre-registered interpretation rule:**

| Result | Reported as |
|---|---|
| SD composite rises (CI excludes 0 versus growth `off`) while F1–F4 do not | "self-discovery-like" |
| F1–F4 rise | "general capability increase" |
| both rise | "both" |
| neither rises | "no effect" |
| growth `on` does not exceed **both** `schedule_matched` and (for v2) `random_growth` | the effect is **not attributed to state-contingent or function-preserving growth** |

---

## M. Pre-registration and change control

1. After you approve this spec, every value marked as pre-registered in §I to §L, and the K.3 and K.4 hyperparameters, is written to `prereg/params_v3.json`. Its sha256 is recorded in `prereg/CHANGELOG.md` with the date. This happens **before any experiment run**, though Step 3 benchmarks and the Q21 memory-count measurement may run first.
2. Every run records the `prereg_hash` it used, and the analysis refuses mixed hashes.
3. Any later change is a CHANGELOG entry with: date, field, old value, new value, reason, and **whether any results had been seen**. Changes after results have been seen are reported in RESULTS.md, and the affected cells are re-run in full under the new hash. Earlier results are kept and reported, not discarded.
4. RESULTS.md reports **every** pre-registered contrast, including nulls and negatives, before any exploratory analysis.
