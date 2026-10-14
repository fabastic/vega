"""What the agent's actions do in the room: action_feedback is an explicit parameter (SPEC C.3).

none           motor commands change nothing; no efference copy is reported back
proprioceptive heading and posture change, position does not; efference copy reported
full           movement within the walls; vision and touch change with position
"""
import math

from mind.types import ActionKind

TURN_STEP = math.pi / 4
DIRS = {0: (1, 0), 1: (1, 1), 2: (0, 1), 3: (-1, 1), 4: (-1, 0), 5: (-1, -1), 6: (0, -1), 7: (1, -1)}


def apply_motor(kind, feedback, room, pos, heading, posture):
    """Returns (pos, heading, posture, last_motor, effort, bumped)."""
    if feedback == "none":
        return pos, heading, "stand", None, 0.0, False
    bumped = False
    last_motor = None
    effort = 0.0
    if kind is ActionKind.TURN:
        heading = (heading + TURN_STEP) % (2 * math.pi)
        last_motor, effort = "turn", 0.2
    elif kind in (ActionKind.MOVE, ActionKind.EXPLORE):
        last_motor, effort = "move", 0.5
        if feedback == "full":
            k = int(round(heading / TURN_STEP)) % 8
            dx, dy = DIRS[k]
            nx, ny = pos[0] + dx, pos[1] + dy
            if room.blocked(nx, ny):
                bumped = True
            else:
                pos = (nx, ny)
    posture = "lie" if kind is ActionKind.REST else "stand"
    return pos, heading, posture, last_motor, effort, bumped
