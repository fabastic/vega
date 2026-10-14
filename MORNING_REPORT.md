# MORNING REPORT (provisional: stage 4 still running; see STATUS.md)

## The three most important things

1. **Upstream CivSYS can't produce "many days of normal civilisation life".** In the unmodified default engine, every agent is dead by tick ~150-200. That holds for population 150 or 800, and for world size 128 or 256. The causes are all upstream: eating ignores thirst, agents deadlock while "traveling", and the food price runs away to about 1e79. Four flag-gated fixes failed, so I stopped (bounded effort). The focal agent survives alone to T = 720 in every seed. Its "life" is therefore about 4-6 social days followed by about 24 days in an emptied town, and **civ_control means "stay in the empty town", not normal life.** This needs your decision (below).
2. **The full experiment is running at K = 168, not 672.** The pilot's pre-registered rule indicated 672: 4 of 5 metrics were still developing at 168. But the re-benchmarked compute for 672 (~46 CPU-h, ~8 h wall) did not fit the 6-hour budget, so the rule fell back to 168. The pilot found no pre-trigger artifact: the mind state at T is identical across every arm. The time-estimate metric kept its signal, so no fix was applied.
3. **Two of the core manipulations are weak by construction.**
   - **v1 growth almost never triggers** under the pre-registered thresholds: 5 grants in 96 pilot runs, and none at 168 ticks. So v1 growth contrasts will be close to null.
   - **v2's world model fits its training data but does not generalise.** In-sample it beats persistence 3.5x. On held-out data it is worse than persistence, so its battery scores start at 0 for F1-F4. I investigated once and recorded this as a finding, not a bug.

## Completed per stage (commits are local only; nothing pushed)

| Stage | Commit | What |
|---|---|---|
| baseline | a0a5a96d | Golden-hash backcompat recorded from unmodified CivSYS (3 seeds x 200 ticks, exact-float digests) |
| 1 | 0e226eff | Flag-gated focal agent (subclass engine, v1-mind policy, egocentric + held-out export, handoff + checkpoint); `mind/` core; v1 mind; reflection; physiology check (D11) |
| 2 | f1b6a3e8 | `whiteroom/` (body, room, 360-degree vision, sound, touch, proprioception, explicit action_feedback, 5 arms); civ_control continuation; growth harness; no-route tests (static + audit hook, with a non-vacuity check); metrics; pilot |
| 3 | 55e89405 | Learned mind v2 (RSSM, replay / imagination); function-preserving growth ops + random-init variants; out-of-band battery F1-F5 + SD1-SD5; pre-registration frozen; 10 seeds pre-trained |
| 4 | 8ec1b626 (+ results commit) | Analysis and RESULTS writer; full run K=168, 1,320 runs |

## Tests

- Root suite: 89 passed.
- Backend suite: 21 passed. This includes the golden backcompat for the default engine, the disabled focal engine, and the enabled read-only focal engine, plus the 10 original upstream tests.
- Function preservation: exact (<=1e-6) without symmetry noise and <=1e-3 with it, for all four v2 operations. All four random-init variants change outputs by >1e-3.
- No-route test: static ban plus runtime audit hook. The test proves the hook fires on open, exec and import.

## Compute used

- Life: 10 seeds x ~8 s.
- v2 pre-training: ~350 s per seed, 10 in parallel.
- Pilot: 96 runs in 145 s.
- Stage 4: see STATUS.md / final section.
- Hardware: i7-13620H, 10 cores (6P+4E), 16 threads, CPU only.

## Deviations from the spec and defaults chosen instead of asking

Everything is in **DECISIONS_OVERNIGHT.md** with timestamps. The most consequential:

- Python 3.14 is required: CivSYS does not import under 3.12.
- **Life viability.** The mind-driven focal agent re-decides every tick and eats, rests and works where it stands. Without this it starved in 5/5 seeds, because CivSYS travel commitment silently overrode the mind's choices, which were then scored as failures.
- Observation gains a `social` field. It is always (0, 0) in the room.
- Reflection gains a 24-subjective-unit refractory period, plus "accepted absence". Without them a dry run churned 399 queries in 300 ticks.
- EAT/REST utility uses expected success. Without it, a dry run chose "eat" 100% of the time under a constant need.
- SPEC inconsistency: §J.3 says "no effect" counts as a consistent body mapping, while §E.6 item 8 implies it cannot. I followed §J.3, so the backlog-by-design artifact is weaker than predicted.
- Sensors off means no vision samples at all, not constant wall rays.
- Seed 505 was replaced by 1010: its focal agent died of CivSYS natural mortality at life tick 200.
- The held-out exclusion is checked by tick, not by value. Identical observations recur at different ticks.
- The F4 synthetic set is generated deterministically and checked by hash, instead of being stored as a file.
- Probe snapshots are deleted after probing because the disk is 96% full (21 GB free).
- K = 168, per the compute-fit rule.
- Open questions Q9-Q24 used the SPEC defaults, except Q16 (decided by the pilot rule).

## Failed or skipped

- Fixing the upstream CivSYS economy: stopped after 4 attempts (bounded effort).
- K = 672: did not fit the budget.
- API endpoint and frontend panel: still deferred (Q8).
- Sensitivity arms (metabolic_support = none, civ_control with CivSYS policy, ±50% affect-rule sweep): not run.
- Work paused 01:28 to 08:49 IST because of an assistant usage limit, with no state loss.

## Results I suspect may be artifacts

To be updated after the analysis. Known in advance:
- Pre-handoff phantoms count as phantoms in every room arm by construction.
- Time error is a property of the assumed clock rule.
- Reflective counts are scripted.
- civ_control is subject to CivSYS mortality; room arms are not.

## Decisions that need you

1. **Life phase.** Accept the collapsed civilisation, or fund a CivSYS economy fix: thirst-aware eating, travel deadlock, price stability. Each would be a flagged behavioural change. A third option is an earlier T, before the collapse (~day 4).
2. **Growth thresholds.** Keep them, which gives near-null v1 growth, or pre-register new thresholds and re-run, with a CHANGELOG entry since results have now been seen.
3. **v2 capacity and data.** More pre-training, or more life data (other agents' streams), so the world model generalises before growth is meaningful.
4. **K = 672.** Would need ~8 h, or a reduced design.
5. **Fork visibility.** It is still public. The upstream has no licence.
