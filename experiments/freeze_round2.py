"""Freeze the round-2 pre-registration (prereg/params_round2.json + CHANGELOG entry) before any round-2 run.

    CIVSYS_ROUND=2 python -m experiments.freeze_round2 --attempt 2
"""
import argparse
import datetime
import hashlib
import json

import numpy as np

from experiments.common import ROOT, SEEDS, T_LIFE, life_dir, memory_base


def v2_threshold(attempt: int):
    ratios, base, gate = [], {}, {}
    for s in SEEDS:
        info = json.loads((life_dir(s) / f"pretrain_r2_attempt{attempt}.json").read_text())
        ratios += info["heldout_window_ratios"]
        base[str(s)] = info["gate"]["model_mse"]
        gate[str(s)] = info["gate"]
    return float(np.quantile(ratios, 0.95)), base, gate


def freeze(attempt: int, v2_pe_override=None, note: str = "") -> str:
    v1 = json.loads((ROOT / "results_round2" / "v1_threshold_calibration.json").read_text())["chosen"]
    pe95, base, gate = v2_threshold(attempt)
    v2_pe = v2_pe_override if v2_pe_override is not None else pe95
    params = {
        "round": 2,
        "supersedes": "prereg/params_v3.json for round 2 only (round 1 unchanged, tag round1-final)",
        "seeds": SEEDS, "T": T_LIFE,
        "T_evidence": "results_round2/T_selection_scan.json (first death of any agent at tick 81-82 in 15 seeds)",
        "death_isolation": True, "civ_control_rule": "stop at the last tick before any agent the focal agent ever perceived dies",
        "v1": {"memory_slots_base": memory_base()},
        "growth": {
            "v1_thresholds": {"pe": v1["pe"], "boredom": v1["boredom"], "novelty": v1["novelty"]},
            "v1_calibration": {"q": v1["q"], "furnished_mean_grants": v1["mean_grants"], "target": 1.0,
                               "data": "furnished_room, v1, growth off, reflection on/off, 10 seeds"},
            "v2_thresholds": {"pe": v2_pe, "boredom": 0.5, "novelty": 0.2},
            "v2_pe_rule": "95th percentile of 24-tick windowed held-out NLL ratio (pooled over seeds)"
                          + ("; overridden by furnished-room calibration" if v2_pe_override is not None else ""),
            "v2_pe_heldout_95th": pe95,
            "v2_nll_baseline_by_seed": base,
            "round1_values": {"v1": {"pe": 0.4, "boredom": 0.5, "novelty": 0.2},
                              "v2": {"pe": 1.25, "baseline": "in-sample last 48 life ticks"}},
        },
        "v2": {"pretrain_attempt": attempt, "gate": gate,
               "gate_rule": "held-out one-step MSE < persistence MSE in >= 8 of 10 seeds (battery-F1 procedure)"},
        "K": 168,
        "everything_else": "as prereg/params_v3.json",
    }
    blob = json.dumps(params, sort_keys=True, indent=1)
    (ROOT / "prereg" / "params_round2.json").write_text(blob, encoding="utf-8", newline="\n")
    h = hashlib.sha256(blob.encode("utf-8")).hexdigest()
    now = datetime.datetime.now().strftime("%Y-%m-%d %H:%M")
    entry = (f"| {now} | round 2 frozen (params_round2.json) | {h} | **yes: round-1 results seen** | "
             f"Post-hoc changes, with old -> new: v1 thresholds PE 0.4 -> {v1['pe']:.4f}, boredom 0.5 -> {v1['boredom']:.4f}, "
             f"novelty 0.2 -> {v1['novelty']:.6f} (furnished-room calibration, target 1 grant/run); v2 PE baseline in-sample -> "
             f"held-out, threshold 1.25 -> {v2_pe:.3f}; T 720 -> {T_LIFE}; death isolation on; civ_control stops before the "
             f"first perceivable death. Reasons: round-1 problems 1-4 (RESULTS.md, MORNING_REPORT.md). {note} |\n")
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
