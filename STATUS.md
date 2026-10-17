# STATUS

- Updated: 2026-10-17 IST. Repository: fabastic/vega (CivSYS as the civsys/ submodule).

## Round 2
- Full run stopped at 1,054/1,320 (2026-10-15 12:13 IST; the driver was killed externally, exit code 4, no
  experiment errors). The remaining 266 runs are deferred. Resume (completed runs are skipped):
  `CIVSYS_ROUND=2 python -m experiments.run_full --K 168 --workers 6`
- Provisional analysis: RESULTS_ROUND2.md, MORNING_REPORT_ROUND2.md.

## Round 3 (ready to run; DECISIONS_ROUND3.md)
- Done: viable life (0 deaths in 1,000 ticks, 10 seeds), life phase (10 seeds, T = 720, all alive), v2 pre-training
  attempt 3 (bounded state; gate 10/10), v1 thresholds (0.95 grants per furnished run), v2 threshold 3.155 (1.2 grants
  per furnished run), pre-registration frozen (prereg/params_round3.json), smoke test of 2 cells.
- Next: full run, 1,320 runs (about 12-13 h with 6 workers; the learned-mind runs take about 4-5 min each):
  `CIVSYS_ROUND=3 python -m experiments.run_full --K 168 --workers 6`
