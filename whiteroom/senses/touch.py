from mind.types import TouchSample


def feel(bumped_front: bool, lying: bool):
    return TouchSample(front=1.0 if bumped_front else 0.0, pressure=0.5 if lying else 0.0)
