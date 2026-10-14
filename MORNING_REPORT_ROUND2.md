# MORNING REPORT: ROUND 2 (provisional; the full run is in progress, see STATUS.md)

## The three most important things

1. **The life phase now ends at T = 80 (day 3.3), not day 4.** The tick is forced by evidence. In all 15 seeds scanned, the first death of any agent happens at tick 81-82, and it is deterministic: agents start with hunger up to 0.3, and an agent that never eats reaches the 0.95 starvation threshold after about 81 ticks. Every agent is alive at T in all 10 seeds, so none had to be replaced. The cost is that **civ_control can only run for a few ticks** (it stops before the first perceivable death, typically 3-13 ticks against 168 in the room). The furnished room is the only usable comparison arm.
2. **The learned mind passed the held-out gate, but only just, and only after an architecture change.** Attempt 1 (more data: about 12,400 pooled pre-T transitions per seed) passed in 6 of 10 seeds. Attempt 2 (full 80-tick training sequences) passed in 7 of 10. Attempt 3 added a residual decoder, which predicts the change from the last observation, and passed in 10 of 10. Margins are small: error ratios are 0.86-0.995 against "same as last tick". The model is now roughly persistence plus a little.
3. **Growth now fires at a controlled, modest rate in the furnished room.**
   - v1 thresholds were recalibrated on furnished-room runs only, giving 1.05 grants per run (round 1 gave 0.30). This was a post-hoc change, logged with old and new values.
   - The v2 surprise threshold was recalibrated on held-out data to a ratio of 2.87 (round 1: 1.25, measured against an in-sample baseline). The furnished-room check gave 0.8 grants per run, almost all reflection capacity.
   - **v2 network growth (widen, latent, experts, depth) will therefore be rare in round 2**, so "growth" for v2 mostly means reflection working-set growth.

## Done in round 2

| Item | Where | Status |
|---|---|---|
| Round 1 preserved | tag `round1-final` (22f737b6); RESULTS.md from 1,085/1,320 runs | done |
| Change 1: T before the first perceivable death | experiments/select_T.py, results_round2/T_selection_scan.json | T = 80; 10/10 seeds valid |
| Golden backcompat re-run | backend/tests/test_golden_backcompat.py | passes |
| Change 2: death isolation | FocalConfig.death_isolation; backend/tests/focal/test_death_isolation.py (7 tests) | passes |
| Change 3: civ_control stops before a perceivable death | experiments/civ_control.py | done; windows are a few ticks |
| Change 4: v2 fixed and gated | experiments/pretrain_v2_r2.py; 3 logged attempts | passed at attempt 3 |
| Change 5: v1 thresholds from furnished runs | experiments/calibrate_v1.py, results_round2/v1_threshold_calibration.json | done |
| Pre-registration frozen before the run | prereg/params_round2.json, prereg/CHANGELOG.md | done |
| Pre-trigger equality | results_round2/pretrigger_check.json | identical across all arms |
| Full run | runs_round2/full | in progress |

## Tests

- Root suite: 95 passed.
- Backend suite: 28 passed. This includes the golden hashes, 7 death-isolation tests, and the 10 upstream tests.

## Deviations and defaults

Everything is in DECISIONS_ROUND2.md. The main ones:
- T = 80 instead of "about day 4".
- "Could perceive" means ever perceived.
- The grief slot is kept but never written under death isolation, for schema comparability.
- v2 training uses all non-held-out agents of the same seed, so seeds stay independent.
- The residual decoder (attempt 3).
- The v2 boredom and novelty thresholds keep their round-1 values.
- Round 1 is not resumed: its 235 missing yoked-control runs stay missing.

## Suspect or artifact-prone

To be completed after the analysis. Known now:
- civ_control is a few ticks long, so it is not comparable to the 168-tick room arms.
- v2 beats persistence only narrowly.
- The capability score at T still depends on the arm through F5 (self-model probes scored against each arm's ground truth).
- The v1 novelty threshold is about 0.

## Decisions still needed from you

To be completed after the analysis. Known now:
- Whether to fix the CivSYS needs/economy so a longer life phase becomes possible.
- Whether the shrunken civ_control is acceptable.
- Whether a stronger learned world model is wanted before reading v2 results.
