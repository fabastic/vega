"""Focal life phase: determinism, read-only export, snapshot non-mutation, handoff contents."""
import json

from civsys_focal.config import FocalConfig
from civsys_focal.engine import FocalSimulationEngine
from civsys_focal.handoff_writer import write_life_outputs
from mind.handoff import load
from tests.civsys.golden.canonical import tick_digest

HELD = ["agent_0001", "agent_0002"]


def _life(seed, ticks, **kw):
    cfg = FocalConfig(enabled=True, affect_enabled=True, focal_policy="mind", export_enabled=True,
                      heldout_agent_ids=HELD, snapshot_tick=ticks, **kw)
    e = FocalSimulationEngine(seed=seed, population_size=40, width=64, height=64, focal=cfg)
    for _ in range(ticks):
        e.step()
    return e


def test_life_and_handoff_are_deterministic(tmp_path):
    e1, e2 = _life(7, 40), _life(7, 40)
    assert tick_digest(e1.state) == tick_digest(e2.state)
    write_life_outputs(e1, 7, tmp_path / "a")
    write_life_outputs(e2, 7, tmp_path / "b")
    for name in ("handoff.json", "life.csv", "heldout_agent_0001.csv"):
        assert (tmp_path / "a" / name).read_bytes() == (tmp_path / "b" / name).read_bytes(), name


def test_snapshot_does_not_mutate_state(tmp_path):
    e = _life(11, 30)
    before = tick_digest(e.state)
    write_life_outputs(e, 11, tmp_path)
    assert tick_digest(e.state) == before
    e.step()   # engine still runs after the snapshot


def test_handoff_contents_and_exclusions(tmp_path):
    e = _life(13, 30)
    write_life_outputs(e, 13, tmp_path)
    h = load(tmp_path)
    assert h.meta["schema_version"] == "handoff/2"
    assert h.meta["snapshot_tick"] == 30
    assert h.minds["v1"]["version"] == "rulebased/1"
    assert len(h.observation_history["rows"]) == 30
    assert "tick" not in h.observation_history["columns"]           # harness ticks stripped
    blob = json.dumps(h.model_dump())
    for forbidden in ("market", "food_price", "cells", "metrics_history", "causal_ledger"):
        assert forbidden not in blob, forbidden
    for place in h.known_places.values():                             # egocentric only
        assert set(place) == {"type", "bearing", "distance"}
    assert "life_csv" in h.sidecars and "heldout_agent_0001" in h.sidecars


def test_mind_policy_changes_only_the_focal_decisions():
    """Sanity: with focal_policy=civsys the focal engine reproduces the default engine."""
    from app.simulation.engine import SimulationEngine
    d = SimulationEngine(seed=5, population_size=40, width=64, height=64)
    cfg = FocalConfig(enabled=True, affect_enabled=True, focal_policy="civsys", export_enabled=True,
                      heldout_agent_ids=HELD)
    f = FocalSimulationEngine(seed=5, population_size=40, width=64, height=64, focal=cfg)
    for _ in range(25):
        d.step()
        f.step()
        assert tick_digest(d.state) == tick_digest(f.state)
