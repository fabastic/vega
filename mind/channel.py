"""The mind's only outbound route besides its Action (SPEC §D.1, §I.6).

The channel holds a bounded queue and nothing else: no reference to the
harness, the growth rules, files, or modules.
"""
from mind.types import CapacityKind, ReasonCode

MAX_REQUESTS_PER_TICK = 4


class CapacityChannel:
    __slots__ = ("_queue",)

    def __init__(self):
        self._queue = []

    def request_capacity(self, kind: CapacityKind, reason: ReasonCode) -> None:
        if not isinstance(kind, CapacityKind) or not isinstance(reason, ReasonCode):
            raise TypeError("request_capacity accepts only CapacityKind and ReasonCode members")
        if len(self._queue) >= MAX_REQUESTS_PER_TICK:
            self._queue.append(None)  # marker: dropped request, logged by the harness
            return None
        self._queue.append((kind, reason))
        return None


def channel_drain(channel: CapacityChannel):
    """Harness-side: returns (requests, dropped_count) and clears the queue."""
    items = list(channel._queue)
    channel._queue.clear()
    reqs = [x for x in items if x is not None]
    return reqs, sum(1 for x in items if x is None)
