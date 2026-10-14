"""White room: feedback modes, senses per arm, body, determinism, equal start (SPEC C, E.1, F.1)."""
import json
import math

import pytest

from mind.handoff import load
from mind.types import Action, ActionKind
from tests.fixtures import small_handoff
from whiteroom.body import Body
from whiteroom.config import CellConfig, RoomConfig
from whiteroom.conditions import ROOM_ARMS, fade_lambda
from whiteroom.runner import run_room_cell
from whiteroom.world import WhiteRoom

PHYS = {"hunger_per_tick": 0.008, "thirst_per_tick": 0.015, "sleep_per_tick": 0.02, "energy_loss_active": 0.015,
        "energy_gain_rest": 0.1, "sleep_relief_rest": 0.2, "health_loss": 0.02, "hunger_damage_threshold": 0.85,
        "thirst_damage_threshold": 0.92, "starvation_threshold": 0.95, "eat_hunger_relief": 0.4,
        "eat_thirst_relief": 0.4, "eat_health_gain": 0.02}
NEEDS = {"hunger": 0.5, "thirst": 0.5, "energy": 0.8, "sleep_need": 0.2, "health": 1.0}


@pytest.fixture(scope="module")
def hdir(tmp_path_factory):
    return small_handoff(tmp_path_factory.mktemp("h"))


def _room(hdir, arm):
    h = load(hdir)
    return WhiteRoom(h, arm, h.meta["civ_seed"], f"test_{arm}", RoomConfig())


def test_feedback_modes(hdir):
    for arm, fb in [("full_deprivation", "none"), ("exteroception_removed", "proprioceptive"), ("furnished_room", "full")]:
        r = _room(hdir, arm)
        h0, p0 = r.heading, r.pos
        r.apply(Action(ActionKind.TURN), 1)
        obs, _ = r.sense(2)
        if fb == "none":
            assert r.heading == h0 and obs.proprio.last_motor is None
        else:
            assert abs(r.heading - (h0 + math.pi / 4)) < 1e-9 and obs.proprio.last_motor == "turn"
        for _ in range(3):
            r.apply(Action(ActionKind.MOVE), 3)
        assert (r.pos != p0) == (fb == "full")


def test_senses_per_arm(hdir):
    off = [_room(hdir, a).sense(5)[0] for a in ("full_deprivation", "exteroception_removed")]
    for o in off:
        assert o.vision == () and o.sound.level == 0.0 and max(o.touch.front, o.touch.pressure) == 0.0
    furn = _room(hdir, "furnished_room").sense(5)[0]
    assert len(furn.vision) == 8 and any(v.category.startswith("object") for v in furn.vision)
    noise = _room(hdir, "noise_only")
    assert any(noise.sense(t)[0].vision for t in range(1, 10))
    assert all(v.ref is None for t in range(1, 10) for v in noise.sense(t)[0].vision)


def test_fade_keeps_fraction_lambda(hdir):
    r = _room(hdir, "fade_out")
    kept = sum(len(r.sense(36)[0].vision) for _ in range(400)) / (400 * 8)
    assert abs(kept - fade_lambda(36, 72)) < 0.06
    assert r.sense(72)[0].vision == ()


def test_noise_matches_life_statistics(hdir):
    h = load(hdir)
    r = _room(hdir, "noise_only")
    occ = [len(r.sense(t)[0].vision) / 8 for t in range(1, 2001)]
    assert abs(sum(occ) / len(occ) - h.observation_stats["vision_occupied_mean"]) < 0.05


def test_body_support_modes():
    b = Body(NEEDS, PHYS, "floor", 0.6)
    for _ in range(200):
        b.step(ActionKind.IDLE)
    assert b.hunger == 0.6 and b.thirst == 0.6 and b.alive
    n = Body(NEEDS, PHYS, "none")
    t = 0
    while n.alive and t < 400:
        n.step(ActionKind.IDLE)
        t += 1
    assert not n.alive and t < 120
    s = Body(NEEDS, PHYS, "stock", stock_units=5)
    s.step(ActionKind.EAT)
    assert s.stock == 4 and s.hunger < 0.5


def test_room_cells_deterministic_and_equal_at_T(hdir, tmp_path):
    a = run_room_cell(hdir, CellConfig(arm="full_deprivation", K=40), tmp_path / "a", RoomConfig(), 50)
    b = run_room_cell(hdir, CellConfig(arm="full_deprivation", K=40), tmp_path / "b", RoomConfig(), 50)
    assert (tmp_path / "a" / "ticks.csv").read_bytes() == (tmp_path / "b" / "ticks.csv").read_bytes()
    hashes = {run_room_cell(hdir, CellConfig(arm=arm, K=5), tmp_path / arm, RoomConfig(), 50)["state_hash_T"]
              for arm in ROOM_ARMS}
    assert len(hashes) == 1 and a["state_hash_T"] in hashes


def test_reflection_off_cell_creates_no_queries(hdir, tmp_path):
    s = run_room_cell(hdir, CellConfig(arm="full_deprivation", K=60, reflection=False), tmp_path / "r0", RoomConfig(), 50)
    assert s["queries_created"] == 0
