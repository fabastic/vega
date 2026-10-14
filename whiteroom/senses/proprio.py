from mind.types import Proprio


def sense(heading, posture, last_motor, effort):
    return Proprio(heading, posture, last_motor, effort)
