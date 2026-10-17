"""Furnished-room check of a candidate v2 surprise threshold before freezing (round 2 procedure, any round >= 2).

v2, growth on, reflection on, replay_plus_imagination, every seed, K = 168, candidate threshold = 95th percentile of
the held-out windowed NLL ratio from the given pre-training attempt. Writes RESULTS/v2_threshold_check.json.
    CIVSYS_ROUND=3 python -m experiments.verify_v2_threshold --attempt 3 --jobs 5
"""
import argparse
import json
import multiprocessing as mp
import os

from experiments.common import RESULTS, RUN_ROOT, SEEDS, life_dir, memory_base


def candidate(attempt: int):
    from experiments.freeze_round3 import v2_threshold
    pe95, base, _ = v2_threshold(attempt)
    return pe95, base


def one(args):
    seed, pe, base, mem = args
    os.environ["PYTHONDONTWRITEBYTECODE"] = "1"
    from whiteroom.config import CellConfig, RoomConfig
    from whiteroom.runner import run_room_cell
    th = {"v2": {"pe": pe, "boredom": 0.5, "novelty": 0.2, "nll_baseline": base[str(seed)]}}
    cell = CellConfig(arm="furnished_room", mind="v2", growth="on", reflection=True, learning="replay_plus_imagination",
                      K=168)
    s = run_room_cell(life_dir(seed), cell, RUN_ROOT / "verify_v2" / f"seed_{seed}", RoomConfig(), mem, thresholds=th)
    return {"seed": seed, "grants": s["grants"], "grants_by_kind": s["grants_by_kind"], "requests": s["requests"],
            "nan_values": s.get("nan_values")}


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--attempt", type=int, required=True)
    ap.add_argument("--jobs", type=int, default=5)
    a = ap.parse_args()
    pe, base = candidate(a.attempt)
    mem = memory_base()
    with mp.get_context("spawn").Pool(a.jobs) as pool:
        rows = pool.map(one, [(s, pe, base, mem) for s in SEEDS])
    out = {"attempt": a.attempt, "pe95": pe, "memory_base": mem, "rows": rows,
           "mean_grants": sum(r["grants"] for r in rows) / len(rows)}
    RESULTS.mkdir(parents=True, exist_ok=True)
    (RESULTS / "v2_threshold_check.json").write_text(json.dumps(out, indent=1))
    print(json.dumps({k: out[k] for k in ("attempt", "pe95", "mean_grants")}), flush=True)
