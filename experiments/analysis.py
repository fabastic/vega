"""Stage-4 analysis: pre-registered contrasts, secondary contrasts, artifact checks, figures.

    python -m experiments.analysis --K 168
Writes results/summary_table.csv, results/contrasts.json, results/figures/*.png and returns a dict
used to write RESULTS.md. Every pre-registered contrast is reported, nulls included.
"""
from __future__ import annotations

import argparse
import csv
import json
import math
import random
import statistics
from collections import defaultdict
from pathlib import Path

import numpy as np

from experiments.common import ROOT, ROUND, RUN_ROOT, SEEDS

RES = ROOT / ("results_round2" if ROUND == 2 else "results")
FIG = RES / "figures"
DEPRIVATION = ("exteroception_removed", "full_deprivation", "fade_out", "noise_only")
ARMS = ("civ_control", "furnished_room") + DEPRIVATION
PRIMARY = ("phantom_rate", "abs_time_error_mean", "capability_change", "sd_change")
SECONDARY = ("queries_created", "action_entropy_mean", "replay_rate", "grants", "stereotypy_mean")


def load(K: int):
    rows = []
    for sd in sorted((RUN_ROOT / "full" / f"K{K}").glob("seed_*")):
        seed = int(sd.name.split("_")[1])
        for cd in sorted(sd.iterdir()):
            sp = cd / "summary.json"
            if not sp.exists():
                continue
            s = json.loads(sp.read_text())
            c = s["cell"]
            r = {"seed": seed, "arm": c["arm"], "mind": c["mind"], "growth": c["growth"], "reflection": c["reflection"],
                 "learning": c.get("learning") or "", "dir": str(cd)}
            for k in ("abs_time_error_mean", "time_error_final", "phantom_rate", "phantom_pre", "phantom_room",
                      "queries_created", "action_entropy_mean", "stereotypy_mean", "replay_rate", "grants",
                      "death_tau", "nan_values", "internal_goals_created", "temporal_tracks_time_discrepancy",
                      "sequence_repeat_rate", "ruminate_rate", "query_depth_max", "queries_resolved", "queries_abandoned",
                      "control_window", "control_stop_tau", "n_ticks"):
                r[k] = s.get(k)
            r["queries_by_type"] = s.get("queries_by_type", {})
            r["grants_by_kind"] = s.get("grants_by_kind", {})
            r["action_counts"] = s.get("action_counts", {})
            bp = cd / "battery.json"
            if bp.exists():
                b = json.loads(bp.read_text())["checkpoints"]
                b = sorted(b, key=lambda x: x["tau"])
                r["capability_T"], r["capability_end"] = b[0]["capability_score"], b[-1]["capability_score"]
                r["capability_change"] = r["capability_end"] - r["capability_T"]
                sdT = b[0]["self_discovery_composite"]
                sdE = b[-1]["self_discovery_composite"]
                r["sd_T"], r["sd_end"] = sdT, sdE
                r["sd_change"] = None if sdT is None or sdE is None else sdE - sdT
                for fam in ("F1", "F2", "F3", "F4", "F5"):
                    r[f"{fam}_end"] = b[-1]["families"].get(fam)
                    r[f"{fam}_change"] = (b[-1]["families"].get(fam) or 0) - (b[0]["families"].get(fam) or 0)
                r["params_end"] = b[-1].get("params")
                r["battery_curve"] = [x["capability_score"] for x in b]
                r["sd_curve"] = [x["self_discovery_composite"] for x in b]
            rows.append(r)
    return rows


def boot_ci(diffs, n=10000, seed=12345):
    diffs = [d for d in diffs if d is not None and not (isinstance(d, float) and math.isnan(d))]
    if len(diffs) < 2:
        return {"n": len(diffs), "mean": diffs[0] if diffs else None, "lo": None, "hi": None}
    rng = random.Random(seed)
    means = sorted(statistics.mean(rng.choice(diffs) for _ in diffs) for _ in range(n))
    return {"n": len(diffs), "mean": statistics.mean(diffs), "lo": means[int(0.025 * n)], "hi": means[int(0.975 * n) - 1],
            "excludes_zero": means[int(0.025 * n)] > 0 or means[int(0.975 * n) - 1] < 0}


def key(r, **over):
    d = {k: r[k] for k in ("arm", "mind", "growth", "reflection", "learning")}
    d.update(over)
    return tuple(d[k] for k in ("arm", "mind", "growth", "reflection", "learning"))


def paired(rows, a_over, b_over, metric, base_filter):
    idx = {(r["seed"],) + key(r): r for r in rows}
    diffs = []
    for r in rows:
        if not base_filter(r):
            continue
        ka = (r["seed"],) + key(r, **a_over)
        kb = (r["seed"],) + key(r, **b_over)
        if ka == (r["seed"],) + key(r) and kb in idx:
            va, vb = idx[ka].get(metric), idx[kb].get(metric)
            if va is not None and vb is not None:
                diffs.append(va - vb)
    return boot_ci(diffs)


def headline_settings():
    """The settings at which the headline contrasts are shown (all others are in contrasts.json)."""
    return [("v1", "on", True, ""), ("v2", "on", True, "replay_plus_imagination")]


def contrasts(rows):
    out = {"primary": {}, "growth_within_deprivation": {}, "secondary": {}}
    settings = sorted({(r["mind"], r["growth"], r["reflection"], r["learning"]) for r in rows})
    for (mind, g, refl, lrn) in settings:
        tag = f"{mind}|g={g}|refl={int(refl)}|{lrn or '-'}"
        for arm in DEPRIVATION:
            for m in PRIMARY + SECONDARY:
                out["primary"].setdefault(tag, {}).setdefault(arm, {})[m] = paired(
                    rows, {"arm": arm}, {"arm": "furnished_room"}, m,
                    lambda r, a=arm: r["arm"] == a and r["mind"] == mind and r["growth"] == g and
                    r["reflection"] == refl and r["learning"] == lrn)
    for (mind, refl, lrn) in sorted({(r["mind"], r["reflection"], r["learning"]) for r in rows}):
        tag = f"{mind}|refl={int(refl)}|{lrn or '-'}"
        for m in PRIMARY + SECONDARY:
            out["growth_within_deprivation"].setdefault(tag, {})[m] = paired(
                rows, {"growth": "on"}, {"growth": "off"}, m,
                lambda r: r["arm"] == "full_deprivation" and r["mind"] == mind and r["growth"] == "on" and
                r["reflection"] == refl and r["learning"] == lrn)
    sec = out["secondary"]
    for arm in ARMS:
        for mind in ("v1", "v2"):
            lrn = "replay_plus_imagination" if mind == "v2" else ""
            base = lambda r, a=arm, mi=mind, l=lrn: r["arm"] == a and r["mind"] == mi and r["reflection"] and r["learning"] == l
            for m in ("capability_change", "sd_change", "grants", "abs_time_error_mean", "phantom_rate", "queries_created"):
                sec.setdefault(f"on_vs_schedule_matched|{mind}|{arm}", {})[m] = paired(
                    rows, {"growth": "on"}, {"growth": "schedule_matched"}, m, lambda r, b=base: b(r) and r["growth"] == "on")
                sec.setdefault(f"reflection_on_vs_off|{mind}|{arm}", {})[m] = paired(
                    rows, {"reflection": True}, {"reflection": False}, m, lambda r, b=base: b(r) and r["growth"] == "on")
                if mind == "v2":
                    sec.setdefault(f"on_vs_random_growth|v2|{arm}", {})[m] = paired(
                        rows, {"growth": "on"}, {"growth": "random_growth"}, m, lambda r, b=base: b(r) and r["growth"] == "on")
                    sec.setdefault(f"imagination_vs_replay_only|v2|{arm}", {})[m] = paired(
                        rows, {"learning": "replay_plus_imagination"}, {"learning": "replay_only"}, m,
                        lambda r, a=arm: r["arm"] == a and r["mind"] == "v2" and r["reflection"] and r["growth"] == "on"
                        and r["learning"] == "replay_plus_imagination")
        for mind in ("v1", "v2"):
            lrn = "replay_plus_imagination" if mind == "v2" else ""
            for m in ("abs_time_error_mean", "phantom_rate", "queries_created", "capability_change"):
                sec.setdefault(f"furnished_vs_civ_control|{mind}", {})[m] = paired(
                    rows, {"arm": "furnished_room"}, {"arm": "civ_control"}, m,
                    lambda r, mi=mind, l=lrn: r["arm"] == "furnished_room" and r["mind"] == mi and r["growth"] == "on"
                    and r["reflection"] and r["learning"] == l)
    return out


def interpret(sd_ci, fam_cis, on_vs_sched, on_vs_rand):
    """Pre-registered interpretation rule (SPEC L.4) for growth on vs off within deprivation."""
    sd_up = bool(sd_ci.get("excludes_zero")) and (sd_ci["mean"] or 0) > 0
    gen_up = any(bool(c.get("excludes_zero")) and (c["mean"] or 0) > 0 for c in fam_cis)
    label = "both" if sd_up and gen_up else "self-discovery-like" if sd_up else \
        "general capability increase" if gen_up else "no effect"
    attributable = all(bool(c and c.get("excludes_zero")) and (c["mean"] or 0) > 0 for c in (on_vs_sched, on_vs_rand) if c is not None)
    if label != "no effect" and not attributable:
        label += " (not attributed to state-contingent or function-preserving growth)"
    return label


def artifacts(rows, K):
    out = {"nan_runs": [r["dir"] for r in rows if r.get("nan_values")],
           "deaths": [(r["seed"], r["arm"], r["mind"], r["growth"], r["death_tau"]) for r in rows if r.get("death_tau")],
           "missing_battery": [r["dir"] for r in rows if r.get("capability_T") is None]}
    groups = defaultdict(list)
    for r in rows:
        groups[key(r)].append(json.dumps(r["action_counts"], sort_keys=True))
    out["identical_across_seeds"] = [list(k) for k, v in groups.items() if len(v) > 1 and len(set(v)) == 1]
    collapse = []
    for r in rows:
        if r["mind"] != "v2":
            continue
        tp = Path(r["dir"]) / "ticks.csv"
        with open(tp, newline="", encoding="utf-8") as fh:
            ts = list(csv.DictReader(fh))
        kl = [float(t["kl"]) for t in ts if t.get("kl") not in (None, "", "None")]
        er = [float(t["latent_eff_rank"]) for t in ts if t.get("latent_eff_rank") not in (None, "", "None")]
        low_kl_run, run = 0, 0
        for v in kl:
            run = run + 1 if v < 0.01 else 0
            low_kl_run = max(low_kl_run, run)
        if low_kl_run >= 24 or (er and min(er) < 2.0):
            collapse.append({"dir": r["dir"], "max_low_kl_run": low_kl_run, "min_eff_rank": min(er) if er else None})
    out["v2_collapse_flags"] = collapse
    out["v2_runs"] = sum(1 for r in rows if r["mind"] == "v2")
    big = []
    for r in rows:
        for m in ("capability_change", "sd_change"):
            v = r.get(m)
            if v is not None and abs(v) > 0.5:
                big.append((r["dir"], m, v))
    out["implausibly_large_changes"] = big
    return out


def mean_by(rows, metric, **filt):
    vals = [r[metric] for r in rows if all(r[k] == v for k, v in filt.items()) and r.get(metric) is not None]
    return statistics.mean(vals) if vals else None


def figures(rows, K):
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    FIG.mkdir(parents=True, exist_ok=True)
    made = []
    for metric, label in (("abs_time_error_mean", "mean |time-estimate error|"), ("phantom_rate", "phantom-percept rate"),
                          ("queries_created", "reflective queries created"), ("capability_change", "capability score change (T to end)")):
        fig, ax = plt.subplots(figsize=(8, 3.6))
        w = 0.38
        for i, (mind, lrn) in enumerate((("v1", ""), ("v2", "replay_plus_imagination"))):
            ms, lo, hi = [], [], []
            for arm in ARMS:
                vals = [r[metric] for r in rows if r["arm"] == arm and r["mind"] == mind and r["growth"] == "on"
                        and r["reflection"] and r["learning"] == lrn and r.get(metric) is not None]
                ci = boot_ci(vals) if len(vals) > 1 else {"mean": vals[0] if vals else 0, "lo": None, "hi": None}
                ms.append(ci["mean"] or 0)
                lo.append((ci["mean"] or 0) - (ci["lo"] if ci["lo"] is not None else (ci["mean"] or 0)))
                hi.append((ci["hi"] if ci["hi"] is not None else (ci["mean"] or 0)) - (ci["mean"] or 0))
            x = np.arange(len(ARMS)) + (i - 0.5) * w
            ax.bar(x, ms, w, yerr=[lo, hi], capsize=3, label=f"{mind} (growth on, reflection on)")
        ax.set_xticks(np.arange(len(ARMS)))
        ax.set_xticklabels([a.replace("_", "\n") for a in ARMS], fontsize=8)
        ax.set_ylabel(label)
        ax.set_title(f"{label} by arm, K={K}, mean over 10 seeds with 95% bootstrap CI", fontsize=9)
        ax.legend(fontsize=8)
        fig.tight_layout()
        p = FIG / f"{metric}_by_arm.png"
        fig.savefig(p, dpi=110)
        plt.close(fig)
        made.append(p.name)
    # capability and self-discovery curves over checkpoints
    for curve, label in (("battery_curve", "capability score"), ("sd_curve", "self-discovery composite")):
        fig, axes = plt.subplots(1, 2, figsize=(9, 3.4), sharey=True)
        for ax, (mind, lrn) in zip(axes, (("v1", ""), ("v2", "replay_plus_imagination"))):
            for arm in ARMS:
                cs = [r[curve] for r in rows if r["arm"] == arm and r["mind"] == mind and r["growth"] == "on"
                      and r["reflection"] and r["learning"] == lrn and r.get(curve)]
                if cs:
                    arr = np.array([[np.nan if v is None else v for v in c] for c in cs], dtype=float)
                    ax.plot(np.linspace(0, K, arr.shape[1]), np.nanmean(arr, 0), marker="o", label=arm)
            ax.set_title(f"{mind}", fontsize=9)
            ax.set_xlabel("room tick")
        axes[0].set_ylabel(label)
        axes[1].legend(fontsize=7)
        fig.suptitle(f"{label} at checkpoints (growth on, reflection on), mean over seeds", fontsize=9)
        fig.tight_layout()
        p = FIG / f"{curve}.png"
        fig.savefig(p, dpi=110)
        plt.close(fig)
        made.append(p.name)
    # time-error trajectories from ticks.csv
    fig, axes = plt.subplots(1, 2, figsize=(9, 3.4), sharey=True)
    for ax, (mind, lrn) in zip(axes, (("v1", ""), ("v2", "replay_plus_imagination"))):
        for arm in ARMS:
            curves = []
            for r in rows:
                if r["arm"] == arm and r["mind"] == mind and r["growth"] == "on" and r["reflection"] and r["learning"] == lrn:
                    s = json.loads((Path(r["dir"]) / "summary.json").read_text())
                    with open(Path(r["dir"]) / "ticks.csv", newline="", encoding="utf-8") as fh:
                        ts = list(csv.DictReader(fh))
                    curves.append([abs(((float(t["S"]) - s["S_T"]) - int(t["tau"])) / int(t["tau"])) for t in ts])
            if curves:
                n = min(len(c) for c in curves)
                ax.plot(range(1, n + 1), np.mean([c[:n] for c in curves], 0), label=arm)
        ax.set_title(mind, fontsize=9)
        ax.set_xlabel("room tick")
    axes[0].set_ylabel("|time-estimate error|")
    axes[1].legend(fontsize=7)
    fig.tight_layout()
    p = FIG / "time_error_trajectories.png"
    fig.savefig(p, dpi=110)
    plt.close(fig)
    made.append(p.name)
    return made


def write_table(rows):
    RES.mkdir(parents=True, exist_ok=True)
    cols = ["seed", "arm", "mind", "growth", "reflection", "learning", "abs_time_error_mean", "phantom_rate", "phantom_pre",
            "phantom_room", "queries_created", "action_entropy_mean", "stereotypy_mean", "replay_rate", "grants",
            "capability_T", "capability_end", "capability_change", "sd_T", "sd_end", "sd_change", "F1_end", "F2_end",
            "F3_end", "F4_end", "F5_end", "params_end", "death_tau", "temporal_tracks_time_discrepancy"]
    with open(RES / "summary_table.csv", "w", newline="", encoding="utf-8") as fh:
        w = csv.DictWriter(fh, fieldnames=cols, extrasaction="ignore")
        w.writeheader()
        w.writerows(rows)


def main(K: int) -> dict:
    rows = load(K)
    write_table(rows)
    c = contrasts(rows)
    art = artifacts(rows, K)
    figs = figures(rows, K)
    interp = {}
    for (mind, refl, lrn) in sorted({(r["mind"], r["reflection"], r["learning"]) for r in rows}):
        tag = f"{mind}|refl={int(refl)}|{lrn or '-'}"
        g = c["growth_within_deprivation"][tag]
        fam = [paired(rows, {"growth": "on"}, {"growth": "off"}, f"{f}_change",
                      lambda r: r["arm"] == "full_deprivation" and r["mind"] == mind and r["growth"] == "on" and
                      r["reflection"] == refl and r["learning"] == lrn) for f in ("F1", "F2", "F3", "F4")]
        sched = paired(rows, {"growth": "on"}, {"growth": "schedule_matched"}, "sd_change",
                       lambda r: r["arm"] == "full_deprivation" and r["mind"] == mind and r["growth"] == "on" and
                       r["reflection"] == refl and r["learning"] == lrn)
        rand = paired(rows, {"growth": "on"}, {"growth": "random_growth"}, "sd_change",
                      lambda r: r["arm"] == "full_deprivation" and r["mind"] == mind and r["growth"] == "on" and
                      r["reflection"] == refl and r["learning"] == lrn) if mind == "v2" else None
        interp[tag] = {"label": interpret(g["sd_change"], fam, sched, rand), "family_changes_on_minus_off": fam}
    out = {"K": K, "n_runs": len(rows), "contrasts": c, "artifacts": art, "figures": figs, "interpretation": interp,
           "grants_by_mind_arm": {f"{m}|{a}": mean_by(rows, "grants", mind=m, arm=a, growth="on")
                                  for m in ("v1", "v2") for a in ARMS}}
    (RES / "contrasts.json").write_text(json.dumps(out, indent=1, default=str))
    return out


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--K", type=int, default=168)
    a = ap.parse_args()
    o = main(a.K)
    print(json.dumps({"n_runs": o["n_runs"], "artifacts": {k: (len(v) if isinstance(v, list) else v) for k, v in o["artifacts"].items()},
                      "interpretation": {k: v["label"] for k, v in o["interpretation"].items()}}, indent=1))
