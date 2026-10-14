"""civ_control: continue CivSYS from the checkpoint at T with the same mind (SPEC E.1, Q6, Q23).

Lives in experiments/ because whiteroom/ must never import CivSYS.
"""
from __future__ import annotations

import json
import pickle
import pathlib
import sys
import time
from pathlib import Path

ROOT = pathlib.Path(__file__).resolve().parents[1]
for i, p in enumerate((ROOT, ROOT / "civsys" / "backend")):   # CivSYS is the git submodule civsys/
    if str(p) not in sys.path:
        sys.path.insert(i, str(p))

from mind.channel import CapacityChannel  # noqa: E402
from mind.handoff import load  # noqa: E402
from mind.types import Action, ActionKind  # noqa: E402
from whiteroom.config import CellConfig  # noqa: E402
from whiteroom.logrow import make_row, mind_state_hash, reference_sets  # noqa: E402
from whiteroom.metrics import summarize  # noqa: E402
from whiteroom.runner import _write_csv, build_mind, checkpoint_taus, make_harness  # noqa: E402


class _CheckpointUnpickler(pickle.Unpickler):
    """Checkpoints written before the vega restructure name the focal add-on by its old in-tree path."""

    def find_class(self, module, name):
        if module == "app.simulation.focal" or module.startswith("app.simulation.focal."):
            module = "civsys_focal" + module[len("app.simulation.focal"):]
        return super().find_class(module, name)


def run_civ_cell(handoff_dir, cell: CellConfig, out_dir, memory_base: int, yoke=None, snapshot_hook=None,
                 force: bool = False, stop_before_perceivable_death: bool = False, thresholds=None) -> dict:
    """stop_before_perceivable_death (round 2, Change 3): end the control at the last tick before any agent the
    focal agent has ever perceived dies. The harness sees the death; the focal mind never does."""
    out_dir = Path(out_dir)
    if (out_dir / "summary.json").exists() and not force:
        return json.loads((out_dir / "summary.json").read_text())
    out_dir.mkdir(parents=True, exist_ok=True)
    t0 = time.time()
    h = load(handoff_dir)
    with open(Path(handoff_dir) / "checkpoint.pkl", "rb") as fh:   # written by our own life runner
        engine = _CheckpointUnpickler(fh).load()
    channel = CapacityChannel()
    mind = build_mind(h, cell, channel, memory_base, handoff_dir, thresholds)
    engine.set_focal_mind(mind)
    engine.focal.export_enabled = False
    harness = make_harness(cell, mind, memory_base, yoke, thresholds)
    pre_refs = reference_sets(h)
    state_hash_T = mind_state_hash(mind)
    fs = engine.focal_state
    agent = engine.state.agents[engine.focal.focal_agent_id]
    snaps = set(checkpoint_taus(cell.K))
    if snapshot_hook and 0 in snaps:
        snapshot_hook(0, mind, None)
    rows, death_tau, stop_tau = [], None, None
    known = set(agent.relationships) | set(agent.perception.visible_agents)
    for tau in range(1, cell.K + 1):
        known |= set(agent.perception.visible_agents)
        alive_known = {a for a in known if a in engine.state.agents and engine.state.agents[a].is_alive}
        engine.step()
        last = fs["history"][-1] if fs["history"] else {}
        recs = harness.tick(tau, mind, channel)
        action = getattr(mind, "prev_action", None) or Action(ActionKind.IDLE)   # the action chosen this tick
        rows.append(make_row(tau, mind, action,
                             _obs_stub(last), _intero_stub(agent), recs, pre_refs,
                             {"civ_alive_agents": sum(1 for a in engine.state.agents.values() if a.is_alive)}))
        if snapshot_hook and tau in snaps:
            snapshot_hook(tau, mind, None)
        if not agent.is_alive:
            death_tau = tau
            break
        if stop_before_perceivable_death:
            # a known agent died during this step, after the focal agent had observed; from the next tick on
            # its absence would be perceivable, so the control window ends here
            if any(not engine.state.agents[a].is_alive for a in alive_known):
                stop_tau = tau
                break
    _write_csv(out_dir / "ticks.csv", rows)
    (out_dir / "grants.json").write_text(json.dumps(harness.log, indent=1, default=str))
    summary = summarize(rows, cell.K, h.minds["v1"]["clock"]["S"])
    summary.update(cell=cell.model_dump(), civ_seed=h.meta["civ_seed"], state_hash_T=state_hash_T,
                   death_tau=death_tau, grant_timeline=harness.grant_timeline(),
                   seconds=round(time.time() - t0, 2), S_T=h.minds["v1"]["clock"]["S"],
                   control_stop_tau=stop_tau, control_window=len(rows))
    (out_dir / "summary.json").write_text(json.dumps(summary, indent=1, default=str))
    return summary


class _ObsStub:
    def __init__(self, row):
        self.vision = tuple(range(int(row.get("vc_agent", 0) or 0) + int(row.get("vc_building", 0) or 0) +
                                  int(row.get("vc_terrain", 0) or 0)))
        self.sound = type("S", (), {"level": float(row.get("f40", 0.0) or 0.0)})()


def _obs_stub(row):
    return _ObsStub(row)


def _intero_stub(agent):
    from mind.types import Interoception
    n = agent.needs
    return Interoception(n.hunger, n.thirst, 1.0 - n.energy, n.sleep_need, 1.0 - n.health, n.pain)
