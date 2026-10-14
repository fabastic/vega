"""Room geometry and furnishing (SPEC C.1). A size x size grid; the outer ring is wall."""
from __future__ import annotations

import math
import random
from dataclasses import dataclass, field
from typing import List, Tuple

OBJECT_KINDS = ("chair", "table", "lamp", "plant", "box", "shelf", "rug", "stool")


@dataclass
class RoomObject:
    ref: str
    kind: str
    cell: Tuple[int, int]


@dataclass
class Room:
    size: int = 12
    objects: List[RoomObject] = field(default_factory=list)
    ambient_sound: float = 0.0
    sound_sources: List[Tuple[Tuple[int, int], float]] = field(default_factory=list)

    def interior(self, x: int, y: int) -> bool:
        return 1 <= x <= self.size - 2 and 1 <= y <= self.size - 2

    def object_at(self, x: int, y: int):
        for o in self.objects:
            if o.cell == (x, y):
                return o
        return None

    def blocked(self, x: int, y: int) -> bool:
        return not self.interior(x, y) or self.object_at(x, y) is not None


def furnish(size: int, stats: dict, rng: random.Random, start: Tuple[int, int]) -> Room:
    """Objects and sound matched to the agent's own life statistics (SPEC Q4)."""
    n_obj = int(round(stats.get("objects_per_tick", 2.0)))
    n_obj = max(1, min(8, n_obj))
    cells = [(x, y) for x in range(1, size - 1) for y in range(1, size - 1) if (x, y) != start]
    rng.shuffle(cells)
    objects = [RoomObject(f"room:obj{i}", OBJECT_KINDS[i % len(OBJECT_KINDS)], cells[i]) for i in range(n_obj)]
    level = float(max(0.0, min(1.0, stats.get("sound_mean", 0.0))))
    sources = [(objects[0].cell, level)] if level > 0.02 and objects else []
    return Room(size, objects, level, sources)


def empty_room(size: int) -> Room:
    return Room(size, [], 0.0, [])


def bearing_to(pos, heading, target) -> Tuple[float, float]:
    dx, dy = target[0] + 0.5 - (pos[0] + 0.5), target[1] + 0.5 - (pos[1] + 0.5)
    return (math.atan2(dy, dx) - heading) % (2 * math.pi), math.hypot(dx, dy)
