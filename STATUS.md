# STATUS

- Updated: 2026-10-15 IST. Repository: fabastic/vega (CivSYS as the civsys/ submodule).

## Round 2
- Full run stopped at 1,054/1,320 (2026-10-15 12:13 IST; the driver was killed externally, exit code 4, no
  experiment errors). The remaining 266 runs are deferred. Resume (completed runs are skipped):
  `CIVSYS_ROUND=2 python -m experiments.run_full --K 168 --workers 6`
- Provisional analysis: RESULTS_ROUND2.md, MORNING_REPORT_ROUND2.md.

## Round 3 (in preparation; DECISIONS_ROUND3.md)
- Done: viable life (`civsys_focal/viability.py`, 0 deaths in 1,000 ticks), phantoms per tick, common self-model
  reference, held-out leak fix for T > 600, round-3 settings, calibration and freeze scripts, tests.
- Running: round-3 life phase (10 seeds, T = 720).
- Next: v2 pre-training and gate -> calibration runs -> v1/v2 thresholds -> freeze prereg/params_round3.json ->
  full run (1,320 runs; hours).
