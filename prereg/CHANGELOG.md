# Pre-registration change log (SPEC section M)

Every change to `params_v3.json` after freezing must be appended here with: date, field,
old value, new value, reason, and whether any results had been seen.

| date (IST) | event | sha256 of params_v3.json | results seen? | notes |
|---|---|---|---|---|
| 2026-10-14 01:24 | frozen | ea5379a384c4be85ac98af92973802a4e159d5e0101c00e46e3b2d83a91f9b61 | pilot only (v1, stage 2) | Frozen before any stage-4 run. Values derived from the pilot: memory_slots_base=431 (Q21 rule), seed 505 -> 1010 (natural-mortality death in life). Room length K is decided by the pre-registered pilot rule plus the compute-fit check, recorded in DECISIONS_OVERNIGHT.md. |
| 2026-10-14 14:12 | round 2 frozen (params_round2.json) | e2b342c3381995ed5b36a4f116d415da566c58b9fd4287d21655daa5ed0642d3 | **yes: round-1 results seen** | Post-hoc changes, with old -> new: v1 thresholds PE 0.4 -> 0.2358, boredom 0.5 -> 0.1835, novelty 0.2 -> 0.000214 (furnished-room calibration, target 1 grant/run); v2 PE baseline in-sample -> held-out, threshold 1.25 -> 2.872; T 720 -> 80; death isolation on; civ_control stops before the first perceivable death. Reasons: round-1 problems 1-4 (RESULTS.md, MORNING_REPORT.md). v2 gate passed at attempt 3 (residual decoder; 10/10 seeds). Furnished-room check of the v2 threshold: 0.8 grants/run. |
