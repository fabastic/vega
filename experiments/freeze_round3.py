"""Freeze the round-3 pre-registration (prereg/params_round3.json + CHANGELOG entry) before any round-3 run.

    CIVSYS_ROUND=3 python -m experiments.freeze_round3 --attempt 1
"""
import argparse
import datetime
import hashlib
import json

import numpy as np

from experiments.common import RESULTS, ROOT, ROUND, SEEDS, T_LIFE, life_dir, memory_base   # sets up sys.path first
from civsys_focal.viability import ViabilityConfig  # noqa: E402


def v2_threshold(attempt: int):
    ratios, base, gate = [], {}, {}
    for s in SEEDS:
        info = json.loads((life_dir(s) / f"pretrain_r2_attempt{attempt}.json").read_text())
        ratios += info["heldout_window_ratios"]
        base[str(s)] = info["gate"]["model_mse"]
        gate[str(s)] = info["gate"]
    return float(np.quantile(ratios, 0.95)), base, gate


def freeze(attempt: int, v2_pe_override=None, note: str = "") -> str:
    assert ROUND == 3, "run with CIVSYS_ROUND=3"
    v1 = json.loads((RESULTS / "v1_threshold_calibration.json").read_text())["chosen"]
    pe95, base, gate = v2_threshold(attempt)
    v2_pe = v2_pe_override if v2_pe_override is not None else pe95
    r2 = json.loads((ROOT / "prereg" / "params_round2.json").read_text(encoding="utf-8"))
    params = {
        "round": 3,
        "supersedes": "prereg/params_round2.json for round 3 only (rounds 1 and 2 unchanged)",
        "seeds": SEEDS, "T": T_LIFE,
        "T_evidence": "results_round3/viability_scan.json (no deaths within 1,000 ticks with viability on)",
        "viability": ViabilityConfig(enabled=True).model_dump(),
        "death_isolation": True,
        "civ_control_rule": "stop at the last tick before any agent the focal agent ever perceived dies",
        "metrics": {
            "primary": ["phantom_per_tick", "abs_time_error_mean", "capability_change", "sd_change"],
            "phantom": "phantom_per_tick replaces phantom_rate as primary (phantom_rate kept as secondary)",
            "sd_reference": "life: SD2/SD3, F5 and the SD composite scored against the life-world contingencies at handoff "
                            "(self-model retention); arm-truth SD2/SD3 kept as secondary tracking measures",
        },
        "v1": {"memory_slots_base": memory_base()},
        "growth": {
            "v1_thresholds": {"pe": v1["pe"], "boredom": v1["boredom"], "novelty": v1["novelty"]},
            "v1_calibration": {"q": v1["q"], "furnished_mean_grants": v1["mean_grants"], "target": 1.0,
                               "data": "round-3 furnished_room, v1, growth off, reflection on/off, 10 seeds"},
            "v2_thresholds": {"pe": v2_pe, "boredom": 0.5, "novelty": 0.2},
            "v2_pe_rule": "95th percentile of 24-tick windowed held-out NLL ratio (pooled over seeds)"
                          + ("; overridden by furnished-room calibration" if v2_pe_override is not None else ""),
            "v2_pe_heldout_95th": pe95,
            "v2_nll_baseline_by_seed": base,
            "round2_values": {"v1": r2["growth"]["v1_thresholds"], "v2": r2["growth"]["v2_thresholds"]},
        },
        "v2": {"pretrain_attempt": attempt, "gate": gate,
               "gate_rule": "held-out one-step MSE < persistence MSE in >= 8 of 10 seeds (battery-F1 procedure)",
               "heldout_life_window_excluded_from_pretraining": [600, 647]},
        "K": 168,
        "everything_else": "as prereg/params_round2.json, then prereg/params_v3.json",
    }
    blob = json.dumps(params, sort_keys=True, indent=1)
    (ROOT / "prereg" / "params_round3.json").write_text(blob, encoding="utf-8", newline="\n")
    h = hashlib.sha256(blob.encode("utf-8")).hexdigest()
    now = datetime.datetime.now().strftime("%Y-%m-%d %H:%M")
    entry = (f"| {now} | round 3 frozen (params_round3.json) | {h} | **yes: round-1 and round-2 results seen** | "
             f"Changes from round 2: viable life on (DECISIONS_ROUND3.md); T 80 -> {T_LIFE}; primary phantom metric "
             f"phantom_rate -> phantom_per_tick; SD2/SD3/F5/SD composite scored against the life-world reference; "
             f"v1 thresholds recalibrated on round-3 furnished runs (PE {v1['pe']:.4f}, boredom {v1['boredom']:.4f}, "
             f"novelty {v1['novelty']:.6f}); v2 threshold {v2_pe:.3f} from round-3 held-out windows. Reasons: round-2 "
             f"problems (MORNING_REPORT_ROUND2.md, decisions 2 and 3). {note} |\n")
    with open(ROOT / "prereg" / "CHANGELOG.md", "a", encoding="utf-8", newline="\n") as fh:
        fh.write(entry)
    return h


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--attempt", type=int, required=True)
    ap.add_argument("--v2-pe", type=float, default=None)
    ap.add_argument("--note", default="")
    a = ap.parse_args()
    print(freeze(a.attempt, a.v2_pe, a.note))
