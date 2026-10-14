"""F4 synthetic pattern set (SPEC L.2), generated deterministically and checked by hash.

Deviation from SPEC (logged): generated from a fixed seed at load time and
verified against a recorded sha256 instead of being stored as a multi-MB file.
4 rule families x 50 sequences; 24 context steps, 6 to predict. Each item names
one target feature dimension whose binary value is to be predicted.
"""
import hashlib
import random

import numpy as np

from mind.features import FEATURE_DIM
from mind.types import ACTION_KINDS, ActionKind

SEED = 20261014
N_PER_FAMILY = 50
CONTEXT, PREDICT = 24, 6
_IDX = {k: i for i, k in enumerate(ACTION_KINDS)}


def _base(rng):
    f = np.zeros(FEATURE_DIM, dtype=np.float32)
    for k in range(8):
        f[k * 5] = 1.0
        f[k * 5 + 1] = 1.0           # nothing in every bin
    f[49] = 1.0                      # cos(heading = 0)
    f[52:58] = [rng.uniform(0.1, 0.5) for _ in range(6)]
    return f


def generate():
    rng = random.Random(SEED)
    items = []
    for fam in ("periodic_object", "alternating_sound", "turn_heading", "counting"):
        for _ in range(N_PER_FAMILY):
            L = CONTEXT + PREDICT
            X = np.stack([_base(rng) for _ in range(L)])
            A = np.full(L, _IDX[ActionKind.IDLE], dtype=np.int64)
            if fam == "periodic_object":
                p, k, ph = rng.randint(2, 6), rng.randrange(8), rng.randrange(6)
                for t in range(L):
                    if (t + ph) % p == 0:
                        X[t, k * 5], X[t, k * 5 + 1], X[t, k * 5 + 3] = 0.3, 0.0, 1.0
                target = k * 5 + 3
            elif fam == "alternating_sound":
                p = rng.randint(2, 4)
                for t in range(L):
                    X[t, 40] = 1.0 if (t // p) % 2 == 0 else 0.0
                target = 40
            elif fam == "turn_heading":
                heading = 0.0
                for t in range(L):
                    if rng.random() < 0.4:
                        A[t] = _IDX[ActionKind.TURN]
                    X[t, 48], X[t, 49] = np.sin(heading), np.cos(heading)
                    if A[t] == _IDX[ActionKind.TURN]:
                        heading += np.pi / 4
                X[:, 48] = (X[:, 48] > 0.1).astype(np.float32)   # binarised "heading left of start"
                target = 48
            else:  # counting: an object appears in one more bin every 4 steps, then resets after 8 bins
                for t in range(L):
                    n = (t // 4) % 8
                    for k in range(n):
                        X[t, k * 5], X[t, k * 5 + 1], X[t, k * 5 + 3] = 0.4, 0.0, 1.0
                target = 3 * 5 + 3   # is bin 3 occupied?
            items.append({"family": fam, "X": X, "A": A, "target": int(target)})
    return items


def digest(items) -> str:
    h = hashlib.sha256()
    for it in items:
        h.update(it["family"].encode())
        h.update(it["X"].tobytes())
        h.update(it["A"].tobytes())
        h.update(str(it["target"]).encode())
    return h.hexdigest()
