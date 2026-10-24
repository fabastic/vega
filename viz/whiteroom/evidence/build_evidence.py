"""Compact evidence data for the White Room evidence view (viz/whiteroom/evidence/).

Reads results_round2/summary_table.csv and results_round2/contrasts.json and writes evidence.json:
per mind x arm, the per-seed values, their mean and a 95% bootstrap CI over seeds, and the paired
contrast against furnished_room (cross-checked against contrasts.json). If the git-ignored per-tick
logs in runs_round2/ are present, it also writes the mean v2 trajectory (phantoms, subjective-clock
error) used by the chamber's "measured" mode.

Settings are the headline ones of RESULTS_ROUND2.md: growth on, reflection on, and for v2 the
replay_plus_imagination learning signal. Everything here is measured in vega; nothing is a claim
of felt experience.

    python viz/whiteroom/evidence/build_evidence.py [--runs <checkout>/runs_round2]
"""
import argparse
import csv
import json
import math
import random
import statistics
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
RES = ROOT / "results_round2"
RUNS = ROOT / "runs_round2" / "full" / "K168"
OUT = Path(__file__).resolve().parent / "evidence.json"

K = 168
ARMS = ["furnished_room", "exteroception_removed", "full_deprivation", "fade_out", "noise_only"]
SETTINGS = {"v1": ("on", "True", ""), "v2": ("on", "True", "replay_plus_imagination")}
SETTING_TAGS = {"v1": "v1|g=on|refl=1|-", "v2": "v2|g=on|refl=1|replay_plus_imagination"}
METRICS = ["phantom_rate", "phantom_per_tick", "abs_time_error_mean", "sd_change", "capability_change"]


def boot_ci(xs, n=10000, seed=12345):
    """Same resampler as experiments/analysis.py, so contrasts reproduce contrasts.json."""
    xs = [x for x in xs if x is not None and not math.isnan(x)]
    if len(xs) < 2:
        return {"n": len(xs), "mean": xs[0] if xs else None, "lo": None, "hi": None}
    rng = random.Random(seed)
    means = sorted(statistics.mean(rng.choice(xs) for _ in xs) for _ in range(n))
    lo, hi = means[int(0.025 * n)], means[int(0.975 * n) - 1]
    return {"n": len(xs), "mean": statistics.mean(xs), "lo": lo, "hi": hi, "excludes_zero": lo > 0 or hi < 0}


def num(v):
    return None if v in ("", None) else float(v)


def load_rows():
    rows = []
    with open(RES / "summary_table.csv", newline="") as f:
        for r in csv.DictReader(f):
            for mind, (g, refl, lrn) in SETTINGS.items():
                if (r["mind"], r["growth"], r["reflection"], r["learning"]) == (mind, g, refl, lrn) and r["arm"] in ARMS:
                    row = {"seed": int(r["seed"]), "mind": mind, "arm": r["arm"]}
                    for m in METRICS:
                        if m != "phantom_per_tick":
                            row[m] = num(r[m])
                    # phantoms per tick: the round-3 primary phantom metric (DECISIONS_ROUND3.md), derived here from
                    # the committed counts. Every room arm runs K = 168 ticks.
                    row["phantom_per_tick"] = (num(r["phantom_pre"]) + num(r["phantom_room"])) / K
                    rows.append(row)
    return rows


def r4(x):
    return None if x is None else round(x, 4)


def rounded(ci):
    return {k: (r4(v) if isinstance(v, float) else v) for k, v in ci.items()}


def trajectory():
    """Mean v2 per-tick trajectory across seeds, from the git-ignored tick logs (None if absent)."""
    if not RUNS.exists():
        return None
    g, refl, lrn = SETTINGS["v2"]
    name = lambda arm: f"{arm}__v2__g-{g}__r-1__{lrn}"
    out = {}
    for arm in ARMS:
        series = []
        for sd in sorted(RUNS.glob("seed_*")):
            p = sd / name(arm) / "ticks.csv"
            if not p.exists():
                continue
            with open(p, newline="") as f:
                ticks = list(csv.DictReader(f))
            S_T = float(ticks[0]["S"]) - 1.0  # same anchor as whiteroom/metrics.summarize
            series.append([(int(t["phantom"]), ((float(t["S"]) - S_T) - int(t["tau"])) / max(int(t["tau"]), 1)) for t in ticks])
        if not series:
            continue
        n = min(len(s) for s in series)
        out[arm] = {
            "n_seeds": len(series),
            "phantom": [r4(statistics.mean(s[i][0] for s in series)) for i in range(n)],
            "time_error": [r4(statistics.mean(s[i][1] for s in series)) for i in range(n)],
        }
    return out


def main():
    global RUNS
    ap = argparse.ArgumentParser()
    ap.add_argument("--runs", type=Path, help="runs_round2 directory, if not next to results_round2 (it is git-ignored)")
    args = ap.parse_args()
    if args.runs:
        RUNS = args.runs / "full" / "K168"
    rows = load_rows()
    published = json.loads((RES / "contrasts.json").read_text())["contrasts"]["primary"]
    by = {(r["mind"], r["arm"], r["seed"]): r for r in rows}
    cells, mismatches = {}, []
    for mind in SETTINGS:
        cells[mind] = {}
        for arm in ARMS:
            seeds = sorted(s for (m, a, s) in by if m == mind and a == arm)
            cell = {"seeds": seeds}
            for met in METRICS:
                vals = [by[(mind, arm, s)][met] for s in seeds]
                entry = {"points": [r4(v) for v in vals], "level": rounded(boot_ci(vals))}
                if arm != "furnished_room":
                    diffs = [by[(mind, arm, s)][met] - by[(mind, "furnished_room", s)][met]
                             for s in seeds if (mind, "furnished_room", s) in by
                             and by[(mind, arm, s)][met] is not None and by[(mind, "furnished_room", s)][met] is not None]
                    ci = boot_ci(diffs)
                    entry["vs_furnished"] = rounded(ci)
                    pub = published.get(SETTING_TAGS[mind], {}).get(arm, {}).get(met)
                    if pub is not None:
                        if abs(pub["mean"] - ci["mean"]) > 1e-9:
                            mismatches.append((mind, arm, met, pub["mean"], ci["mean"]))
                        entry["vs_furnished"]["source"] = "results_round2/contrasts.json (reproduced)"
                    else:
                        entry["vs_furnished"]["source"] = "derived from results_round2/summary_table.csv"
                cell[met] = entry
            cells[mind][arm] = cell
    if mismatches:
        raise SystemExit(f"contrast mismatch vs contrasts.json: {mismatches}")
    out = {
        "provenance": {
            "label": "measured in vega",
            "sources": ["results_round2/summary_table.csv", "results_round2/contrasts.json"],
            "settings": SETTING_TAGS,
            "ci": "95% bootstrap over seeds (10,000 resamples, seed 12345), as experiments/analysis.py",
            "caveats": [
                "Exploratory: 10 seeds, many contrasts, no multiplicity correction.",
                "phantom_rate is phantoms / targeted acts. It is exactly 1.0 whenever nothing is perceivable, so "
                "exteroception_removed, full_deprivation and noise_only sit at the ceiling and cannot be told apart "
                "(DECISIONS_ROUND3.md). phantom_per_tick = (phantom_pre + phantom_room) / 168 is shown alongside.",
                "abs_time_error_mean is the mean |relative subjective-clock error|; a negative contrast means the "
                "deprived mind tracked time better than in the furnished room.",
                "Functional state variables only, never claims of felt experience.",
            ],
        },
        "arms": ARMS,
        "metrics": METRICS,
        "cells": cells,
    }
    traj = trajectory()
    if traj:
        out["v2_trajectory"] = {
            "source": "runs_round2/full/K168/seed_*/<arm>__v2__g-on__r-1__replay_plus_imagination/ticks.csv "
                      "(git-ignored, regenerable; summarised in results_round2/figures/time_error_trajectories.png)",
            "time_error": "((S - S_T) - tau) / tau, as whiteroom/metrics.time_errors; below 0 = less time felt than passed",
            "arms": traj,
        }
    OUT.write_text(json.dumps(out, separators=(",", ":")))
    print(f"wrote {OUT} ({OUT.stat().st_size // 1024} KB), {len(rows)} runs, trajectory={'yes' if traj else 'no'}")


if __name__ == "__main__":
    main()
