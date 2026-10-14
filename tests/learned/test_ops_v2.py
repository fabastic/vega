"""Function-preserving growth (SPEC I.4, F.1): every v2 operation, exact and with symmetry noise;
random-growth variants are NOT function-preserving; optimizer moments transfer by slice."""
import random

import pytest
import torch

from growth import ops_v2
from mind.learned.model import WorldModel, make_probe
from mind.types import CapacityKind as K

torch.set_num_threads(1)
torch.use_deterministic_algorithms(True)
STEPS = {K.WIDEN_HIDDEN: 32, K.ENLARGE_LATENT: 8, K.ADD_EXPERT: 1, K.DEEPEN: 1}


def _grow(kind, random_init=False, noise=None):
    torch.manual_seed(0)
    m = WorldModel()
    probe = make_probe(m)
    before = m.probe_outputs(probe)
    old_noise = ops_v2.SYMMETRY_NOISE
    if noise is not None:
        ops_v2.SYMMETRY_NOISE = noise
    try:
        _, info = ops_v2.OPS[kind](m, STEPS[kind], torch.Generator().manual_seed(1), random.Random(1), random_init)
    finally:
        ops_v2.SYMMETRY_NOISE = old_noise
    if info.get("h_src"):
        probe["h_src"] = info["h_src"]
    after = m.probe_outputs(probe)
    return m, ops_v2.max_preservation_diff(before, after)


@pytest.mark.parametrize("kind", list(STEPS))
def test_exact_without_symmetry_noise(kind):
    _, diff = _grow(kind, noise=0.0)
    assert diff <= 1e-6, (kind, diff)


@pytest.mark.parametrize("kind", list(STEPS))
def test_within_tolerance_with_symmetry_noise(kind):
    _, diff = _grow(kind)
    assert diff <= 1e-3, (kind, diff)


@pytest.mark.parametrize("kind", list(STEPS))
def test_random_growth_is_not_function_preserving(kind):
    _, diff = _grow(kind, random_init=True)
    assert diff > 1e-3, (kind, diff)


def test_shapes_and_param_counts_grow():
    base = WorldModel().param_count()
    for kind in STEPS:
        m, _ = _grow(kind)
        assert m.param_count() > base
    m, _ = _grow(K.WIDEN_HIDDEN)
    assert m.H == 160 and m.expert_hidden == 128
    m, _ = _grow(K.ENLARGE_LATENT)
    assert m.Z == 24


def test_at_all_caps_param_count_under_cap():
    from growth.budget import PARAM_CAP
    m = WorldModel(256, 48, 6, 4, expert_hidden=128)
    assert m.param_count() <= PARAM_CAP


def test_grown_model_round_trips_through_state_dict():
    m, _ = _grow(K.WIDEN_HIDDEN)
    m2 = WorldModel(**m.arch())
    m2.load_state_dict(m.state_dict())
    probe = make_probe(m2)
    a, b = m.probe_outputs(probe), m2.probe_outputs(probe)
    assert ops_v2.max_preservation_diff(a, b) == 0.0
