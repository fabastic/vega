"""Shared fixture: a small, real handoff produced by the CivSYS life phase."""
import pathlib

_CACHE = {}


def small_handoff(tmp_root: pathlib.Path, seed: int = 21, T: int = 60) -> pathlib.Path:
    key = (seed, T)
    if key in _CACHE and (_CACHE[key] / "handoff.json").exists():
        return _CACHE[key]
    from civsys_focal.config import FocalConfig
    from civsys_focal.engine import FocalSimulationEngine
    from civsys_focal.handoff_writer import write_life_outputs
    cfg = FocalConfig(enabled=True, affect_enabled=True, focal_policy="mind", export_enabled=True,
                      heldout_agent_ids=["agent_0001"], snapshot_tick=T)
    e = FocalSimulationEngine(seed=seed, population_size=40, width=64, height=64, focal=cfg)
    for _ in range(T):
        e.step()
    out = tmp_root / f"handoff_{seed}_{T}"
    write_life_outputs(e, seed, out)
    _CACHE[key] = out
    return out
