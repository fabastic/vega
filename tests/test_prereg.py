"""Pre-registration (SPEC M): every frozen params file matches a hash recorded in the change log.

Round 1 (params_v3.json) must still match the first entry. Each later round's file (params_round<N>.json) must
match the entry that froze it, and entries appear in round order.
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
    positions = []
    for p in sorted((ROOT / "prereg").glob("params_round*.json")):
        h = _hash(p.name)
        assert h in recorded, f"{p.name} changed without a CHANGELOG entry"
        positions.append(recorded.index(h))
    assert positions == sorted(positions), "rounds frozen out of order"
