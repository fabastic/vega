# STATUS (round 2)

- Updated: 2026-10-15 IST. Repository: fabastic/vega (CivSYS as the civsys/ submodule).
- Done: T=80 (seed scan), death isolation (tests), civ_control stop rule, v1 thresholds recalibrated on furnished runs,
  v2 gate passed at attempt 3 (residual decoder, 10/10), v2 threshold 2.87, round-2 pre-registration frozen.
  Tests in the vega layout: 114 passed, plus CivSYS's own 10 in the submodule.
- Full run: STOPPED at 1,054/1,320 (2026-10-15 12:13 IST; the driver was killed externally, exit code 4, no
  experiment errors). Phase A is complete (660/660); yoked controls are at 394/660.
  To resume (completed runs are skipped; the 6 interrupted runs are redone):
  `CIVSYS_ROUND=2 python -m experiments.run_full --K 168 --workers 6`
- Analysis: provisional, on 1,054 runs. See RESULTS_ROUND2.md and MORNING_REPORT_ROUND2.md.
- Next step: your decisions in MORNING_REPORT_ROUND2.md. Then finish the run, or fix the metrics (new
  pre-registration entry) and rerun.
