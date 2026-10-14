# STATUS (round 2)

- Round 1: tagged `round1-final` (22f737b6). Round 2 started ~12:45 IST. Updated: 2026-10-14 14:14 IST
- Current stage: round 2 FULL RUN (1,320 runs, K=168, 10 workers), launched 14:14. ETA ~4 h (inside 6 h; deadline 20:14).
- Done: T=80 (seed scan), death isolation (tests), civ_control stop rule, v1 thresholds recalibrated on furnished runs (1.05 grants/run), v2 gate passed at attempt 3 (residual decoder, 10/10), v2 threshold 2.87 (held-out; furnished check 0.8 grants/run), round-2 pre-registration frozen. Tests: root 95, backend 28.
- Running: nothing. PAUSED at user request at 17:41 (688/1320 complete). Resume: CIVSYS_ROUND=2 experiments.run_full --K 168 --workers 6 (completed runs are skipped).
- Last error: 14:55 disk full (pagefile growth under memory pressure); fixed with 6 workers + disk guard
- Next step: poll every ~30 min; then analysis, RESULTS_ROUND2.md, MORNING_REPORT_ROUND2.md
