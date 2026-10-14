"""The single mind interface used in both worlds (SPEC D.1).

The mind receives sensor content and interoception only: no tick, arm,
condition, cell, grant schedule, or knowledge of the experiment.
"""
from typing import Protocol, runtime_checkable

from mind.channel import CapacityChannel
from mind.types import Action, Interoception, Observation, Telemetry


@runtime_checkable
class Mind(Protocol):
    version: str

    def observe(self, obs: Observation, intero: Interoception) -> Action: ...

    def export_state(self) -> dict: ...

    @classmethod
    def from_state(cls, state: dict, channel: CapacityChannel) -> "Mind": ...

    # read-only views for the harness and probes
    def telemetry(self) -> Telemetry: ...

    def capacity_handles(self): ...
