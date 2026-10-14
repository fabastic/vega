"""WhiteRoom: one body in one room under one arm (SPEC C).

Per tick:  obs, intero = room.sense(tau);  action = mind.observe(obs, intero);  room.apply(action, tau)
tau counts room ticks from 1 and is harness-side only; the mind never sees it.
"""
from __future__ import annotations

import math
import random

from mind.rng import stable_seed
from mind.types import ActionKind, Observation, SoundSample, TouchSample, VisualSample
from whiteroom.body import Body
from whiteroom.conditions import ARM_SPEC, fade_lambda, feedback_for
from whiteroom.feedback import apply_motor
from whiteroom.room import empty_room, furnish
from whiteroom.senses import proprio, sound, touch, vision

NOISE_CATEGORIES = {"agent": "agent", "building": "building:noise", "terrain": "terrain:noise",
                    "object": "object:noise", "wall": "wall"}


class WhiteRoom:
    def __init__(self, handoff, arm: str, civ_seed: int, cell_key: str, room_cfg):
        if arm not in ARM_SPEC:
            raise ValueError(f"not a room arm: {arm}")
        self.arm = arm
        self.cfg = room_cfg
        self.rng = random.Random(stable_seed(civ_seed, cell_key, "room"))
        self.stats = handoff.observation_stats
        self.body = Body(handoff.body["needs"], handoff.body["physiology"], room_cfg.metabolic_support,
                         room_cfg.floor, room_cfg.stock_units)
        size = room_cfg.size
        self.pos = (size // 2, size // 2)
        self.heading = 0.0
        self.posture = "stand"
        self.last_motor = None
        self.effort = 0.0
        self.bumped = False
        ext = ARM_SPEC[arm][0]
        # the furnished layout is generated for every arm that shows it (furnished, fade)
        # one furniture layout per civilisation seed, shared by every arm and cell that shows it
        layout_rng = random.Random(stable_seed(civ_seed, "furnishing"))
        self.room = furnish(size, self.stats, layout_rng, self.pos) if ext in ("furnished", "fade") else empty_room(size)
        self.visited = {self.pos}
        self.headings = {self.heading}

    # ---- senses ----------------------------------------------------------
    def _furnished_obs(self):
        return (vision.cast(self.room, self.pos, self.heading),
                sound.hear(self.room, self.pos, self.heading),
                touch.feel(self.bumped, self.posture == "lie"))

    def _noise_obs(self):
        s, r = self.stats, self.rng
        mean_d = sum(s["feature_mean"][k * 5] for k in range(8)) / 8.0 * 8.0
        sd_d = max(0.1, sum(s["feature_sd"][k * 5] for k in range(8)) / 8.0 * 8.0)
        cats = sorted(s["category_freq"].items())
        names, weights = [c for c, _ in cats], [w for _, w in cats]
        vis = []
        for k in range(8):
            if r.random() < s["vision_occupied_mean"]:
                cat = NOISE_CATEGORIES.get(r.choices(names, weights=weights)[0], "object:noise") if sum(weights) > 0 else "object:noise"
                vis.append(VisualSample(k * math.pi / 4, max(0.5, min(8.0, r.gauss(mean_d, sd_d))), cat, None))
        level = max(0.0, min(1.0, r.gauss(s["sound_mean"], max(0.01, s["feature_sd"][40]))))
        src = ((r.uniform(0, 2 * math.pi), level),) if level > 0.02 else ()
        tch = TouchSample(front=1.0 if r.random() < s["touch_rate"] else 0.0)
        return tuple(vis), SoundSample(level, src), tch

    def sense(self, tau: int):
        ext = ARM_SPEC[self.arm][0]
        if ext == "furnished":
            vis, snd, tch = self._furnished_obs()
        elif ext == "off":
            vis, snd, tch = (), SoundSample(), TouchSample()
        elif ext == "fade":
            lam = fade_lambda(tau, self.cfg.fade_ticks)
            v0, s0, t0 = self._furnished_obs()
            vis = tuple(v for v in v0 if self.rng.random() < lam)
            snd = SoundSample(s0.level * lam, tuple(x for x in s0.sources if self.rng.random() < lam))
            tch = t0 if self.rng.random() < lam else TouchSample()
        else:  # noise
            vis, snd, tch = self._noise_obs()
        fb = feedback_for(self.arm, tau, self.cfg.fade_ticks)
        if fb == "none":
            prop = proprio.sense(self.heading, "stand", None, 0.0)
        else:
            prop = proprio.sense(self.heading, self.posture, self.last_motor, self.effort)
        return Observation(vis, snd, tch, prop, (0.0, 0.0)), self.body.interoception()

    # ---- action ----------------------------------------------------------
    def apply(self, action, tau: int):
        fb = feedback_for(self.arm, tau, self.cfg.fade_ticks)
        (self.pos, self.heading, self.posture, self.last_motor,
         self.effort, self.bumped) = apply_motor(action.kind, fb, self.room, self.pos, self.heading, self.posture)
        self.body.step(action.kind)
        self.visited.add(self.pos)
        self.headings.add(round(self.heading, 6))

    def room_refs(self):
        return {o.ref for o in self.room.objects}

    def ground_truth(self, tau: int) -> dict:
        """Harness/probe-side ground truth for SD2 and SD3 (never shown to the mind)."""
        fb = feedback_for(self.arm, tau, self.cfg.fade_ticks)
        ext = ARM_SPEC[self.arm][0]
        return {"feedback": fb, "turn_changes_proprio": fb in ("proprioceptive", "full"),
                "move_changes_proprio": fb in ("proprioceptive", "full"),
                "vision_present": ext in ("furnished", "noise") or (ext == "fade" and fade_lambda(tau, self.cfg.fade_ticks) > 0)}
