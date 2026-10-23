from abc import ABC, abstractmethod
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from app.simulation.context import SimulationContext

class BaseSimulationSystem(ABC):
    """
    Contract interface for all 18 master tick simulation systems.
    Each system has a distinct responsibility and explicit state access boundary via SimulationContext.
    """
    def __init__(self, name: str, step_number: int):
        self.name: str = name
        self.step_number: int = step_number

    @abstractmethod
    def execute(self, context: 'SimulationContext') -> None:
        """
        Executes the system's operational logic for the current tick.
        Reads/writes strictly through context state boundaries.
        """

