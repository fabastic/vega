"""Round 2 residual decoder: growth stays function-preserving; state carries the last observation."""
import random

import pytest
import torch

from growth import ops_v2
from mind.learned.model import WorldModel, make_probe
from mind.types import CapacityKind as K

torch.set_num_threads(1)
torch.use_deterministic_algorithms(True)
STEPS = {K.WIDEN_HIDDEN: 32, K.ENLARGE_LATENT: 8, K.ADD_EXPERT: 1, K.DEEPEN: 1}


@pytest.mark.parametrize("kind", list(STEPS))
def test_growth_function_preserving_on_residual_model(kind):
    torch.manual_seed(0)
    m = WorldModel(residual=True)
    probe = make_probe(m)
    before = m.probe_outputs(probe)
    old = ops_v2.SYMMETRY_NOISE
    ops_v2.SYMMETRY_NOISE = 0.0
    try:
        _, info = ops_v2.OPS[kind](m, STEPS[kind], torch.Generator().manual_seed(1), random.Random(1), False)
    finally:
        ops_v2.SYMMETRY_NOISE = old
    if info.get("h_src"):
        probe["h_src"] = info["h_src"]
    assert ops_v2.max_preservation_diff(before, m.probe_outputs(probe)) <= 1e-6
    assert m.residual and m.arch()["residual"] is True


def test_residual_predict_adds_last_observation():
    m = WorldModel(residual=True)
    h, z, x = torch.zeros(1, m.H), torch.zeros(1, m.Z), torch.rand(1, 58)
    assert torch.allclose(m.predict(h, z, x), m.decode(h, z) + x)
    m2 = WorldModel(residual=False)
    assert torch.allclose(m2.predict(h, z, x), m2.decode(h, z))


def test_residual_round_trip_keeps_f_prev():
    from mind.channel import CapacityChannel
    from mind.learned.agent import LearnedMind
    from mind.learned.replay import ReplayBuffer
    from mind.rulebased import RuleBasedMind
    import json
    base = RuleBasedMind({}, {"hunger_per_tick": 0.008, "thirst_per_tick": 0.015, "sleep_per_tick": 0.02}, 1)
    m = LearnedMind.__new__(LearnedMind)
    m.__dict__.update(base.__dict__)
    buf = ReplayBuffer()
    for i in range(40):
        buf.add(torch.rand(58).numpy(), i % 10, "life", 0)
    m.init_learned(WorldModel(residual=True), buf, 1, "replay_only", 0.05)
    m.f_prev = torch.rand(1, 58)
    m2 = LearnedMind.from_parts(json.loads(json.dumps(m.export_state(), default=str)), m.export_tensors(),
                                CapacityChannel())
    assert m2.model.residual and torch.equal(m2.f_prev, m.f_prev)
