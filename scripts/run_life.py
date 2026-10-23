"""Life phase: run CivSYS with the focal agent driven by the v1 mind, write the handoff at T.

    python scripts/run_life.py --seeds 42 101 --out runs/life     (cwd = repo root)

Skips seeds whose handoff already exists (resumable).
"""
import argparse
import json
import pathlib
import sys
import time

ROOT = pathlib.Path(__file__).resolve().parents[1]
for i, p in enumerate((ROOT, ROOT / "civsys" / "backend")):   # CivSYS lives in civsys/
    if str(p) not in sys.path:
        sys.path.insert(i, str(p))

from civsys_focal.config import FocalConfig  # noqa: E402
from civsys_focal.engine import FocalSimulationEngine  # noqa: E402
from civsys_focal.handoff_writer import write_life_outputs  # noqa: E402
from civsys_focal.viability import ViabilityConfig  # noqa: E402

HELDOUT = ["agent_0001", "agent_0002", "agent_0003"]


def run_life(seed: int, out_root: pathlib.Path, T: int = 720, pop: int = 150, size: int = 128,
             reflection: bool = True, force: bool = False, death_isolation: bool = False,
             export_all_agents: bool = False, viability: bool = False) -> dict:
    out = out_root / f"seed_{seed}"
    if (out / "handoff.json").exists() and not force:
        return {"seed": seed, "skipped": True}
    t0 = time.time()
    cfg = FocalConfig(enabled=True, affect_enabled=True, focal_policy="mind", export_enabled=True,
                      reflection_enabled=reflection, heldout_agent_ids=HELDOUT, snapshot_tick=T,
                      death_isolation=death_isolation, export_all_agents=export_all_agents,
                      history_ticks=min(168, T), viability=ViabilityConfig(enabled=viability))
    eng = FocalSimulationEngine(seed=seed, population_size=pop, width=size, height=size, focal=cfg)
    focal = eng.state.agents[cfg.focal_agent_id]
    while eng.state.tick < T:
        eng.step()
        if not focal.is_alive:
            break
    info = write_life_outputs(eng, seed, out)
    info.update(seed=seed, alive=focal.is_alive, tick=eng.state.tick, seconds=round(time.time() - t0, 1),
                n_memories_v1=len(eng.focal_state["mind"].memories))
    (out / "life_summary.json").write_text(json.dumps(info, indent=1))
    return info


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--seeds", type=int, nargs="+", default=[42])
    ap.add_argument("--out", default="runs/life")
    ap.add_argument("--T", type=int, default=720)
    ap.add_argument("--force", action="store_true")
    a = ap.parse_args()
    for s in a.seeds:
        print(json.dumps(run_life(s, ROOT / a.out, T=a.T, force=a.force)))
