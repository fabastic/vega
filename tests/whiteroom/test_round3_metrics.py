"""Round 3 metric changes: phantoms per tick (non-saturating) and the common SD2/SD3 reference."""
from battery.tasks import life_reference
from mind.affect.params import CHANNELS
from whiteroom.metrics import summarize


def _row(tau, target, phantom, origin=""):
    r = {"tau": tau, "S": 100.0 + tau, "action": "approach" if target else "idle", "target": target,
         "phantom": int(phantom), "phantom_origin": origin, "q_created": "", "q_resolved": "", "q_abandoned": "",
         "q_revisited": "", "body_uninformative_run": 0, "replay": 0, "internal_goals_total": 0, "grant_kinds": "",
         "requests": 0, "mood": 0.0, "valence": 0.0, "arousal": 0.0, "hunger": 0.1, "thirst": 0.1, "fatigue": 0.1,
         "selfpred_acc": None}
    r.update({f"I_{c}": 0.0 for c in CHANNELS})
    return r


def test_phantom_per_tick_does_not_saturate():
    # two deprived runs: every targeted act is a phantom in both, so phantom_rate is 1.0 in both,
    # but one acts on absent entities four times as often
    rare = [_row(t, "b1" if t % 8 == 0 else "", t % 8 == 0, "pre") for t in range(1, 49)]
    often = [_row(t, "b1" if t % 2 == 0 else "", t % 2 == 0, "pre") for t in range(1, 49)]
    a, b = summarize(rare, 48), summarize(often, 48)
    assert a["phantom_rate"] == b["phantom_rate"] == 1.0
    assert a["phantom_per_tick"] == 6 / 48 and b["phantom_per_tick"] == 24 / 48
    assert b["phantom_pre_per_tick"] == b["phantom_per_tick"]


def test_life_reference_is_the_same_for_every_arm():
    furnished = {"turn_changes_proprio": True, "move_changes_proprio": True, "vision_present": True,
                 "true_vision_occupied": 0.75}
    deprived = {"turn_changes_proprio": False, "move_changes_proprio": False, "vision_present": False,
                "true_vision_occupied": 0.75}
    assert life_reference(furnished) == life_reference(deprived)
    assert life_reference(deprived)["vision_present"] is True
