"""8 rays at 45-degree spacing over 360 degrees (SPEC C.3, v3 change Q3)."""
import math

from mind.features import VISION_RANGE
from mind.types import VisualSample

STEP = 0.1


def cast(room, pos, heading):
    samples = []
    cx, cy = pos[0] + 0.5, pos[1] + 0.5
    for k in range(8):
        rel = k * math.pi / 4
        ang = heading + rel
        dx, dy = math.cos(ang), math.sin(ang)
        d = STEP
        while d <= VISION_RANGE:
            x, y = int(math.floor(cx + dx * d)), int(math.floor(cy + dy * d))
            if (x, y) != tuple(pos):
                obj = room.object_at(x, y)
                if obj is not None:
                    samples.append(VisualSample(rel, round(d, 6), f"object:{obj.kind}", obj.ref))
                    break
                if not room.interior(x, y):
                    samples.append(VisualSample(rel, round(d, 6), "wall", None))
                    break
            d += STEP
    return tuple(samples)
