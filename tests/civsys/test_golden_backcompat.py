"""Default config must reproduce the unmodified CivSYS trajectory exactly (SPEC F.1).

Golden digests were recorded from unmodified CivSYS main by tests/civsys/golden/make_golden.py.
CivSYS itself (the civsys/ directory) is never modified; the focal engine lives in civsys_focal/.
"""
import json
import pathlib

import pytest

from app.simulation.engine import SimulationEngine
from tests.civsys.golden.make_golden import trajectory

GOLDEN = json.loads(pathlib.Path(__file__).with_name("golden").joinpath("default_hashes.json").read_text())


def _engines():
    yield "SimulationEngine", SimulationEngine, {}
    try:
        from civsys_focal.engine import FocalSimulationEngine
        from civsys_focal.config import FocalConfig
    except ImportError:
        return
    yield "FocalSimulationEngine(disabled)", FocalSimulationEngine, {"focal": FocalConfig()}
    # enabled but read-only: CivSYS keeps deciding for the focal agent; the mind only
    # observes and the export only reads, so the trajectory must still be identical
    yield "FocalSimulationEngine(enabled, civsys policy, export on)", FocalSimulationEngine, {
        "focal": FocalConfig(enabled=True, affect_enabled=True, focal_policy="civsys", export_enabled=True,
                             heldout_agent_ids=["agent_0001", "agent_0002", "agent_0003"])}


@pytest.mark.parametrize("seed", GOLDEN["config"]["seeds"])
def test_default_engines_match_golden(seed):
    want = GOLDEN["runs"][str(seed)]
    for name, cls, kw in _engines():
        got = trajectory(cls, seed, **kw)
        for t, (g, w) in enumerate(zip(got["ticks"], want["ticks"])):
            assert g == w, f"{name} seed {seed}: first divergence at tick {t}"
        assert got["cells_final"] == want["cells_final"], f"{name} seed {seed}: final cells differ"
