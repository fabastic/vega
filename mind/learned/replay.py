"""Bounded replay buffer of real transitions only (SPEC K.4).

Sources: the life export (minus the held-out block) and room transitions.
Every transition carries a provenance tag; no other data source exists.
"""
from __future__ import annotations

import random
from typing import List, Tuple

import numpy as np

from mind.learned import params as P


class ReplayBuffer:
    def __init__(self, capacity: int = P.BUFFER_CAPACITY):
        self.capacity = capacity
        self.feats: List[np.ndarray] = []
        self.acts: List[int] = []
        self.prov: List[str] = []
        self.segment: List[int] = []     # sequences never cross segment boundaries

    def add(self, f: np.ndarray, a: int, prov: str, segment: int):
        self.feats.append(np.asarray(f, dtype=np.float32))
        self.acts.append(int(a))
        self.prov.append(prov)
        self.segment.append(int(segment))
        if len(self.feats) > self.capacity:     # FIFO
            for lst in (self.feats, self.acts, self.prov, self.segment):
                del lst[0]

    def __len__(self):
        return len(self.feats)

    def valid_starts(self, L: int) -> List[int]:
        out = []
        for i in range(len(self.feats) - L + 1):
            if self.segment[i] == self.segment[i + L - 1]:
                out.append(i)
        return out

    def sample(self, rng: random.Random, B: int, L: int) -> Tuple[np.ndarray, np.ndarray, List[int]]:
        starts = self.valid_starts(L)
        idx = [starts[rng.randrange(len(starts))] for _ in range(B)]
        f = np.stack([np.stack(self.feats[i:i + L]) for i in idx])
        a = np.array([self.acts[i:i + L] for i in idx], dtype=np.int64)
        return f, a, idx

    def provenance_counts(self):
        out = {}
        for p in self.prov:
            out[p] = out.get(p, 0) + 1
        return out

    def to_json(self):
        return {"capacity": self.capacity, "acts": self.acts, "prov": self.prov, "segment": self.segment}

    def feats_array(self) -> np.ndarray:
        return np.stack(self.feats) if self.feats else np.zeros((0, P.FEAT), dtype=np.float32)

    @classmethod
    def from_parts(cls, d: dict, feats: np.ndarray) -> "ReplayBuffer":
        b = cls(d["capacity"])
        b.feats = [np.asarray(x, dtype=np.float32) for x in feats]
        b.acts, b.prov, b.segment = list(d["acts"]), list(d["prov"]), list(d["segment"])
        return b
