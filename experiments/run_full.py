"""Full experiment driver (stage 4): every cell x seed, resumable, parallel, probed out-of-band.

Phase A: growth in {on, off}.  Phase B: schedule_matched and random_growth, yoked to the
growth-on run with the same seed and cell settings (D16).
    python -m experiments.run_full --K 672 --workers 12
"""
from __future__ import annotations

import argparse
import json
import multiprocessing as mp
import os
import subprocess
import sys
import time
from pathlib import Path

from experiments.common import ROOT, RUN_ROOT, SEEDS, life_dir, memory_base, run_cell

ARMS = ("civ_control", "furnished_room", "exteroception_removed", "full_deprivation", "fade_out", "noise_only")
OUT = RUN_ROOT / "full"


def cells(K: int):
    from whiteroom.config import CellConfig
    out = []
    for arm in ARMS:
        for refl in (True, False):
            for g in ("on", "off", "schedule_matched"):
                out.append(CellConfig(arm=arm, mind="v1", growth=g, reflection=refl, K=K))
            for g in ("on", "off", "schedule_matched", "random_growth"):
                for learning in ("replay_only", "replay_plus_imagination"):
                    out.append(CellConfig(arm=arm, mind="v2", growth=g, reflection=refl, learning=learning, K=K))
    return out


def cell_dir(seed, cell) -> Path:
    return OUT / f"K{cell.K}" / f"seed_{seed}" / cell.key()


def _occupancy(mind):
    return float(getattr(mind, "last_modalities", {}).get("vision", 0.0))


def run_one(args):
    seed, cell_json, mem_base, yoke = args
    os.environ["PYTHONDONTWRITEBYTECODE"] = "1"
    from whiteroom.config import CellConfig
    from whiteroom.v2io import save_snapshot
    from battery import synthetic
    cell = CellConfig(**cell_json)
    d = cell_dir(seed, cell)
    if (d / "battery.json").exists():
        return {"seed": seed, "cell": cell.key(), "skipped": True}
    import shutil as _sh
    waited = 0
    while _sh.disk_usage(str(ROOT)).free < 4 * 1024 ** 3:   # disk guard: never start a cell on a nearly full disk
        if waited >= 1800:
            return {"seed": seed, "cell": cell.key(), "error": "disk guard: free space stayed below 4 GB for 30 min"}
        time.sleep(30)
        waited += 30
    if d.exists():   # interrupted earlier (run or probe incomplete): start this cell clean
        import shutil
        shutil.rmtree(d)
    t0 = time.time()
    checkpoints = {}

    def hook(tau, mind, room):
        save_snapshot(mind, d / "snapshots" / f"tau_{tau:04d}")
        gt = room.ground_truth(tau) if room is not None else {
            "feedback": "civsys", "turn_changes_proprio": True, "move_changes_proprio": True, "vision_present": True}
        gt["true_vision_occupied"] = _occupancy(mind)
        checkpoints[str(tau)] = gt

    try:
        summary = run_cell(seed, cell, d, mem_base, yoke=yoke, snapshot_hook=hook)
    except Exception as e:  # recorded, never silently dropped
        d.mkdir(parents=True, exist_ok=True)
        (d / "error.txt").write_text(repr(e))
        return {"seed": seed, "cell": cell.key(), "error": repr(e)}
    if not checkpoints and (d / "probe_context.json").exists():
        pass
    else:
        h_S_T = summary.get("S_T")
        (d / "probe_context.json").write_text(json.dumps({
            "life_dir": str(life_dir(seed)), "mind": cell.mind, "S_T": h_S_T, "checkpoints": checkpoints,
            "synthetic_digest": synthetic.digest(synthetic.generate())}))
    t_run = time.time() - t0
    pr = subprocess.run([sys.executable, "-m", "battery.probe", str(d)], cwd=str(ROOT), capture_output=True,
                        text=True, timeout=1800, env={**os.environ, "PYTHONDONTWRITEBYTECODE": "1"})
    if pr.returncode != 0:
        (d / "probe_error.txt").write_text(pr.stderr[-5000:])
    return {"seed": seed, "cell": cell.key(), "run_s": round(t_run, 1), "probe_s": round(time.time() - t0 - t_run, 1),
            "probe_ok": pr.returncode == 0}


def _status(msg):
    p = OUT / "progress.log"
    p.parent.mkdir(parents=True, exist_ok=True)
    with open(p, "a", encoding="utf-8") as fh:
        fh.write(f"{time.strftime('%H:%M:%S')} {msg}\n")


def main(K: int, workers: int, seeds=SEEDS, only=None):
    mem = memory_base()
    all_cells = cells(K)
    if only:
        all_cells = [c for c in all_cells if only(c)]
    phase_a = [(s, c) for s in seeds for c in all_cells if c.growth in ("on", "off")]
    phase_b = [(s, c) for s in seeds for c in all_cells if c.growth in ("schedule_matched", "random_growth")]
    ctx = mp.get_context("spawn")
    done = 0
    total = len(phase_a) + len(phase_b)
    _status(f"start K={K} workers={workers} cells={total} mem_base={mem}")
    with ctx.Pool(workers) as pool:
        for res in pool.imap_unordered(run_one, [(s, c.model_dump(), mem, None) for s, c in phase_a]):
            done += 1
            _status(f"[{done}/{total}] {json.dumps(res)}")
        jobs = []
        for s, c in phase_b:
            on = c.model_copy(update={"growth": "on"})
            sp = cell_dir(s, on) / "summary.json"
            yoke = [tuple(x) for x in json.loads(sp.read_text())["grant_timeline"]] if sp.exists() else []
            jobs.append((s, c.model_dump(), mem, yoke))
        for res in pool.imap_unordered(run_one, jobs):
            done += 1
            _status(f"[{done}/{total}] {json.dumps(res)}")
    _status("finished")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--K", type=int, required=True)
    ap.add_argument("--workers", type=int, default=12)
    a = ap.parse_args()
    main(a.K, a.workers)
