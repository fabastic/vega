"""Battery: fixed synthetic set, weights, known answers, out-of-band probing (SPEC L, F.1)."""
import hashlib

import numpy as np
import pytest

from battery import synthetic, tasks
from tests.fixtures import small_handoff

PREREG_SYNTHETIC_DIGEST = "44ed9cdb2608e5f48ab996a347a8e8b4535667acbcec3c6ec83c57ee1df85047"


def test_synthetic_set_is_fixed():
    items = synthetic.generate()
    assert len(items) == 200
    assert synthetic.digest(items) == PREREG_SYNTHETIC_DIGEST


def test_weights_sum_to_one_and_name():
    assert abs(sum(tasks.WEIGHTS.values()) - 1.0) < 1e-12
    assert set(tasks.WEIGHTS) == {"F1", "F2", "F3", "F4", "F5"}


class Oracle:
    """Predicts the truth exactly: every family must score 1."""

    def __init__(self, held):
        self.held = held

    def f1(self, X, A):
        return 1.0

    def f2(self, X, A):
        return 1.0

    def f3(self, X, A):
        return 1.0

    def f4_item(self, item):
        return [1.0 if v > 0.5 else 0.0 for v in item["X"][24:, item["target"]]]


class ModeBaseline:
    def f1(self, X, A):
        return 0.0

    def f2(self, X, A):
        return 0.0

    def f3(self, X, A):
        return 0.0

    def f4_item(self, item):
        ctx = item["X"][:24, item["target"]] > 0.5
        return [1.0 if ctx.mean() > 0.5 else 0.0] * 6


def test_known_answers():
    items = synthetic.generate()
    held = [{"X": np.zeros((40, 58), np.float32), "A": np.zeros(40, np.int64)}]
    assert tasks.family_scores(Oracle(held), held, items)["F4"] == 1.0
    assert tasks.family_scores(ModeBaseline(), held, items)["F4"] == 0.0
    assert tasks.composite({"F1": 1, "F2": 1, "F3": 1, "F4": 1, "F5": 1}) == pytest.approx(1.0)
    assert tasks.composite({}) == 0.0


def test_norm_err_and_sd1():
    assert tasks._norm_err(0.0, 1.0) == 1.0 and tasks._norm_err(2.0, 1.0) == 0.0
    rows = [{"action": "eat", "selfpred_acc": 1.0}] + [{"action": a, "selfpred_acc": 1.0} for a in ("rest", "work", "eat")]
    assert tasks.sd1_score(rows, "selfpred_acc") == 1.0
    assert tasks.sd_composite({"SD1": 1.0, "SD4": 0.0}) == 1.0


def test_v1_predictor_runs_on_real_snapshot(tmp_path_factory):
    from mind.handoff import load
    from mind.rulebased import RuleBasedMind
    d = small_handoff(tmp_path_factory.mktemp("b"))
    h = load(d)
    m = RuleBasedMind.from_state(h.minds["v1"])
    held = [{"X": np.random.default_rng(0).random((40, 58)).astype(np.float32), "A": np.zeros(40, np.int64)}]
    fam = tasks.family_scores(tasks.predictor_for(m), held, synthetic.generate())
    assert all(fam[k] is None or 0.0 <= fam[k] <= 1.0 for k in ("F1", "F2", "F3", "F4"))


def test_probing_is_out_of_band(tmp_path_factory):
    """A live run with snapshot export (probe hook) is byte-identical to one without."""
    from whiteroom.config import CellConfig, RoomConfig
    from whiteroom.runner import run_room_cell
    from whiteroom.v2io import save_snapshot
    d = small_handoff(tmp_path_factory.mktemp("oob"))
    out = tmp_path_factory.mktemp("cells")
    cell = CellConfig(arm="furnished_room", K=60)
    run_room_cell(d, cell, out / "plain", RoomConfig(), 50)
    run_room_cell(d, cell, out / "probed", RoomConfig(), 50,
                  snapshot_hook=lambda tau, mind, room: save_snapshot(mind, out / "snaps" / str(tau)))
    a = (out / "plain" / "ticks.csv").read_bytes()
    b = (out / "probed" / "ticks.csv").read_bytes()
    assert hashlib.sha256(a).hexdigest() == hashlib.sha256(b).hexdigest()
    assert len(list((out / "snaps").iterdir())) == 5
