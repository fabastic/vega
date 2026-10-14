# Pilot (stage 2): v1 mind, floor support

Generated from `runs/pilot_floor/pilot_report.json` (gitignored). 6 arms x growth {on, off} x reflection on, seeds 42/101/202/303, K = 168 and 672, 96 runs, 144 s total.

Decision rules were fixed in DECISIONS_OVERNIGHT.md before the pilot ran.

## Pre-trigger equivalence

Identical mind-state hash at T across every arm, growth setting and K, per seed: {'42': True, '101': True, '202': True, '303': True}

## Per-arm means (growth on)

### K = 168

| arm | abs time error | phantom rate | queries | action entropy | grants | replay rate |
|---|---|---|---|---|---|---|
| civ_control | 0.063 | 0.55 | 1.8 | 2.39 | 0.00 | 0.00 |
| furnished_room | 0.192 | 0.82 | 4.8 | 2.45 | 0.00 | 0.00 |
| exteroception_removed | 0.121 | 1.00 | 10.8 | 2.42 | 0.00 | 0.56 |
| full_deprivation | 0.057 | 1.00 | 14.8 | 2.46 | 0.00 | 0.56 |
| fade_out | 0.184 | 0.93 | 9.0 | 2.41 | 0.00 | 0.39 |
| noise_only | 0.248 | 1.00 | 9.8 | 2.42 | 0.00 | 0.00 |

### K = 672

| arm | abs time error | phantom rate | queries | action entropy | grants | replay rate |
|---|---|---|---|---|---|---|
| civ_control | 0.062 | 0.51 | 10.0 | 2.40 | 0.00 | 0.00 |
| furnished_room | 0.226 | 0.69 | 16.5 | 2.49 | 0.25 | 0.00 |
| exteroception_removed | 0.091 | 1.00 | 25.5 | 2.37 | 1.00 | 0.56 |
| full_deprivation | 0.047 | 1.00 | 50.5 | 2.26 | 0.00 | 0.56 |
| fade_out | 0.067 | 0.98 | 48.2 | 2.29 | 0.00 | 0.51 |
| noise_only | 0.250 | 0.96 | 36.2 | 2.47 | 0.00 | 0.00 |

## Room-length rule

| metric | contrast vs furnished at 168 | at 672 | still developing (>25%) |
|---|---|---|---|
| abs_time_error_mean | -0.040 | -0.112 | True |
| phantom_rate | +0.163 | +0.301 | True |
| grants | +0.000 | +0.000 | False |
| queries_created | +6.312 | +23.625 | True |
| action_entropy_mean | -0.019 | -0.141 | True |

Metrics still developing: 4 of 5. Rule indicates 672: **True** (subject to compute fit).

## Time-estimate signal after the body clock

Across-arm spread of mean abs time error (ticks 100-168): 0.251; mean within-arm SD: 0.020. Has signal: **True**.

Body clock silent-from tick per run (None = never silent for 12+ ticks within 168): [None, None, None, 168, None, None, None, None, None, None, 168, None, None, None, 168, None, 167, None, None, None, None, 168, None, None]

Sleep pressure keeps the interoceptive clock informative under the 0.6 hunger/thirst floor, so the flattening predicted in SPEC v3 0.1 mostly did not occur.

## Artifact checks

- NaN runs: []
- Focal deaths: [[101, 'civ_control', 672, 381], [101, 'civ_control', 672, 381]] (CivSYS natural mortality)
- Arms with identical action counts across seeds: []
- Grants total: 5; requests total: 211
