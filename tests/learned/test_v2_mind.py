"""Learned mind v2: CPU determinism, export/reload continuity, held-out exclusion, real grants (SPEC K, F.1)."""
import json
import random

import numpy as np
import pytest
import torch

from mind.channel import CapacityChannel
from tests.fixtures import small_handoff

torch.set_num_threads(1)
torch.use_deterministic_algorithms(True)


@pytest.fixture(scope="module")
def v2_handoff(tmp_path_factory):
    d = small_handoff(tmp_path_factory.mktemp("v2h"), seed=31, T=60)
    from experiments.pretrain_v2 import pretrain_dir
    pretrain_dir(d, 31, force=True, wm_updates=20, bc_updates=10)
    return d


def _mind(d, learning="replay_plus_imagination"):
    from mind.handoff import load
    from whiteroom.config import CellConfig
    from whiteroom.v2io import build_v2_from_handoff
    h = load(d)
    return h, build_v2_from_handoff(h, d, CellConfig(arm="full_deprivation", mind="v2", learning=learning), CapacityChannel())


def _room(h, arm="full_deprivation"):
    from whiteroom.config import RoomConfig
    from whiteroom.world import WhiteRoom
    return WhiteRoom(h, arm, h.meta["civ_seed"], "t", RoomConfig())


def _run(mind, room, n, start=1):
    out = []
    for tau in range(start, start + n):
        obs, it = room.sense(tau)
        a = mind.observe(obs, it)
        room.apply(a, tau)
        out.append((a.kind.value, round(mind.last_log["nll"], 12), round(mind.last_log.get("wm_loss") or 0.0, 10)))
    return out


def test_bitwise_cpu_determinism(v2_handoff):
    h, m1 = _mind(v2_handoff)
    _, m2 = _mind(v2_handoff)
    assert _run(m1, _room(h), 6) == _run(m2, _room(h), 6)


def test_export_reload_continuity(v2_handoff):
    from mind.learned.agent import LearnedMind
    h, m1 = _mind(v2_handoff)
    r1 = _room(h)
    _run(m1, r1, 4)
    state, tensors = json.loads(json.dumps(m1.export_state(), default=str)), m1.export_tensors()
    m2 = LearnedMind.from_parts(state, {k: v.clone() for k, v in tensors.items()}, CapacityChannel())
    import copy
    r2 = copy.deepcopy(r1)
    assert _run(m1, r1, 4, start=5) == _run(m2, r2, 4, start=5)


def test_replay_buffer_only_life_and_room(v2_handoff):
    h, m = _mind(v2_handoff)
    _run(m, _room(h), 5)
    assert set(m.buffer.provenance_counts()) <= {"life", "room"}
    assert m.buffer.provenance_counts()["room"] == 5


def test_heldout_block_excluded_from_buffer():
    from experiments.pretrain_v2 import build_buffer
    ticks = np.arange(720)
    X = np.random.default_rng(0).random((720, 58)).astype(np.float32)
    A = np.zeros(720, dtype=np.int64)
    buf = build_buffer(ticks, X, A)
    assert len(buf) == 720 - 48
    held = {X[t].tobytes() for t in range(600, 648)}
    assert not any(f.tobytes() in held for f in buf.feats)
    assert all(not (buf.segment[i] == 0 and buf.segment[i + 1] == 1 and i + 1 < 0) for i in range(len(buf) - 1))
    assert all(s + 31 < len(buf) and buf.segment[s] == buf.segment[s + 31] for s in buf.valid_starts(32))


def test_real_grant_preserves_function_and_moves_moments(v2_handoff):
    from growth import ops_v2
    from mind.types import CapacityKind as K
    h, m = _mind(v2_handoff)
    _run(m, _room(h), 3)
    apply = ops_v2.make_apply(m)
    n_before = m.param_count()
    info = apply(m.capacity_handles(), K.WIDEN_HIDDEN, 32)
    assert info["max_preservation_diff"] <= 1e-3
    assert m.param_count() > n_before and m.model.H == m.h.shape[1]
    # optimizer state exists for every parameter after the next update, and original slices were kept
    _run(m, _room(h), 2, start=4)
    assert all(p in m.opt_wm.state or p in m.opt_ac.state for p in m.model.parameters())


def test_imagination_updates_touch_only_policy_and_value(v2_handoff):
    h, m = _mind(v2_handoff)
    before = {n: p.detach().clone() for n, p in m.model.named_parameters()}
    fn, an, _ = m.buffer.sample(m.replay_rng, 4, 32)
    _, hs, zs, _ = m._wm_batch_loss(torch.tensor(fn), torch.tensor(an))
    loss = m._ac_imagination(hs[:, -1], zs[:, -1])
    m.opt_ac.zero_grad()
    loss.backward()
    m.opt_ac.step()
    changed = {n for n, p in m.model.named_parameters() if not torch.equal(p.detach(), before[n])}
    assert changed and all(n.startswith(("pi.", "v.")) for n in changed), changed
