# MORNING REPORT: ROUND 2 (provisional analysis on 1,054 of 1,320 runs)

The full run stopped at 1,054/1,320 on 2026-10-15 at 12:13 IST, when the driver process was killed externally
(exit code 4, no error inside the experiment). Phase A (growth on/off, 660 runs) is complete. The yoked controls
(schedule_matched and random_growth) are at 394/660. The numbers below come from RESULTS_ROUND2.md, which was generated
from those runs. Resuming skips completed runs, so the remaining 266 can be added later without changing anything here
except the yoked-control comparisons.

## The three most important things

1. **Deprivation changes the measured state a lot, but the biggest effect is a ceiling artefact.**
   - Phantom rate is exactly 1.0 in every exteroception_removed, full_deprivation and noise_only run, for both minds.
   - So the "+0.264" (v1) and "+0.185" (v2) contrasts are just 1 minus the furnished-room baseline. They say nothing
     about differences between those three arms. The metric cannot distinguish them.
   - Fade-out is the only deprivation arm below the ceiling (0.96-0.97).
2. **Full deprivation scores *higher* on capability and self-discovery than the furnished room, and this is probably an
   artefact of scoring, not an improvement.**
   - Against the furnished room, full deprivation scores:
     - v1: capability +0.052 and self-discovery +0.465.
     - v2: capability +0.092 and self-discovery +0.645.
   - Self-model probes (F5, SD1-SD5) are scored against each arm's own ground truth. An empty room is much easier to
     model, so a simpler world produces higher scores.
   - Fade-out goes the other way: capability −0.030 (v1) and −0.035 (v2), self-discovery −0.090 (v1) and −0.168 (v2).
   - 36 of the 37 runs flagged for |change| > 0.5 are self-discovery changes in full_deprivation and fade_out. The 37th
     is the run with no battery, an interrupted run that will be redone on resume.
3. **Growth fires, but does nothing measurable.**
   - With the recalibrated thresholds, v1 gets 0.8 grants per run in the furnished room and about 4 per run in every
     deprivation arm. So growth is clearly state-contingent.
   - Yet growth on minus off within full deprivation shows no change in any primary metric. Every CI includes 0, apart
     from a +0.008 time-error difference.
   - v2 network growth never fires without reflection (0 grants). With reflection it gives 1.4-1.6 grants per run and
     effects of order 0.002-0.02.
   - The automatic interpretation labels ("self-discovery-like", "general capability increase") rest on family changes
     of that size, one of them negative. They also swap between round 1 and round 2. Treat them as **no effect**.

## Other results

- **The learned mind is better than in round 1.** Capability at T in the furnished room went from 0.226 to 0.399, and
  F1 at the end from 0.016 to 0.044. It still beats persistence only narrowly on held-out data (ratio 0.86-0.99).
- **Time sense:**
  - Absolute time error is *lower* under exteroception removal and full deprivation (v1 −0.114 and −0.145; v2 −0.006
    with the CI including 0, and −0.083).
  - It is higher under noise-only (v1 +0.082, v2 +0.054) and slightly higher under fade-out.
- **civ_control is unusable as a comparison.** Its window averages 4.3 ticks (min 2, max 13, 180 runs) against 168
  room ticks. Contrasts involving it are reported descriptively only.
- **Sanity checks:**
  - 0 NaN runs, 0 focal deaths, 0 v2 latent-collapse flags (of 747 v2 runs), and no cell identical across seeds.
  - The furnished-room phantom rate varies, 0.17-1.0, so phantom detection itself works.
- **Primary contrasts:** 290/352 have a CI excluding 0 (round 1: 283/352). There is no multiplicity correction, and
  many contrasts share the furnished-room baseline, so this count is not evidence on its own.

## Done in round 2

| Item | Where | Status |
|---|---|---|
| Round 1 preserved | RESULTS.md, results/ (1,085/1,320 runs) | done |
| Change 1: T before the first perceivable death | experiments/select_T.py, results_round2/T_selection_scan.json | T = 80; 10/10 seeds valid |
| Change 2: death isolation | civsys_focal/ (`death_isolation`); tests/civsys/focal/test_death_isolation.py | passes |
| Change 3: civ_control stops before a perceivable death | experiments/civ_control.py | done; windows are 2-13 ticks |
| Change 4: v2 fixed and gated | experiments/pretrain_v2_r2.py | passed at attempt 3 (residual decoder), 10/10 seeds |
| Change 5: v1 thresholds from furnished runs | experiments/calibrate_v1.py | done |
| Pre-registration frozen before the run | prereg/params_round2.json, prereg/CHANGELOG.md | done |
| Full run | runs_round2/full (not committed) | 1,054/1,320; resumable |
| Analysis and write-up | RESULTS_ROUND2.md, results_round2/ | provisional, on 1,054 runs |

## Suspect or artefact-prone

- Phantom rate is at the ceiling in three of the four deprivation arms (see 1).
- F5 and SD are scored against per-arm ground truth, which favours simpler worlds (see 2).
- civ_control is a few ticks long.
- The yoked controls are incomplete, so on-vs-schedule_matched and on-vs-random_growth are not reported yet.
- The interpretation labels for growth are driven by effects at noise level.
- v1 novelty threshold ≈ 0.

## Decisions still needed from you

1. Finish the remaining 266 runs (about 2-3 hours, laptop awake), or report on 1,054?
2. Fix the two metric problems before reading anything into the deprivation contrasts:
   - give phantom rate a non-saturating version (for example, phantom events per tick);
   - score F5/SD against a common reference.
   Both need a new pre-registration entry, because they change pre-registered metrics.
3. Fix the CivSYS needs/economy so the life phase can run past day 3, which would also make civ_control usable?
