"""Stable seeding and lossless RNG state <-> JSON (SPEC D3)."""
import hashlib
import random


def stable_seed(*parts) -> int:
    """Deterministic 63-bit seed from parts. Never uses Python's randomised hash()."""
    h = hashlib.sha256("|".join(str(p) for p in parts).encode("utf-8")).digest()
    return int.from_bytes(h[:8], "big") & ((1 << 63) - 1)


def random_state_to_json(r: random.Random):
    version, internal, gauss = r.getstate()
    return [version, list(internal), gauss]


def random_state_from_json(data) -> random.Random:
    r = random.Random()
    r.setstate((data[0], tuple(data[1]), data[2]))
    return r
