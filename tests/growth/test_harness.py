"""Growth harness rules (SPEC I.1-I.3): request AND trigger AND caps AND cooldown; yoked modes."""
import pytest

from growth import ops_v1
from growth.harness import COOLDOWN_GLOBAL, COOLDOWN_KIND, GLOBAL_CAP, GrowthHarness, TriggerConfig, v1_rules
from mind.channel import CapacityChannel
from mind.types import CapacityKind as K, ReasonCode as R, Telemetry


class FakeHandles:
    kinds = (K.MEMORY_SLOTS, K.EXPECTATION_DIMS, K.SELF_MODEL_NODES, K.REFLECTION_WORKING_SET)

    def __init__(self):
        self.s = {K.MEMORY_SLOTS: 100, K.EXPECTATION_DIMS: 5, K.SELF_MODEL_NODES: 8, K.REFLECTION_WORKING_SET: 2}

    def size(self, k):
        return float(self.s[k])

    def grow(self, k, step):
        self.s[k] += step


class FakeMind:
    def __init__(self, pe=0.0, boredom=0.0, novelty=1.0, full=False):
        self.h = FakeHandles()
        self.t = Telemetry(pe, boredom, novelty, full, 0)

    def telemetry(self):
        return self.t

    def capacity_handles(self):
        return self.h


def _run(harness, mind, ticks, requests):
    ch = CapacityChannel()
    for tau in range(1, ticks + 1):
        for kind, reason in requests(tau):
            ch.request_capacity(kind, reason)
        harness.tick(tau, mind, ch)
    return harness


def test_no_grant_without_trigger_or_request():
    m = FakeMind(pe=0.1)
    h = _run(GrowthHarness(v1_rules(100), "on", ops_v1.apply), m, 60,
             lambda t: [(K.EXPECTATION_DIMS, R.PREDICTION_ERROR)])
    assert h.grants_total == 0 and all(r["denial"] == "trigger_not_met" for r in h.log if r.get("decision") == "denied")
    m2 = FakeMind(pe=0.9)
    h2 = _run(GrowthHarness(v1_rules(100), "on", ops_v1.apply), m2, 60, lambda t: [])
    assert h2.grants_total == 0


def test_grant_requires_window_then_respects_cooldowns_and_caps():
    m = FakeMind(pe=0.9)
    h = _run(GrowthHarness(v1_rules(100), "on", ops_v1.apply), m, 400,
             lambda t: [(K.EXPECTATION_DIMS, R.PREDICTION_ERROR)])
    taus = [t for t, _ in h.grant_timeline()]
    assert taus[0] == 24                                   # needs a full window
    assert all(b - a >= COOLDOWN_KIND for a, b in zip(taus, taus[1:]))
    assert m.h.s[K.EXPECTATION_DIMS] == 9 and len(taus) == 4   # cap 9, max 4 grants


def test_kind_must_be_allowed_for_family():
    m = FakeMind(boredom=0.9, novelty=0.0)
    h = _run(GrowthHarness(v1_rules(100), "on", ops_v1.apply), m, 60,
             lambda t: [(K.MEMORY_SLOTS, R.BOREDOM)])
    assert h.grants_total == 0
    assert {r["denial"] for r in h.log if r.get("decision") == "denied"} == {"kind_not_allowed_for_family"}


def test_global_cap_and_one_grant_per_tick():
    m = FakeMind(pe=0.9, boredom=0.9, novelty=0.0, full=True)
    reqs = lambda t: [(K.MEMORY_SLOTS, R.PREDICTION_ERROR), (K.EXPECTATION_DIMS, R.PREDICTION_ERROR),
                      (K.SELF_MODEL_NODES, R.BOREDOM), (K.REFLECTION_WORKING_SET, R.REFLECTIVE_BACKLOG)]
    h = _run(GrowthHarness(v1_rules(100), "on", ops_v1.apply), m, 2000, reqs)
    taus = [t for t, _ in h.grant_timeline()]
    assert h.grants_total == GLOBAL_CAP
    assert len(set(taus)) == len(taus)
    assert all(b - a >= COOLDOWN_GLOBAL for a, b in zip(taus, taus[1:]))


def test_off_mode_denies_everything():
    m = FakeMind(pe=0.9)
    h = _run(GrowthHarness(v1_rules(100), "off", ops_v1.apply), m, 100,
             lambda t: [(K.EXPECTATION_DIMS, R.PREDICTION_ERROR)])
    assert h.grants_total == 0 and m.h.s[K.EXPECTATION_DIMS] == 5


def test_schedule_matched_replays_timeline_regardless_of_state():
    m_on = FakeMind(pe=0.9)
    on = _run(GrowthHarness(v1_rules(100), "on", ops_v1.apply), m_on, 300,
              lambda t: [(K.EXPECTATION_DIMS, R.PREDICTION_ERROR)])
    m_y = FakeMind(pe=0.0)     # state would never trigger growth
    y = _run(GrowthHarness(v1_rules(100), "schedule_matched", ops_v1.apply, yoke=on.grant_timeline()), m_y, 300,
             lambda t: [])
    assert y.grant_timeline() == on.grant_timeline()
    assert m_y.h.s == m_on.h.s


def test_deterministic():
    def go():
        m = FakeMind(pe=0.9, boredom=0.9, novelty=0.0, full=True)
        return _run(GrowthHarness(v1_rules(100), "on", ops_v1.apply), m, 500,
                    lambda t: [(K.SELF_MODEL_NODES, R.BOREDOM), (K.EXPECTATION_DIMS, R.PREDICTION_ERROR)]).log
    assert go() == go()
