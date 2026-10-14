"""Pre-registration (SPEC M): every frozen params file matches a hash recorded in the change log.

Round 1 (params_v3.json) must still match its original entry; if round 2 is frozen, its file must match
the latest entry.
"""
import hashlib
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parents[1]


def _hash(name):
    return hashlib.sha256((ROOT / "prereg" / name).read_bytes().replace(b"\r\n", b"\n")).hexdigest()


def test_prereg_hash_matches_changelog():
    log = (ROOT / "prereg" / "CHANGELOG.md").read_text(encoding="utf-8")
    recorded = re.findall(r"\b[0-9a-f]{64}\b", log)
    assert recorded, "no frozen hash in the change log"
    assert _hash("params_v3.json") == recorded[0], "params_v3.json (round 1) changed after freezing"
    if (ROOT / "prereg" / "params_round2.json").exists():
        assert _hash("params_round2.json") == recorded[-1], "params_round2.json changed without a CHANGELOG entry"
