"""Records golden digests from the engine. Run once, from unmodified CivSYS main.

    python -m tests.civsys.golden.make_golden      (cwd = repo root)
"""
import json
import pathlib

from app.simulation.engine import SimulationEngine
from tests.civsys.golden.canonical import tick_digest, cells_digest

SEEDS = [42, 101, 202]
POP, W, H, TICKS = 150, 128, 128, 200


def trajectory(engine_cls, seed, **kw):
    e = engine_cls(seed=seed, population_size=POP, width=W, height=H, **kw)
    digests = [tick_digest(e.state)]
    for _ in range(TICKS):
        e.step()
        digests.append(tick_digest(e.state))
    return {"ticks": digests, "cells_final": cells_digest(e.state)}


if __name__ == "__main__":
    out = {"config": {"seeds": SEEDS, "pop": POP, "w": W, "h": H, "ticks": TICKS}, "runs": {}}
    for s in SEEDS:
        out["runs"][str(s)] = trajectory(SimulationEngine, s)
        print("seed", s, out["runs"][str(s)]["ticks"][-1][:16])
    p = pathlib.Path(__file__).with_name("default_hashes.json")
    p.write_text(json.dumps(out, indent=1))
    print("wrote", p)
