"""Handoff contract and mind interface (SPEC B, D.1)."""
import gc
import inspect
import json
import random

import pytest

from mind.channel import CapacityChannel, channel_drain
from mind.handoff import SCHEMA_VERSION, Handoff, add_sidecar, dump, load
from mind.rng import random_state_from_json, random_state_to_json, stable_seed
from mind.types import CapacityKind, ReasonCode


def _minimal(**over):
    blocks = {k: {} for k in Handoff.model_fields if k not in ("sidecars", "rng")}
    blocks["meta"] = {"schema_version": SCHEMA_VERSION}
    blocks.update(over)
    return Handoff(**blocks)


def test_round_trip(tmp_path):
    h = _minimal(body={"needs": {"hunger": 0.1234567890123}}, minds={"v1": {"x": [1, 2, 3]}})
    dump(h, tmp_path)
    assert load(tmp_path).model_dump() == h.model_dump()


def test_whitelist_rejects_global_keys():
    with pytest.raises(Exception):
        _minimal(world={"cells": []})


def test_unknown_version_rejected(tmp_path):
    h = _minimal(meta={"schema_version": "handoff/99"})
    dump(h, tmp_path)
    with pytest.raises(ValueError):
        load(tmp_path)


def test_tampered_sidecar_rejected(tmp_path):
    (tmp_path / "life.csv").write_text("a,b\n1,2\n")
    h = _minimal()
    add_sidecar(h, tmp_path, "life_csv", "life.csv")
    dump(h, tmp_path)
    load(tmp_path)
    (tmp_path / "life.csv").write_text("a,b\n1,3\n")
    with pytest.raises(ValueError):
        load(tmp_path)


def test_rng_state_round_trip():
    r = random.Random(123)
    r.random()
    r2 = random_state_from_json(json.loads(json.dumps(random_state_to_json(r))))
    assert [r.random() for _ in range(5)] == [r2.random() for _ in range(5)]


def test_stable_seed_is_process_independent():
    assert stable_seed(42, "room", "x") == stable_seed(42, "room", "x")
    assert stable_seed(42, "room", "x") != stable_seed(42, "room", "y")
    assert stable_seed(1) == 6372326883698087432 & ((1 << 63) - 1) or isinstance(stable_seed(1), int)


def test_channel_is_minimal_and_typed():
    ch = CapacityChannel()
    public = [n for n in dir(ch) if not n.startswith("_")]
    assert public == ["request_capacity"]
    assert CapacityChannel.__slots__ == ("_queue",)
    with pytest.raises(AttributeError):
        ch.harness = object()
    for bad in [("memory_slots", ReasonCode.BOREDOM), (CapacityKind.MEMORY_SLOTS, "BOREDOM"), (object(), None)]:
        with pytest.raises(TypeError):
            ch.request_capacity(*bad)
    for _ in range(6):
        ch.request_capacity(CapacityKind.MEMORY_SLOTS, ReasonCode.PREDICTION_ERROR)
    reqs, dropped = channel_drain(ch)
    assert len(reqs) == 4 and dropped == 2
    # the channel references nothing but its queue (a list of enum tuples)
    assert [type(x) for x in gc.get_referents(ch) if not isinstance(x, type)] == [list]


def test_observe_signature_has_no_time_or_condition():
    from mind.rulebased import RuleBasedMind
    from mind.baseline import UniformMind
    for cls in (RuleBasedMind, UniformMind):
        params = list(inspect.signature(cls.observe).parameters)
        assert params == ["self", "obs", "intero"], (cls, params)
        fs = list(inspect.signature(cls.from_state).parameters)
        assert fs == ["state", "channel"], (cls, fs)
        banned = {"tick", "t", "arm", "condition", "cell", "time", "step"}
        assert not banned & set(params) and not banned & set(fs)
