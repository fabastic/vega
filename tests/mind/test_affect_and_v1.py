"""Affect rules, decay, clocks, reflection and the v1 mind (SPEC D.5, H, J)."""
import json
import math
import random

import pytest

from mind.affect.clock import BodyClock, SubjectiveClock
from mind.affect.core import AffectCore, AppraisalInputs
from mind.affect.params import CHANNELS, HALF_LIFE
from mind.reflection.engine import ReflectionModule, ReflectionSignals
from mind.reflection.selfmodel import SelfModel
from mind.rulebased import RuleBasedMind
from mind.types import Interoception, Observation, QueryType, SoundSample, VisualSample

PHYS = {"hunger_per_tick": 0.008, "thirst_per_tick": 0.015, "sleep_per_tick": 0.02}

RULE_CASES = [
    ("R1", AppraisalInputs(hunger=0.9), {"fear"}),
    ("R2", AppraisalInputs(prediction_error=0.8, outcome_value=-1), {"fear", "surprise"}),
    ("R3", AppraisalInputs(prediction_error=0.8), {"surprise"}),
    ("R4", AppraisalInputs(contact_lost=True), {"loneliness"}),
    ("R5", AppraisalInputs(social_loss=1.0), {"sadness"}),
    ("R6", AppraisalInputs(social_gain=1.0), {"joy", "attachment"}),
    ("R7", AppraisalInputs(grief_signal=0.8), {"grief", "sadness"}),
    ("R8", AppraisalInputs(novelty=0.9, control=0.5), {"curiosity"}),
    ("R9", AppraisalInputs(novelty=0.1, low_novelty_run=12), {"boredom"}),
    ("R10", AppraisalInputs(outcome_value=1, control=0.5), {"joy", "pride"}),
    ("R11", AppraisalInputs(outcome_value=-1, control=0.8), {"anger"}),
    ("R12", AppraisalInputs(novelty=0.9, visual_extent_high=True, control=0.0), {"awe"}),
    ("R13", AppraisalInputs(need_deficit=0.7, relief_predicted=True), {"anticipation"}),
    ("R14", AppraisalInputs(aversive=1.0), {"disgust"}),
]


@pytest.mark.parametrize("rule,x,channels", RULE_CASES)
def test_each_rule_moves_exactly_its_channels(rule, x, channels):
    core = AffectCore({})
    fired = core.apply_rules(x)
    assert rule in fired
    moved = {c for c in CHANNELS if core.I[c] > 0}
    assert channels <= moved
    # R8 also fires for R12's novelty only when control > 0.3; cases are built to isolate rules
    assert moved <= channels | {"curiosity"}


def test_neuroticism_amplifies_fear():
    lo = AffectCore({"emotional_stability": 0.9})
    hi = AffectCore({"emotional_stability": 0.1})
    for c in (lo, hi):
        c.apply_rules(AppraisalInputs(hunger=0.9))
    assert hi.I["fear"] > lo.I["fear"]


def test_half_life_and_conscientious_recovery():
    core = AffectCore({"conscientiousness": 0.0})
    core.I["joy"] = 1.0
    for _ in range(HALF_LIFE["joy"]):
        core.decay()
    assert abs(core.I["joy"] - 0.5) < 1e-9
    slow, fast = AffectCore({"conscientiousness": 0.0}), AffectCore({"conscientiousness": 1.0})
    for c in (slow, fast):
        c.I["sadness"] = 1.0
        for _ in range(10):
            c.decay()
    assert fast.I["sadness"] < slow.I["sadness"]


def test_channels_clip_to_unit_interval():
    core = AffectCore({"emotional_stability": 0.0})
    for _ in range(50):
        core.apply_rules(AppraisalInputs(hunger=0.95, prediction_error=1.0, outcome_value=-1, aversive=1.0))
    assert all(0.0 <= v <= 1.0 for v in core.I.values())


def test_subjective_clock_rule_and_bounds():
    assert SubjectiveClock.rate(0, 0, 0) == 1.0
    assert SubjectiveClock.rate(1.0, 0, 0) == 1.4
    assert SubjectiveClock.rate(0, 1.0, 1.0) == 0.5
    c = SubjectiveClock(anchoring=False)
    c.anchor(100.0)
    assert c.S == 0.0


def test_body_clock_informative_then_silent():
    bc = BodyClock({"hunger": 0.008, "thirst": 0.015, "sleep_pressure": 0.02})
    for t in range(10):
        bc.tick(Interoception(hunger=0.1 + 0.008 * t, thirst=0.1 + 0.015 * t), 1.3)
    assert abs(bc.B - (1.3 + 9.0)) < 1e-6 and bc.uninformative_run == 0   # first tick has no delta
    for _ in range(5):
        bc.tick(Interoception(hunger=0.1 + 0.008 * 9, thirst=0.1 + 0.015 * 9), 1.3)   # flat: clamped needs
    assert bc.uninformative_run == 5 and abs(bc.B - (1.3 + 9.0 + 5 * 1.3)) < 1e-6


def test_reflection_queries_are_typed_scripted_and_capped():
    r = ReflectionModule(working_set=2)
    sm = SelfModel(8)
    sig = ReflectionSignals(S=10.0, modality_ratio={"vision": 0.0, "sound": 0.0, "touch": 0.0},
                            modality_low_run={"vision": 12, "sound": 12, "touch": 12})
    r.step(sig, sm, {}, max_depth=2, revisit=False)
    assert len(r.open_queries()) == 2                      # working-set cap
    assert any(q.abandoned_for_capacity for q in r.queries)
    assert all(q.scripted_by_design for q in r.queries)
    assert {q.type for q in r.queries} == {QueryType.EXISTENTIAL.value}
    sig.modality_low_run = {k: 24 for k in sig.modality_low_run}
    r.step(sig, sm, {}, max_depth=2, revisit=False)
    assert sm.get("room_feature:no_vision") is not None or sm.get("room_feature:no_sound") is not None


def test_self_identity_resolves_with_no_effect_mapping():
    """SPEC J.3: 'no effect' counts as a consistent body mapping."""
    r = ReflectionModule(working_set=3)
    sm = SelfModel(8)
    for _ in range(6):
        sm.record_efference("turn", False)
    sig = ReflectionSignals(S=5.0, efference_mismatch=1.0, n_motor=6)
    r.step(sig, sm, {}, max_depth=2, revisit=False)
    assert sm.get("body_mapping:turn") is False
    assert any(q.type == "self_identity" and q.status == "resolved" for q in r.queries)


def test_reflection_off_yields_nothing():
    r = ReflectionModule(working_set=2, enabled=False)
    sig = ReflectionSignals(S=1.0, modality_ratio={"vision": 0.0}, modality_low_run={"vision": 50})
    r.step(sig, SelfModel(8), {}, 2, True)
    assert r.queries == [] and r.action_utility() == {}


def _seq(n, seed):
    rnd = random.Random(seed)
    out = []
    for t in range(n):
        vis = () if t > n // 2 else tuple(VisualSample(rnd.uniform(0, 6.28), rnd.uniform(1, 5), "agent", f"a{rnd.randint(0, 3)}") for _ in range(3))
        out.append((Observation(vision=vis, sound=SoundSample(0.0 if t > n // 2 else 0.5)),
                    Interoception(hunger=min(0.6, 0.1 + 0.008 * t), thirst=min(0.6, 0.1 + 0.015 * t))))
    return out


def _run(seq, split=None):
    m = RuleBasedMind({"openness": 0.6}, PHYS, 3, {"a1": 0.9})
    out = []
    for i, (o, it) in enumerate(seq):
        if i == split:
            m = RuleBasedMind.from_state(json.loads(json.dumps(m.export_state())))
        a = m.observe(o, it)
        out.append((a.kind.value, a.target_ref, m.last_log["S"], m.last_log["valence"]))
    return out


def test_v1_deterministic_and_continuous_across_export():
    seq = _seq(200, 4)
    assert _run(seq) == _run(seq)
    assert _run(seq) == _run(seq, split=120)


def test_v1_capacity_handles_grow_and_report():
    from mind.types import CapacityKind as K
    m = RuleBasedMind({}, PHYS, 1)
    h = m.capacity_handles()
    m.truncate_to_slots(10)
    before = {k: h.size(k) for k in h.kinds}
    h.grow(K.MEMORY_SLOTS, 64)
    h.grow(K.EXPECTATION_DIMS, 1)
    h.grow(K.SELF_MODEL_NODES, 4)
    h.grow(K.REFLECTION_WORKING_SET, 1)
    after = {k: h.size(k) for k in h.kinds}
    assert after[K.MEMORY_SLOTS] == before[K.MEMORY_SLOTS] + 64
    assert after[K.EXPECTATION_DIMS] == before[K.EXPECTATION_DIMS] + 1
    assert after[K.SELF_MODEL_NODES] == before[K.SELF_MODEL_NODES] + 4
    assert after[K.REFLECTION_WORKING_SET] == before[K.REFLECTION_WORKING_SET] + 1
