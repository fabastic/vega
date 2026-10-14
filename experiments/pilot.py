"""Pilot (stage 2): 6 arms x v1 x growth {on, off} x reflection on, 4 seeds, K in {168, 672}.

Applies the decision rules fixed in DECISIONS_OVERNIGHT.md before the pilot ran.
    python experiments/pilot.py [--support floor|stock]
"""
import argparse
import json
import statistics
import time

from experiments.common import PILOT_SEEDS, ROOT, ensure_lives, memory_base, run_cell
from whiteroom.conditions import ALL_ARMS
from whiteroom.config import CellConfig, RoomConfig

DEPRIVATION = ("exteroception_removed", "full_deprivation", "fade_out", "noise_only")
METRICS = ("abs_time_error_mean", "phantom_rate", "grants", "queries_created", "action_entropy_mean")


def _metric_at(summary_dir, metric, upto):
    """Recompute a metric from ticks.csv truncated at tau <= upto (so 168-vs-672 contrasts are comparable)."""
    import csv
    from whiteroom.metrics import summarize
    with open(summary_dir / "ticks.csv", newline="", encoding="utf-8") as fh:
        rows = list(csv.DictReader(fh))
    s = json.loads((summary_dir / "summary.json").read_text())
    conv = []
    for r in rows:
        if int(r["tau"]) > upto:
            break
        c = {}
        for k, v in r.items():
            if k in ("action", "target", "phantom_origin", "rules", "predicted_action", "q_created", "q_resolved",
                     "q_abandoned", "q_revisited", "grant_kinds"):
                c[k] = v
            elif v in ("", "None"):
                c[k] = None
            else:
                try:
                    c[k] = float(v)
                except ValueError:
                    c[k] = v
        c["tau"] = int(c["tau"])
        for k in ("phantom", "replay", "grants", "requests"):
            c[k] = int(c[k] or 0)
        conv.append(c)
    return summarize(conv, upto, s["S_T"])[metric]


def run_pilot(support: str = "floor") -> dict:
    t0 = time.time()
    lives = ensure_lives()
    mem_base = memory_base()
    room_cfg = RoomConfig(metabolic_support=support)
    out_root = ROOT / "runs" / f"pilot_{support}"
    results = []
    for K in (168, 672):
        for seed in PILOT_SEEDS:
            for arm in ALL_ARMS:
                for growth in ("on", "off"):
                    cell = CellConfig(arm=arm, mind="v1", growth=growth, reflection=True, K=K)
                    d = out_root / f"K{K}" / f"seed_{seed}" / cell.key()
                    s = run_cell(seed, cell, d, mem_base, room_cfg=room_cfg)
                    results.append({"K": K, "seed": seed, "arm": arm, "growth": growth, "dir": str(d), **{
                        m: s.get(m) for m in METRICS + ("abs_time_error_100_168", "time_error_slope_100_168",
                                                         "body_clock_silent_from_tau", "state_hash_T", "nan_values",
                                                         "death_tau", "seconds", "replay_rate", "requests",
                                                         "temporal_tracks_time_discrepancy")}})
    report = {"support": support, "mem_base": mem_base, "lives": lives, "n_runs": len(results),
              "seconds": round(time.time() - t0, 1)}

    # pre-trigger equivalence: every arm/growth/K starts from the same mind state within a seed
    report["pretrigger_equal"] = {str(s): len({r["state_hash_T"] for r in results if r["seed"] == s}) == 1
                                  for s in PILOT_SEEDS}

    # room-length rule (growth on): contrast vs furnished at tau<=168 and at 672
    from pathlib import Path
    def get(K, seed, arm, growth="on"):
        return next(r for r in results if r["K"] == K and r["seed"] == seed and r["arm"] == arm and r["growth"] == growth)
    length = {}
    for m in METRICS:
        c168, c672 = [], []
        for arm in DEPRIVATION:
            for seed in PILOT_SEEDS:
                a, f = get(672, seed, arm), get(672, seed, "furnished_room")
                c168.append(_metric_at(Path(a["dir"]), m, 168) - _metric_at(Path(f["dir"]), m, 168))
                c672.append((a[m] or 0) - (f[m] or 0))
        m168, m672 = statistics.mean(c168), statistics.mean(c672)
        changed = abs(m672 - m168) > 0.25 * abs(m168) if abs(m168) > 1e-9 else abs(m672) > 1e-6
        length[m] = {"contrast_168": m168, "contrast_672": m672, "still_developing": changed}
    n_dev = sum(v["still_developing"] for v in length.values())
    report["room_length"] = {"per_metric": length, "n_developing": n_dev, "indicates_672": n_dev >= 2}

    # time-metric signal after the body clock goes silent (ticks 100-168, K=168, growth on)
    silent = [r["body_clock_silent_from_tau"] for r in results if r["K"] == 168 and r["growth"] == "on"]
    per_arm = {}
    for arm in ALL_ARMS:
        vals = [get(168, s, arm)["abs_time_error_100_168"] for s in PILOT_SEEDS]
        per_arm[arm] = {"mean": statistics.mean(vals), "sd": statistics.pstdev(vals),
                        "slopes": [get(168, s, arm)["time_error_slope_100_168"] for s in PILOT_SEEDS]}
    means = [v["mean"] for v in per_arm.values()]
    spread = max(means) - min(means)
    within_sd = statistics.mean(v["sd"] for v in per_arm.values())
    slope_ok = any(abs(statistics.mean(per_arm[a]["slopes"])) > 0.001 for a in DEPRIVATION)
    report["time_signal"] = {"body_clock_silent_from_tau": silent, "per_arm_100_168": per_arm,
                             "across_arm_spread": spread, "mean_within_arm_sd": within_sd,
                             "has_signal": bool(spread > 2 * within_sd or slope_ok), "slope_rule_met": slope_ok}

    # artifact checks
    report["artifacts"] = {
        "nan_runs": [r["dir"] for r in results if r["nan_values"]],
        "deaths": [(r["seed"], r["arm"], r["K"], r["death_tau"]) for r in results if r["death_tau"]],
        "identical_across_seeds": [arm for arm in ALL_ARMS if len({json.dumps(
            json.loads((Path(get(168, s, arm)["dir"]) / "summary.json").read_text())["action_counts"], sort_keys=True)
            for s in PILOT_SEEDS}) == 1],
        "grants_total": sum(r["grants"] or 0 for r in results),
        "requests_total": sum(r["requests"] or 0 for r in results),
    }
    report["results"] = results
    (out_root / "pilot_report.json").write_text(json.dumps(report, indent=1, default=str))
    return report


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--support", default="floor")
    a = ap.parse_args()
    r = run_pilot(a.support)
    print(json.dumps({k: v for k, v in r.items() if k not in ("results", "lives")}, indent=1, default=str))
