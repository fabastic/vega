"""Writes the handoff (contract, read by the white room) and the CivSYS checkpoint at T (SPEC A.4, B).

The checkpoint is a pickle of the whole engine, written and read only by
CivSYS's own harness from files it created itself; it is not part of the
contract. The handoff contains nothing global (SPEC B.3).
"""
from __future__ import annotations

import csv
import json
import pickle
import subprocess
from pathlib import Path

import numpy as np

from civsys_focal.physiology import PHYSIOLOGY
from mind.features import FEATURE_DIM
from mind.handoff import SCHEMA_VERSION, Handoff, add_sidecar, dump

FEATURE_COLS = [f"f{i}" for i in range(FEATURE_DIM)]


def _git_commit() -> str:
    try:
        import app  # the CivSYS checkout (git submodule civsys/)
        return subprocess.run(["git", "rev-parse", "HEAD"], capture_output=True, text=True, timeout=20,
                              cwd=str(Path(app.__file__).resolve().parent)).stdout.strip()
    except Exception:
        return "unknown"


def observation_stats(history: list) -> dict:
    X = np.array([[r[c] for c in FEATURE_COLS] for r in history], dtype=np.float64)
    occupied = [sum(1 for k in range(8) if r[f"f{k * 5 + 1}"] == 0.0) for r in history]
    cats = {}
    for r in history:
        for k in ("agent", "building", "terrain", "object", "wall"):
            cats[k] = cats.get(k, 0) + int(r.get(f"vc_{k}", 0) or 0)
    total = max(1, sum(cats.values()))
    return {
        "n": len(history),
        "feature_mean": X.mean(0).tolist(), "feature_sd": X.std(0).tolist(),
        "feature_min": X.min(0).tolist(), "feature_max": X.max(0).tolist(),
        "vision_occupied_mean": float(np.mean(occupied)) / 8.0,
        "objects_per_tick": float(np.mean([(r.get("vc_agent", 0) or 0) + (r.get("vc_building", 0) or 0) for r in history])),
        "sound_mean": float(X[:, 40].mean()),
        "touch_rate": float((X[:, 43:47].max(1) > 0).mean()),
        "category_freq": {k: v / total for k, v in cats.items()},
    }


def build_handoff(engine, civ_seed: int) -> Handoff:
    cfg = engine.focal
    fs = engine.focal_state
    agent = engine.state.agents[cfg.focal_agent_id]
    mind = fs["mind"]
    mstate = mind.export_state()
    history = [{k: v for k, v in r.items() if k != "tick"} for r in fs["history"]]
    frame = fs["frame"]
    known = {}
    ax, ay = agent.current_location
    import math
    for bid, b in sorted(agent.information.known_buildings.items()):
        dx, dy = b["x"] - ax, b["y"] - ay
        known[bid] = {"type": b["type"], "bearing": (math.atan2(dy, dx) - frame.heading) % (2 * math.pi),
                      "distance": math.hypot(dx, dy)}
    names = {tid: engine.state.agents[tid].name for tid in agent.relationships if tid in engine.state.agents}
    return Handoff(
        meta={"schema_version": SCHEMA_VERSION, "civ_seed": civ_seed, "focal_agent_id": agent.id,
              "snapshot_tick": engine.state.tick, "civsys_commit": _git_commit(),
              "mind_versions": {"v1": mstate["version"]}, "prereg_hash": None,
              "created_by": "civsys_focal/handoff_writer.py"},
        body={"needs": agent.needs.model_dump(), "physiology": dict(PHYSIOLOGY),
              "economic_carried": {"food_inventory": agent.economic.food_inventory}},
        traits={"personality": agent.personality.model_dump(), "values": agent.values.model_dump(),
                "cognition": agent.cognition.model_dump(), "skills": agent.skills.model_dump()},
        identity={"id": agent.id, "name": agent.name, "age": agent.age,
                  "life_stage": agent.social_identity.life_stage, "occupation": agent.economic.occupation,
                  "community_id": agent.social_identity.community_id,
                  "parents": list(agent.social_identity.parents)},
        affect={"mind_v1": mstate["affect"], "legacy": {k: e.intensity for k, e in agent.emotions}},
        memory={"civsys_records": [m.model_dump(mode="json") for m in agent.memories],
                "mind_v1_count": len(mstate["memories"])},
        beliefs={k: b.model_dump() for k, b in sorted(agent.beliefs.items())},
        goals={"civsys": [g.model_dump(mode="json") for g in agent.goals],
               "mind_v1_internal": mstate["internal_goals"]},
        relationships={tid: {**r.model_dump(), "name": names.get(tid)} for tid, r in sorted(agent.relationships.items())},
        known_places=known,
        clock={"mind_v1": mstate["clock"], "body_clock": mstate["body_clock"]},
        expectation={"n_dims": mstate["n_dims"], "pred": mstate["pred"], "scale": mstate["scale"]},
        observation_history={"columns": list(history[0].keys()) if history else [], "rows": history},
        observation_stats=observation_stats(fs["history"]),
        capacity={"v1_at_T": {k.value: mind.capacity_handles().size(k) for k in mind.capacity_handles().kinds},
                  "grant_log": []},
        reflection={"mind_v1": mstate["reflection"], "selfmodel": mstate["selfmodel"]},
        minds={"v1": mstate, "v2": None},
        rng={"v1": "in minds.v1.rng"},
    )


DEATH_TOKENS = ("death", "dead", "died", "dying", "deceas", "mortal", "corpse", "killed", "is_alive",
                "alive", "starv", "funeral", "perish", "vanish", "removed")


def find_death_information(obj, path="", allow=()) -> list:
    """Every key or string in obj that mentions death (case-insensitive substring), except allowed paths."""
    hits = []
    if path in allow:
        return hits
    if isinstance(obj, dict):
        for k, v in obj.items():
            kp = f"{path}.{k}" if path else str(k)
            if kp not in allow and any(t in str(k).lower() for t in DEATH_TOKENS):
                hits.append(kp)
            hits += find_death_information(v, kp, allow)
    elif isinstance(obj, (list, tuple)):
        for i, v in enumerate(obj):
            hits += find_death_information(v, f"{path}[{i}]", allow)
    elif isinstance(obj, str) and any(t in obj.lower() for t in DEATH_TOKENS):
        hits.append(f"{path}={obj[:60]}")
    return hits


# The room's body simulator (harness side) needs the agent's own starvation threshold; the mind never sees it.
HARNESS_ONLY = ("body.physiology.starvation_threshold", "meta.created_by")


def assert_no_death_information(h) -> None:
    hits = find_death_information(h.model_dump(), allow=HARNESS_ONLY)
    if hits:
        raise AssertionError(f"death information in handoff: {hits[:10]}")


def write_life_outputs(engine, civ_seed: int, out_dir: Path) -> dict:
    """Writes handoff.json, checkpoint.pkl, life.csv and heldout_<id>.csv into out_dir."""
    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    fs = engine.focal_state
    rows = fs["rows"]
    if rows:
        _write_csv(out_dir / "life.csv", rows)
    for hid, hrows in fs["heldout_rows"].items():
        _write_csv(out_dir / f"heldout_{hid}.csv", hrows)
    train = [r for aid in sorted(fs.get("train_rows", {})) for r in fs["train_rows"][aid]]
    if train:
        _write_csv(out_dir / "train_agents.csv", train)
    h = build_handoff(engine, civ_seed)
    if engine.focal.death_isolation:
        assert_no_death_information(h)
    if rows:
        add_sidecar(h, out_dir, "life_csv", "life.csv")
    if train:
        add_sidecar(h, out_dir, "train_agents_csv", "train_agents.csv")
    for hid in fs["heldout_rows"]:
        # recorded so the harness can prove they never enter the replay buffer (SPEC B.3)
        add_sidecar(h, out_dir, f"heldout_{hid}", f"heldout_{hid}.csv")
    dump(h, out_dir)
    with open(out_dir / "checkpoint.pkl", "wb") as fh:
        pickle.dump(engine, fh, protocol=pickle.HIGHEST_PROTOCOL)
    return {"handoff": str(out_dir / "handoff.json"), "n_life_rows": len(rows)}


def _write_csv(path: Path, rows: list):
    cols = list(rows[0].keys())
    with open(path, "w", newline="", encoding="utf-8") as fh:
        w = csv.DictWriter(fh, fieldnames=cols)
        w.writeheader()
        for r in rows:
            w.writerow({k: (json.dumps(v) if isinstance(v, (dict, list)) else v) for k, v in r.items()})
