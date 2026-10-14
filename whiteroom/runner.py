"""Room cells: load handoff -> build mind -> K ticks with the growth harness -> logs (SPEC C.1).

Resumable: a cell whose summary.json exists is skipped.
"""
from __future__ import annotations

import copy
import csv
import json
import time
from pathlib import Path
from typing import List, Optional, Tuple

from growth import ops_v1
from growth.harness import GrowthHarness, TriggerConfig, v1_rules
from mind.channel import CapacityChannel
from mind.handoff import load
from mind.rulebased import RuleBasedMind
from whiteroom.config import CellConfig, RoomConfig
from whiteroom.logrow import make_row, mind_state_hash, reference_sets
from whiteroom.metrics import summarize
from whiteroom.world import WhiteRoom


def checkpoint_taus(K: int) -> List[int]:
    return [0] + [round(K * i / 4) for i in range(1, 5)]


def build_v1(handoff, cell: CellConfig, channel: CapacityChannel, memory_base: int) -> RuleBasedMind:
    m = RuleBasedMind.from_state(copy.deepcopy(handoff.minds["v1"]), channel)
    m.reflection.enabled = cell.reflection
    m.clock.anchoring = False           # re-anchoring disabled from T in every arm (SPEC D.5)
    m.truncate_to_slots(memory_base)    # Q21
    return m


def build_mind(handoff, cell, channel, memory_base, handoff_dir=None, thresholds=None):
    if cell.mind == "v1":
        m = build_v1(handoff, cell, channel, memory_base)
    else:
        from whiteroom.v2io import build_v2_from_handoff   # torch only when v2 is requested
        m = build_v2_from_handoff(handoff, handoff_dir, cell, channel)
    t = (thresholds or {}).get(cell.mind)
    if t:   # the mind's scripted request rule uses the same pre-registered thresholds as the harness
        m.request_pe_threshold = t["pe"]
        m.request_boredom_threshold = t["boredom"]
        m.request_novelty_threshold = t["novelty"]
        if cell.mind == "v2" and "nll_baseline" in t:
            m.nll_baseline = t["nll_baseline"]
    return m


def make_harness(cell: CellConfig, mind, memory_base: int, yoke=None, thresholds=None) -> GrowthHarness:
    t = (thresholds or {}).get(cell.mind)
    trig = TriggerConfig(t["pe"], t["boredom"], t["novelty"]) if t else None
    if cell.mind == "v1":
        return GrowthHarness(v1_rules(memory_base), cell.growth, ops_v1.apply, trig or TriggerConfig(0.4), yoke=yoke)
    from growth import ops_v2
    from growth.harness import v2_rules
    from growth.budget import PARAM_CAP, flop_cap_for, flop_proxy
    return GrowthHarness(v2_rules(), cell.growth, ops_v2.make_apply(mind), trig or TriggerConfig(1.25), yoke=yoke,
                         param_count=mind.param_count, param_cap=PARAM_CAP,
                         flop_proxy=flop_proxy, flop_cap=flop_cap_for(mind.param_count()))


def _write_csv(path: Path, rows: list):
    if not rows:
        path.write_text("")
        return
    cols = list(rows[0].keys())
    for r in rows[1:]:
        for k in r:
            if k not in cols:
                cols.append(k)
    with open(path, "w", newline="", encoding="utf-8") as fh:
        w = csv.DictWriter(fh, fieldnames=cols)
        w.writeheader()
        w.writerows(rows)


def run_room_cell(handoff_dir, cell: CellConfig, out_dir, room_cfg: RoomConfig, memory_base: int,
                  yoke: Optional[List[Tuple[int, str]]] = None, snapshot_hook=None, force: bool = False,
                  thresholds=None) -> dict:
    out_dir = Path(out_dir)
    if (out_dir / "summary.json").exists() and not force:
        return json.loads((out_dir / "summary.json").read_text())
    out_dir.mkdir(parents=True, exist_ok=True)
    t0 = time.time()
    h = load(handoff_dir)
    civ_seed = h.meta["civ_seed"]
    channel = CapacityChannel()
    mind = build_mind(h, cell, channel, memory_base, handoff_dir, thresholds)
    room = WhiteRoom(h, cell.arm, civ_seed, cell.key(), room_cfg)
    harness = make_harness(cell, mind, memory_base, yoke, thresholds)
    pre_refs = reference_sets(h)
    state_hash_T = mind_state_hash(mind)
    snaps = set(checkpoint_taus(cell.K))
    if snapshot_hook and 0 in snaps:
        snapshot_hook(0, mind, room)
    rows, death_tau = [], None
    for tau in range(1, cell.K + 1):
        obs, intero = room.sense(tau)
        action = mind.observe(obs, intero)
        room.apply(action, tau)
        recs = harness.tick(tau, mind, channel)
        rows.append(make_row(tau, mind, action, obs, intero, recs, pre_refs,
                             {"pos_x": room.pos[0], "pos_y": room.pos[1], "heading": round(room.heading, 6)}))
        if snapshot_hook and tau in snaps:
            snapshot_hook(tau, mind, room)
        if not room.body.alive:
            death_tau = tau
            break
    _write_csv(out_dir / "ticks.csv", rows)
    (out_dir / "grants.json").write_text(json.dumps(harness.log, indent=1, default=str))
    summary = summarize(rows, cell.K, h.minds["v1"]["clock"]["S"])
    summary.update(cell=cell.model_dump(), civ_seed=civ_seed, state_hash_T=state_hash_T, death_tau=death_tau,
                   grant_timeline=harness.grant_timeline(), seconds=round(time.time() - t0, 2),
                   distinct_cells=len(room.visited), distinct_headings=len(room.headings),
                   S_T=h.minds["v1"]["clock"]["S"])
    (out_dir / "summary.json").write_text(json.dumps(summary, indent=1, default=str))
    return summary
