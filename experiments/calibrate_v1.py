"""Round 2, Change 5: recalibrate v1 growth thresholds on furnished-room runs only.

Replays logged furnished-room telemetry (growth off) through the real GrowthHarness under candidate
thresholds, with requests generated exactly as the v1 mind's scripted rule would, and picks the single
quantile q whose mean grants per run is closest to the pre-declared target (DECISIONS_ROUND2.md).
    python -m experiments.calibrate_v1
"""
import csv
import json
from collections import deque
from pathlib import Path

import numpy as np

from experiments.common import ROOT
from growth import ops_v1
from growth.harness import GrowthHarness, TriggerConfig, v1_rules
from mind.channel import CapacityChannel
from mind.types import CapacityKind as K, ReasonCode as R, Telemetry

TARGET, BAND = 1.0, (0.5, 1.5)
FAMILY_KINDS = {R.PREDICTION_ERROR: (K.MEMORY_SLOTS, K.EXPECTATION_DIMS), R.BOREDOM: (K.SELF_MODEL_NODES,),
                R.REFLECTIVE_BACKLOG: (K.REFLECTION_WORKING_SET, K.SELF_MODEL_NODES)}


def load_runs(d: Path):
    runs = []
    for p in sorted(d.glob("*/ticks.csv")):
        with open(p, newline="", encoding="utf-8") as fh:
            rows = list(csv.DictReader(fh))
        runs.append([{"pe": float(r["pe"]), "boredom": float(r["I_boredom"]), "novelty": float(r["novelty"]),
                      "full": int(r["open_queries"] or 0) >= int(float(r["cap_reflection_working_set"])),
                      "abandoned": len([x for x in (r["q_abandoned"] or "").split("|") if x])} for r in rows])
    return runs


def windowed(runs, key):
    out = []
    for run in runs:
        v = [t[key] for t in run]
        out += [float(np.mean(v[i - 24:i])) for i in range(24, len(v) + 1)]
    return np.array(out)


class _Handles:
    kinds = (K.MEMORY_SLOTS, K.EXPECTATION_DIMS, K.SELF_MODEL_NODES, K.REFLECTION_WORKING_SET)

    def __init__(self, mem_base):
        self.s = {K.MEMORY_SLOTS: mem_base, K.EXPECTATION_DIMS: 5, K.SELF_MODEL_NODES: 8, K.REFLECTION_WORKING_SET: 2}

    def size(self, k):
        return float(self.s[k])

    def grow(self, k, step):
        self.s[k] += step


class _Replay:
    def __init__(self, mem_base):
        self.h = _Handles(mem_base)
        self.t = Telemetry()

    def telemetry(self):
        return self.t

    def capacity_handles(self):
        return self.h


def simulate(run, pe_t, bo_t, nv_t, mem_base=62):
    mind = _Replay(mem_base)
    harness = GrowthHarness(v1_rules(mem_base), "on", ops_v1.apply, TriggerConfig(pe_t, bo_t, nv_t))
    ch = CapacityChannel()
    win, rot, full_run = deque(maxlen=24), {f: 0 for f in FAMILY_KINDS}, 0
    for tau, t in enumerate(run, start=1):
        win.append(t)
        full_run = full_run + 1 if t["full"] else 0
        fams = []
        if len(win) == 24:
            if np.mean([x["pe"] for x in win]) >= pe_t:
                fams.append(R.PREDICTION_ERROR)
            if np.mean([x["boredom"] for x in win]) >= bo_t and np.mean([x["novelty"] for x in win]) <= nv_t:
                fams.append(R.BOREDOM)
            if full_run >= 24 or t["abandoned"] >= 3:
                fams.append(R.REFLECTIVE_BACKLOG)
        for f in fams:
            kinds = FAMILY_KINDS[f]
            ch.request_capacity(kinds[rot[f] % len(kinds)], f)
            rot[f] += 1
        mind.t = Telemetry(t["pe"], t["boredom"], t["novelty"], t["full"], t["abandoned"])
        harness.tick(tau, mind, ch)
    return harness.grants_total


def main():
    runs = load_runs(ROOT / "runs_round2" / "calib_v1")
    pe_w, bo_w, nv_w = windowed(runs, "pe"), windowed(runs, "boredom"), windowed(runs, "novelty")
    grid = []
    for q in [0.5, 0.6, 0.7, 0.75, 0.8, 0.85, 0.9, 0.925, 0.95, 0.97, 0.98, 0.99, 0.995, 0.999]:
        pe_t, bo_t, nv_t = float(np.quantile(pe_w, q)), float(np.quantile(bo_w, q)), float(np.quantile(nv_w, 1 - q))
        g = [simulate(r, pe_t, bo_t, nv_t) for r in runs]
        grid.append({"q": q, "pe": pe_t, "boredom": bo_t, "novelty": nv_t, "mean_grants": float(np.mean(g)),
                     "per_run": g})
    best = min(grid, key=lambda x: (abs(x["mean_grants"] - TARGET), -x["q"]))
    old = {"pe": 0.4, "boredom": 0.5, "novelty": 0.2}
    old_grants = float(np.mean([simulate(r, **{"pe_t": 0.4, "bo_t": 0.5, "nv_t": 0.2}) for r in runs]))
    out = {"target": TARGET, "band": BAND, "n_runs": len(runs), "grid": grid, "chosen": best,
           "in_band": BAND[0] <= best["mean_grants"] <= BAND[1], "round1_thresholds": old,
           "round1_mean_grants_on_same_runs": old_grants,
           "windowed_stats": {"pe": [float(pe_w.min()), float(np.median(pe_w)), float(pe_w.max())],
                              "boredom": [float(bo_w.min()), float(np.median(bo_w)), float(bo_w.max())],
                              "novelty": [float(nv_w.min()), float(np.median(nv_w)), float(nv_w.max())]}}
    (ROOT / "results_round2" / "v1_threshold_calibration.json").write_text(json.dumps(out, indent=1))
    return out


if __name__ == "__main__":
    o = main()
    for g in o["grid"]:
        print(f"q={g['q']:.3f} pe>={g['pe']:.3f} bor>={g['boredom']:.3f} nov<={g['novelty']:.3f} mean_grants={g['mean_grants']:.2f}")
    print("chosen", {k: o["chosen"][k] for k in ("q", "pe", "boredom", "novelty", "mean_grants")}, "in_band", o["in_band"],
          "| round-1 thresholds on same runs:", o["round1_mean_grants_on_same_runs"], o["windowed_stats"])
