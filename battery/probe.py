"""Out-of-band prober (SPEC L.1): runs in its own process over a cell's frozen snapshots.

    python -m battery.probe <cell_dir> [--keep]

Reads <cell_dir>/probe_context.json and <cell_dir>/snapshots/tau_XXXX/, writes
<cell_dir>/battery.json, then deletes snapshot tensors (disk budget) unless --keep.
"""
from __future__ import annotations

import argparse
import csv
import json
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

import numpy as np  # noqa: E402

from battery import synthetic, tasks  # noqa: E402
from mind.types import ACTION_KINDS, ActionKind  # noqa: E402

_IDX = {k.value: i for i, k in enumerate(ACTION_KINDS)}
FEATS = [f"f{i}" for i in range(58)]


def load_heldout(life_dir: pathlib.Path, lo=600, hi=647) -> list:
    out = []
    with open(life_dir / "life.csv", newline="", encoding="utf-8") as fh:
        rows = [r for r in csv.DictReader(fh) if lo <= int(r["tick"]) <= hi]
    if rows:
        out.append({"source": "focal_life_600_647", "X": np.array([[float(r[c]) for c in FEATS] for r in rows], np.float32),
                    "A": np.array([_IDX[r["action"]] for r in rows], np.int64)})
    for p in sorted(life_dir.glob("heldout_agent_*.csv")):
        with open(p, newline="", encoding="utf-8") as fh:
            rows = list(csv.DictReader(fh))
        if len(rows) >= 30:
            out.append({"source": p.stem, "X": np.array([[float(r[c]) for c in FEATS] for r in rows], np.float32),
                        "A": np.array([_IDX[r["action"]] for r in rows], np.int64)})
    return out


def run(cell_dir: pathlib.Path, keep: bool = False) -> dict:
    import torch
    torch.set_num_threads(1)
    torch.use_deterministic_algorithms(True)
    from whiteroom.v2io import load_snapshot
    ctx = json.loads((cell_dir / "probe_context.json").read_text())
    heldout = load_heldout(pathlib.Path(ctx["life_dir"]))
    items = synthetic.generate()
    assert synthetic.digest(items) == ctx["synthetic_digest"], "synthetic battery set changed"
    with open(cell_dir / "ticks.csv", newline="", encoding="utf-8") as fh:
        rows = list(csv.DictReader(fh))
    acc_col = "v2_selfpred_acc" if ctx["mind"] == "v2" else "selfpred_acc"
    ref = tasks.life_reference(ctx["checkpoints"]["0"])
    suffix = "_ref" if ctx.get("sd_reference") == "life" else ""   # round 3 sets "life"; rounds 1-2: arm truth
    results, prev_sd5 = [], None
    for snap in sorted((cell_dir / "snapshots").glob("tau_*")):
        tau = int(snap.name.split("_")[1])
        mind = load_snapshot(snap)
        pred = tasks.predictor_for(mind)
        fam = tasks.family_scores(pred, heldout, items)
        gt = ctx["checkpoints"][str(tau)]
        window = [r for r in rows if 0 < int(r["tau"]) <= tau][-24:]
        sd = {"SD1": tasks.sd1_score(window, acc_col), "SD2": pred.sd2(gt), "SD3": pred.sd3(gt)}
        # round 3: SD2/SD3 against the arm's own truth favour simpler worlds and start at the ceiling in the furnished
        # room, so arm contrasts are not comparable. The *_ref versions score every arm against the same reference,
        # the life-world contingencies at handoff (self-model retention); the arm-truth versions stay as tracking.
        sd["SD2_ref"], sd["SD3_ref"] = pred.sd2(ref), pred.sd3(ref)
        sd_used = {"SD1": sd["SD1"], "SD2": sd[f"SD2{suffix}"], "SD3": sd[f"SD3{suffix}"]}
        row = next((r for r in rows if int(r["tau"]) == tau), None)
        sd["SD4"] = None if (row is None or tau == 0) else abs((float(row["S"]) - ctx["S_T"]) - tau) / tau
        cur = pred.sd5_predictions()
        sd["SD5"] = None if prev_sd5 is None else float(np.mean([a == b for a, b in zip(cur, prev_sd5)]))
        prev_sd5 = cur
        sd_used.update(SD4=sd["SD4"], SD5=sd["SD5"])
        fam["F5"] = float(np.mean([v for v in (sd_used["SD1"], sd_used["SD2"], sd_used["SD3"], sd_used["SD5"]) if v is not None]))
        results.append({"tau": tau, "families": fam, "capability_score": tasks.composite(fam), "self_discovery": sd,
                        "self_discovery_composite": tasks.sd_composite(sd_used), "sd_reference": ctx.get("sd_reference", "arm"),
                        "params": mind.model.param_count() if hasattr(mind, "model") else None})
        if not keep:   # disk budget: only battery.json is kept
            for f in list(snap.glob("*.safetensors")) + list(snap.glob("state.json")):
                f.unlink()
    out = {"cell_dir": str(cell_dir), "checkpoints": results, "heldout_sources": [h["source"] for h in heldout]}
    (cell_dir / "battery.json").write_text(json.dumps(out, indent=1))
    return out


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("cell_dir")
    ap.add_argument("--keep", action="store_true")
    a = ap.parse_args()
    run(pathlib.Path(a.cell_dir), a.keep)
