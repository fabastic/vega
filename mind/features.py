"""One fixed-length feature vector for both minds and both worlds (SPEC §D.2).

Layout (58 dims):
  vision   8 bins x (distance, onehot[none, wall/terrain, object/building, agent]) = 40
  sound    level, sin/cos of strongest source bearing                             =  3
  touch    front, back, left, right, pressure                                     =  5
  proprio  sin/cos heading, posture id, effort                                    =  4
  intero   hunger, thirst, fatigue, sleep_pressure, health_deficit, pain          =  6
"""
import math

import numpy as np

from mind.types import Interoception, Observation

FEATURE_DIM = 58
VISION_BINS = 8
VISION_RANGE = 8.0
POSTURES = {"stand": 0.0, "sit": 0.5, "lie": 1.0}


def category_index(category: str) -> int:
    if not category or category == "none":
        return 0
    if category == "wall" or category.startswith("terrain"):
        return 1
    if category.startswith("object") or category.startswith("building"):
        return 2
    if category == "agent":
        return 3
    return 0


def vision_bin(bearing: float) -> int:
    b = bearing % (2 * math.pi)
    return int((b + math.pi / VISION_BINS) // (2 * math.pi / VISION_BINS)) % VISION_BINS


def nearest_per_bin(obs: Observation):
    best = [None] * VISION_BINS
    for v in obs.vision:
        k = vision_bin(v.bearing)
        if best[k] is None or v.distance < best[k].distance:
            best[k] = v
    return best


def features(obs: Observation, intero: Interoception) -> np.ndarray:
    f = np.zeros(FEATURE_DIM, dtype=np.float64)
    for k, v in enumerate(nearest_per_bin(obs)):
        base = k * 5
        if v is None:
            f[base] = 1.0
            f[base + 1] = 1.0
        else:
            f[base] = min(v.distance, VISION_RANGE) / VISION_RANGE
            f[base + 1 + category_index(v.category)] = 1.0
    s = obs.sound
    f[40] = min(1.0, max(0.0, s.level))
    if s.sources:
        b, _ = max(s.sources, key=lambda x: x[1])
        f[41], f[42] = math.sin(b), math.cos(b)
    t = obs.touch
    f[43:48] = (t.front, t.back, t.left, t.right, t.pressure)
    p = obs.proprio
    f[48], f[49] = math.sin(p.heading), math.cos(p.heading)
    f[50] = POSTURES.get(p.posture, 0.0)
    f[51] = p.effort
    f[52:58] = intero.as_tuple()
    return f


FEATURE_NAMES = (
    [f"v{k}_{n}" for k in range(VISION_BINS) for n in ("dist", "none", "wall", "obj", "agent")]
    + ["snd_level", "snd_sin", "snd_cos", "t_front", "t_back", "t_left", "t_right", "t_press",
       "p_sin", "p_cos", "p_posture", "p_effort",
       "i_hunger", "i_thirst", "i_fatigue", "i_sleep", "i_health_def", "i_pain"]
)
assert len(FEATURE_NAMES) == FEATURE_DIM
