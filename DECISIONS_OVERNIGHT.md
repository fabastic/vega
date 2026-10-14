# Decisions made overnight (unattended run)

Approved spec: SPEC.md v3 (commit b35ebc75). Per the overnight instructions, every
open question uses its proposed default unless noted, and every new decision is
logged here with a one-line rationale. Times are IST.

## Open questions resolved with the SPEC default

| Q | Decision | Rationale |
|---|---|---|
| Q9 | Capacity kinds as in SPEC §I.2 | proposed default |
| Q10 | v2 base size ~0.33M params | proposed default, measured |
| Q11 | 12 grants/run global cap; v2 param cap 1.5M | proposed default |
| Q12 | Trigger thresholds as SPEC §I.3 | proposed default |
| Q13 | Held-out: focal life ticks 600-647 + 3 non-focal agents + synthetic set | proposed default |
| Q14 | Compute budget: full run must fit in 6 wall-clock hours (user rule) | user instruction |
| Q15 | Capacity never persists across seeds/cells | proposed default |
| Q16 | **Not defaulted**: pilot at 168 and 672 room ticks decides K | user instruction |
| Q17 | Imagination trains policy/value only | proposed default |
| Q18 | v2 keeps scripted affect core and clock | proposed default |
| Q19 | Reflection time input = internal body clock | proposed default |
| Q20 | Scripted request rule in both minds | proposed default |
| Q21 | v1 memory-slot base = median memory count at T, measured in stage 1 | proposed default |
| Q22 | v2 reward = -delta(need deficit) + 0.1 * learning progress | proposed default |
| Q23 | Growth harness also runs in civ_control | proposed default |
| Q24 | No LLM module | proposed default |
| Q1-Q8 | As SPEC v3 §0.1 | approved |

## Decisions taken during implementation

(appended below as they happen)

- **00:30 Python 3.14 for everything.** CivSYS `context.py` only imports under 3.14 (it relies on deferred annotation evaluation; 3.12 raises NameError). Rather than edit CivSYS, the project venv `.venv-exp/` (gitignored, inside the project) uses Python 3.14.6 with CPU torch 2.14.1.
- **00:30 Golden baseline** recorded from unmodified `backend/app` (seeds 42/101/202, pop 150, 128x128, 200 ticks, exact-float digests of agents, market, groups, metrics, ledger length, final cells). `backend/requirements.txt` gains `httpx2` (D8, needed by TestClient) and `matplotlib` (plots).
- **00:30 `backend/civsys.db`** (created by the existing app's sqlite fallback whenever tests import `app.main`) is gitignored.
- **00:40 Life viability (deviation from CivSYS mechanics, focal agent under `focal_policy=mind` only).** With CivSYS travel commitment the mind's choices were silently overridden on ~90% of ticks and then scored as failed actions, which collapsed its expected value of eating; the focal agent starved in 5/5 seeds by tick 98-189. Fix: the mind-driven focal agent re-decides every tick (no travel commitment) and eats from carried food, rests, and works where it stands (CivSYS terrain yield or its existing subsistence fallback). Result: 5/5 seeds alive at tick 720 with healthy needs. Other agents unchanged.
- **00:40 Observation gains a `social` field** (gain, loss) carrying social contact received this tick (shared memories, conflict). It is sensor content, not experiment knowledge, and is always (0, 0) in the white room. Needed for appraisal rules R5/R6.
- **00:40 Vision magnitude = occupied 45-degree bins** (max 8), not raw sample count; CivSYS can show >8 entities.
- **00:40 Reflection refractory (addition to SPEC J.3).** A resolved or capacity-abandoned (type, subject) cannot recur within 24 subjective units, and an existential query cannot recur while its `room_feature:no_<modality>` self-model node exists (the absence has been accepted). Without this, a dry run created 399 queries in 300 ticks (resolve/recreate churn every tick).
- **00:40 Need actions use expected success.** EAT/REST utility = need term x (0.25 + 0.75 x learned success rate). Without it, a dry run under a constant need chose `eat` on 100% of deprived ticks despite eating never working.
- **00:40 SPEC inconsistency resolved in favour of J.3:** "no effect" counts as a consistent body mapping, so self-identity queries CAN resolve under `action_feedback=none`. SPEC E.6 item 8 ("can never succeed") is therefore wrong as written; the backlog-by-design artifact is weaker than predicted.
- **00:40 Sensors off = no vision samples** (not "constant wall rays" as SPEC F.1 phrased it): with sensors off nothing is sensed; the furnished room shows walls.
- **00:46 MAJOR: upstream CivSYS civilisation collapses on its own.** Unmodified default engine, pop 150 or 800, world 128 or 256: everyone is dead by tick ~150-200 (0 alive at tick 200). Diagnosed causes (all upstream): (1) `eat` score ignores thirst, which rises ~2x faster than hunger, so agents keep working until thirst damage kills them; (2) agents get stuck "traveling" forever (migrants target a non-existent building type `house` while PopulationSystem moves them elsewhere; workers can't reach within 1 cell of crowded farms because of separation force), and CivSYS never re-decides while traveling; (3) the food price EMA runs away (to ~1e79), making migration score high and trade impossible. Four flag-gated fix attempts (thirst-aware eating, eat/rest/work where standing, travel timeout, combinations) all still collapsed by tick ~150-300. Stopped there (bounded effort; fixing the upstream economy would be a large behavioural rewrite of CivSYS, against "keep CivSYS changes small").
  - **Default chosen:** keep the pre-registered life length T = 720. The focal agent (v1 mind, with the logged where-it-stands mechanics) survives alone to T in 5/5 seeds, so its "life" is ~4-6 days of social life followed by ~24 days in a depopulated town. **civ_control is therefore "stay in the emptied town", not "normal civilisation life".** This needs your decision (see MORNING_REPORT).
- **00:51 Pilot decision rules, fixed BEFORE running the pilot.**
  - *Room length (Q16):* pilot runs the 6 world arms with the v1 mind (growth on and off, reflection on) for 4 seeds at K=168 and K=672. For each deprivation arm and each primary/secondary metric (abs time-estimate error, phantom-percept rate, grants, reflective queries, action entropy) compute the paired difference vs furnished_room at tick 168 (in both runs; identical by construction up to 168) and at the end of the 672 run. **Choose 672** if, for at least 2 of the 5 metrics, the mean contrast at 672 differs from the contrast at 168 by more than 25% of the 168 value (the effect is still developing) **and** the re-benchmarked full-run compute at 672 fits the 6-hour budget; otherwise **choose 168**. If 672 is indicated but does not fit, choose 168 and report it.
  - *Time-metric signal (user instruction):* after the body clock goes silent (pilot measures when), the time-estimate metric "has signal" if the across-arm spread of mean abs time-estimate error over ticks 100-168 exceeds 2x its across-seed SD within arms, or if the error keeps changing (|slope| > 0.001 per tick over ticks 100-168) in at least one deprivation arm. If not, apply the proposed fix (`metabolic_support=stock`: an internal, uncued food store, which keeps hunger/thirst rising and relieved by the agent's own eating) and re-check.
  - *Memory slots base (Q21):* median v1 memory count at T across the life seeds actually run, rounded to the nearest integer.
- **01:03 Pilot (v1, floor support) results and automatic decisions.** Full numbers in docs/PILOT.md.
  - Pre-trigger equivalence: identical mind state at T across all 6 arms x growth on/off x K, all 4 pilot seeds. **No pre-trigger artifact.**
  - Room length rule: 4 of 5 metrics still developing between tick 168 and 672 (time error, phantom rate, queries, action entropy; grants are ~0 in both). **Rule indicates K = 672**, pending the stage-3 compute-fit check.
  - Time-metric signal: present (across-arm spread 0.25 vs mean within-arm SD 0.02; slope rule also met). The body clock was rarely silent: sleep pressure keeps rising under the floor and acts as an interoceptive clock (silent only near tau 167-168 in a few deprivation runs). **No fix applied** (stock support not needed).
  - Growth almost never triggers under the pre-registered thresholds: 5 grants in 96 runs (0 at K=168; a few in exteroception_removed and furnished_room at K=672). Not retuned (pre-registration); reported as a finding. Growth on vs off contrasts will be near-null by construction at these thresholds.
  - Two focal deaths, both CivSYS natural-mortality draws (1%+ per 100 ticks at age milestones; needs were healthy): life seed 505 at tick 200 and civ_control seed 101 at tau 381. Room arms have no such mortality: a small asymmetry, reported as an artifact. **Seed 505 replaced by 1010** (focal alive at T). Q21 memory-slot base = **431** (median over the 10 valid lives; unchanged by the swap).
- **01:25 Held-out check by tick, not by value.** A pre-training assertion that no replay feature vector equals a held-out one fired on 3 seeds: identical observations legitimately recur at other ticks (e.g. idle in an unchanged scene). Exclusion is by life tick (600-647), verified by count and by a unit test with unique features; the by-value assertion was removed.
- **01:25 Pre-registration frozen** (prereg/params_v3.json, sha256 in prereg/CHANGELOG.md) before any stage-4 run.
- **v2 world model generalises poorly (investigated once, recorded as a finding, not a bug).** At T, fully pre-trained v2 scores 0 on battery families F1-F4: on held-out data its one-step prediction error (0.134, seed 42) is worse than persistence (0.082). In-sample on its own life data it beats persistence 3.5x (prior one-step MSE 0.020 vs 0.073; posterior reconstruction 0.019). So the pipeline works; the model overfits one agent's 672 training transitions (3000 updates) and does not transfer to the held-out block or other agents. Behaviour cloning of v1 life actions reached 0.83-0.89 accuracy.
- **Usage-limit gap.** Work paused from ~01:28 to ~08:49 IST (assistant usage limit); resumed with no state loss.
- **08:52 Stage-4 go/no-go: GO at K = 168.** Pilot rule indicated 672, but the re-benchmark does not fit: measured parallel slowdown 1.75x with 10 processes (10 physical cores: 6P+4E, 16 threads) gives ~5.7 single-process equivalents; K=672 needs ~46 CPU-h (~8 h wall) > 6 h; K=168 needs ~15 CPU-h (~2.8 h). Per the pre-registered rule, K = 168. All tests pass (root 89, backend 21), no pre-trigger artifact in the pilot. Launching with 10 workers.
- **09:04 Stage-4 throughput lower than estimated.** Under full load a v2 cell takes ~168 s (3x the single-process time; the 1.75x pre-training slowdown under-estimated contention from probe subprocesses and E-cores). Projection ~4.6 h wall, still inside the 6 h budget; continuing with a stop rule if the projection exceeds the deadline (14:51).
- **09:46 Early stage-4 observations (seed 42), recorded as artifacts, not bugs.**
  - Capability score at tau=0 differs across arms although the mind state is identical: F5 (self-model probes SD1-SD3) is scored against each arm's true environment (e.g. the life-learned body mapping "moving changes what I see" is wrong in full_deprivation). F1-F4 at tau=0 are identical across arms. So capability change in deprivation partly measures adaptation of the self-model to the new environment.
  - v2 receives ~6 grants per growth-on run in every arm, including furnished_room and civ_control: the PE trigger baseline (mean NLL over the last 48 life ticks) is in-sample for the pre-trained model, so any post-T input exceeds the 1.25 ratio. v2 growth is therefore not deprivation-specific; attribution relies on the yoked schedule-matched and random-growth controls. Not retuned (pre-registered).
- **11:45 Transient disk drop (17 GB -> 7.1 GB free, then back to 15 GB) was not caused by the experiment** (runs/ = 374 MB). Most likely Windows' system-managed pagefile growth under memory pressure (pagefile now 18.8 GB) plus Defender definition updates. Monitoring continued; no action needed.
- **12:47 Round 1 closed at 1,085/1,320 runs** (paused at the user's request). Missing: 235 yoked-control runs for seeds 606-909. RESULTS.md written from completed runs. Tagged `round1-final`.
