"""Shared experiment settings and helpers."""
import json
import pathlib
import statistics
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
for i, p in enumerate((ROOT, ROOT / "civsys" / "backend")):   # CivSYS is the git submodule civsys/
    if str(p) not in sys.path:
        sys.path.insert(i, str(p))

import os

# 505 replaced by 1010: its focal agent died of CivSYS natural mortality at life tick 200 (DECISIONS_OVERNIGHT.md)
SEEDS = [42, 101, 202, 303, 404, 1010, 606, 707, 808, 909]
PILOT_SEEDS = [42, 101, 202, 303]
ROUND = int(os.environ.get("CIVSYS_ROUND", "1"))
if ROUND == 2:
    # Round 2 (DECISIONS_ROUND2.md): life ends at T = 80, before any death the focal agent could perceive
    LIFE_DIR = ROOT / "runs_round2" / "life"
    T_LIFE = 80
    RUN_ROOT = ROOT / "runs_round2"
else:
    LIFE_DIR = ROOT / "runs" / "life"
    T_LIFE = 720
    RUN_ROOT = ROOT / "runs"


def life_dir(seed: int) -> pathlib.Path:
    return LIFE_DIR / f"seed_{seed}"


def ensure_lives(seeds=SEEDS) -> list:
    sys.path.insert(0, str(ROOT / "scripts"))
    from run_life import run_life  # noqa: E402
    r2 = ROUND == 2
    return [run_life(s, LIFE_DIR, T=T_LIFE, death_isolation=r2, export_all_agents=r2) for s in seeds]


def memory_base(seeds=SEEDS) -> int:
    """Q21: median v1 memory count at T across the life seeds actually run."""
    counts = []
    for s in seeds:
        p = life_dir(s) / "life_summary.json"
        if p.exists():
            info = json.loads(p.read_text())
            if info.get("alive"):            # only lives that reached T
                counts.append(info["n_memories_v1"])
    return int(round(statistics.median(counts)))


def thresholds_for_seed(seed: int):
    """Round 2: growth thresholds frozen in prereg/params_round2.json. Round 1: code defaults (None)."""
    if ROUND != 2:
        return None
    data = json.loads((ROOT / "prereg" / "params_round2.json").read_text(encoding="utf-8"))
    g = data["growth"]
    v2 = dict(g["v2_thresholds"])
    base = g["v2_nll_baseline_by_seed"].get(str(seed))
    if base is not None:
        v2["nll_baseline"] = base
    return {"v1": dict(g["v1_thresholds"]), "v2": v2}


def run_cell(seed: int, cell, out_dir, mem_base: int, yoke=None, snapshot_hook=None, room_cfg=None):
    from whiteroom.config import RoomConfig
    th = thresholds_for_seed(seed)
    if cell.arm == "civ_control":
        from experiments.civ_control import run_civ_cell
        return run_civ_cell(life_dir(seed), cell, out_dir, mem_base, yoke=yoke, snapshot_hook=snapshot_hook,
                            stop_before_perceivable_death=(ROUND == 2), thresholds=th)
    from whiteroom.runner import run_room_cell
    return run_room_cell(life_dir(seed), cell, out_dir, room_cfg or RoomConfig(), mem_base, yoke=yoke,
                         snapshot_hook=snapshot_hook, thresholds=th)
