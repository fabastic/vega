"""Round 3 bounded recurrent state: growth stays function-preserving, h stays in [-1, 1], the flag round-trips."""
import random

import pytest
import torch
import torch.nn.functional as F

from growth import ops_v2
from mind.learned import params as P
from mind.learned.model import WorldModel, make_probe
from mind.types import CapacityKind as K

torch.set_num_threads(1)
torch.use_deterministic_algorithms(True)
STEPS = {K.WIDEN_HIDDEN: 32, K.ENLARGE_LATENT: 8, K.ADD_EXPERT: 1, K.DEEPEN: 1}


@pytest.mark.parametrize("kind", list(STEPS))
def test_growth_function_preserving_on_bounded_model(kind):
    torch.manual_seed(0)
    m = WorldModel(residual=True, bounded=True)
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
    assert m.arch()["bounded"] is True


def test_bounded_state_stays_in_range_over_a_long_rollout():
    torch.manual_seed(3)
    m = WorldModel(residual=True, bounded=True)
    with torch.no_grad():
        for p in m.experts.parameters():   # an expert residual far larger than training would produce
            p.mul_(25.0)
        h, z = torch.zeros(1, m.H), torch.zeros(1, m.Z)
        for t in range(1000):
            a = F.one_hot(torch.tensor([t % P.ACT]), P.ACT).float()
            h = m.dyn(h, z, a)
            z, _ = m.prior(h)
            assert torch.isfinite(h).all() and float(h.abs().max()) <= 1.0   # tanh saturates to exactly 1 in float32


def test_bounded_flag_round_trips_through_export():
    import json
    from mind.channel import CapacityChannel
    from mind.learned.agent import LearnedMind
    from mind.learned.replay import ReplayBuffer
    from mind.rulebased import RuleBasedMind
    base = RuleBasedMind({}, {"hunger_per_tick": 0.008, "thirst_per_tick": 0.015, "sleep_per_tick": 0.02}, 1)
    m = LearnedMind.__new__(LearnedMind)
    m.__dict__.update(base.__dict__)
    buf = ReplayBuffer()
    for i in range(40):
        buf.add(torch.rand(58).numpy(), i % 10, "life", 0)
    m.init_learned(WorldModel(residual=True, bounded=True), buf, 1, "replay_only", 0.05)
    m2 = LearnedMind.from_parts(json.loads(json.dumps(m.export_state(), default=str)), m.export_tensors(),
                                CapacityChannel())
    assert m2.model.bounded and m2.model.residual
