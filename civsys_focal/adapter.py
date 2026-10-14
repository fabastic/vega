"""CivSYS state <-> mind types (SPEC D.4). The only CivSYS module importing mind/.

Builds the same Observation/Interoception the white room builds, from what the
agent can perceive (radius 5, as PerceptionSystem). Positions are converted to
egocentric bearing/distance; world coordinates never reach the mind.
"""
from __future__ import annotations

import math
from typing import Dict, Optional

from mind.types import (Action, ActionKind, Interoception, Observation, Proprio, SoundSample,
                        TouchSample, VisualSample)

PERCEPTION_RADIUS = 5.0
HEARING_RADIUS = 3.0
TOUCH_RADIUS = 1.0
TURN_STEP = math.pi / 4

CIV_TO_KIND = {
    "eat": ActionKind.EAT, "trade_buy": ActionKind.EAT,
    "work": ActionKind.WORK, "work_mechanized": ActionKind.WORK, "trade_sell": ActionKind.WORK,
    "rest": ActionKind.REST, "sleep": ActionKind.REST,
    "talk": ActionKind.TALK, "cooperate": ActionKind.TALK, "cooperate_share": ActionKind.TALK,
    "help": ActionKind.TALK, "ask": ActionKind.TALK, "form_relationship": ActionKind.TALK,
    "explore": ActionKind.EXPLORE, "learn": ActionKind.EXPLORE, "create": ActionKind.WORK,
    "migrate": ActionKind.MOVE, "compete": ActionKind.TALK,
    "join_group": ActionKind.TALK, "leave_group": ActionKind.IDLE,
}


class BodyFrame:
    """Per-agent egocentric frame kept by the adapter (heading, last position, social counters)."""

    def __init__(self, loc):
        self.heading = 0.0
        self.last_loc = tuple(loc)
        self.moved = False
        self.turned = False
        self.prev_social_mem = 0
        self.prev_conflict: Dict[str, float] = {}

    def to_json(self):
        return {"heading": self.heading, "last_loc": list(self.last_loc), "moved": self.moved,
                "turned": self.turned, "prev_social_mem": self.prev_social_mem,
                "prev_conflict": dict(self.prev_conflict)}


def _rel(heading, ax, ay, ox, oy):
    dx, dy = ox - ax, oy - ay
    return (math.atan2(dy, dx) - heading) % (2 * math.pi), math.hypot(dx, dy)


def update_frame(frame: BodyFrame, agent) -> None:
    x, y = agent.current_location
    dx, dy = x - frame.last_loc[0], y - frame.last_loc[1]
    frame.moved = (dx * dx + dy * dy) > 1e-10
    if frame.moved:
        frame.heading = math.atan2(dy, dx) % (2 * math.pi)
    frame.last_loc = (x, y)


def build_observation(agent, state, frame: BodyFrame) -> Observation:
    ax, ay = agent.current_location
    vision = []
    sound_sources = []
    touch = {"front": 0.0, "back": 0.0, "left": 0.0, "right": 0.0}
    for oid in agent.perception.visible_agents:
        other = state.agents.get(oid)
        if other is None or not other.is_alive:
            continue
        b, d = _rel(frame.heading, ax, ay, *other.current_location)
        if d <= PERCEPTION_RADIUS:
            vision.append(VisualSample(b, d, "agent", oid))
        if d <= HEARING_RADIUS:
            sound_sources.append(b)
        if d < TOUCH_RADIUS:
            q = int(((b + math.pi / 4) % (2 * math.pi)) // (math.pi / 2))
            touch[("front", "left", "back", "right")[q]] = 1.0
    for bld in state.world.buildings:
        if (bld.x - ax) ** 2 + (bld.y - ay) ** 2 <= PERCEPTION_RADIUS ** 2:
            b, d = _rel(frame.heading, ax, ay, bld.x, bld.y)
            vision.append(VisualSample(b, d, f"building:{bld.building_type}", bld.id))
    # terrain fill: one sample per empty 45-degree sector, at distance 3
    occupied = {int(((v.bearing + math.pi / 8) % (2 * math.pi)) // (math.pi / 4)) for v in vision}
    w, h = state.world.width, state.world.height
    for k in range(8):
        if k in occupied:
            continue
        ang = frame.heading + k * math.pi / 4
        cx, cy = int(ax + 3 * math.cos(ang)), int(ay + 3 * math.sin(ang))
        if 0 <= cx < w and 0 <= cy < h:
            cell = state.world.cells[cy * w + cx]
            vision.append(VisualSample(k * math.pi / 4, 3.0, f"terrain:{cell.terrain_type}", None))
    level = min(1.0, len(sound_sources) / 5.0)
    sound = SoundSample(level, tuple((b, 1.0 / len(sound_sources)) for b in sound_sources))
    posture = "lie" if agent.current_action in ("rest", "sleep") else "stand"
    last_motor = "turn" if frame.turned else ("move" if frame.moved else None)
    proprio = Proprio(frame.heading, posture, last_motor, 0.5 if frame.moved else 0.0)
    # social content received this tick
    n_social = sum(1 for m in agent.memories if m.source.startswith("social_"))
    gain = float(max(0, n_social - frame.prev_social_mem))
    frame.prev_social_mem = n_social
    loss = 0.0
    for tid, rel in agent.relationships.items():
        prev = frame.prev_conflict.get(tid, 0.0)
        if rel.conflict > prev:
            loss += rel.conflict - prev
        frame.prev_conflict[tid] = rel.conflict
    frame.turned = False
    return Observation(tuple(sorted(vision, key=lambda v: (v.bearing, v.distance, v.category, v.ref or ""))),
                       sound, TouchSample(**touch), proprio, (min(gain, 3.0), min(loss, 3.0)))


def build_interoception(agent) -> Interoception:
    n = agent.needs
    return Interoception(n.hunger, n.thirst, 1.0 - n.energy, n.sleep_need, 1.0 - n.health, n.pain)


def apply_action(action: Action, agent, context, frame: BodyFrame) -> str:
    """Maps a mind Action onto CivSYS and resolves its target. Returns the CivSYS action name."""
    from app.simulation.spatial.spatial import TargetResolver
    k = action.kind
    econ, market = agent.economic, context.state.world.market
    if k is ActionKind.EAT:
        name = "eat" if econ.food_inventory >= 1.0 else ("trade_buy" if econ.money >= market.food_price else "work")
    elif k is ActionKind.WORK:
        name = "work"
    elif k is ActionKind.REST:
        name = "rest"
    elif k in (ActionKind.TALK, ActionKind.SEEK_COMPANY):
        name = "talk"
    elif k is ActionKind.EXPLORE:
        name = "explore"
    elif k is ActionKind.MOVE:
        name = "explore"
    else:  # TURN, RUMINATE, IDLE: no CivSYS-side effect
        name = "idle"
    agent.current_action = name
    agent.action_intent = name
    TargetResolver.resolve(agent, context)
    if name in ("eat", "rest", "work"):
        # eat from carried food, rest, or work (CivSYS terrain yield or its subsistence
        # fallback) where the agent stands, executed this tick (no trip home or to the farm)
        agent.movement_state = "idle"
        agent.target_location = None
        agent.target_entity_id = None
        agent.target_type = None
    if k is ActionKind.MOVE:
        target = _move_target(action.target_ref, agent, context, frame)
        TargetResolver._set_target(agent, "location", None, target)
    if k is ActionKind.TURN:
        frame.heading = (frame.heading + TURN_STEP) % (2 * math.pi)
        frame.turned = True
    return name


def _move_target(ref: Optional[str], agent, context, frame: BodyFrame):
    if ref:
        for b in context.state.world.buildings:
            if b.id == ref:
                return (float(b.x), float(b.y))
        other = context.state.agents.get(ref)
        if other is not None and other.is_alive:
            return other.current_location
    x, y = agent.current_location
    w, h = context.state.world.width, context.state.world.height
    return (max(0.0, min(w - 1.0, x + 3 * math.cos(frame.heading))),
            max(0.0, min(h - 1.0, y + 3 * math.sin(frame.heading))))


def civ_action_kind(name: str) -> ActionKind:
    return CIV_TO_KIND.get(name, ActionKind.IDLE)
