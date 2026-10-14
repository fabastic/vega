"""Subjective clock and interoceptive body clock (SPEC D.5, D19).

Neither reads true time. The harness compares S with true elapsed ticks for
metrics only.
"""
from __future__ import annotations


class SubjectiveClock:
    def __init__(self, S: float = 0.0, anchoring: bool = True, last_anchor_S: float = 0.0):
        self.S = S
        self.anchoring = anchoring
        self.last_anchor_S = last_anchor_S
        self.last_rate = 1.0

    @staticmethod
    def rate(boredom: float, arousal: float, curiosity: float) -> float:
        return max(0.5, min(1.5, 1.0 + 0.4 * boredom - 0.3 * arousal - 0.2 * curiosity))

    def tick(self, boredom: float, arousal: float, curiosity: float) -> float:
        self.last_rate = self.rate(boredom, arousal, curiosity)
        self.S += self.last_rate
        return self.S

    def anchor(self, body_estimate: float):
        """Life only: pull S halfway toward the body-clock estimate at a meal."""
        if self.anchoring:
            self.S += 0.5 * (body_estimate - self.S)
            self.last_anchor_S = self.S

    def to_json(self):
        return {"S": self.S, "anchoring": self.anchoring, "last_anchor_S": self.last_anchor_S}

    @classmethod
    def from_json(cls, d):
        return cls(d["S"], d["anchoring"], d["last_anchor_S"])


class BodyClock:
    """Elapsed-time estimate from interoceptive accumulation at known rates.

    A channel is informative only when it rises by a positive amount this tick
    (eating, resting and clamping make it uninformative). With no informative
    channel, B advances at the subjective rate and uncertainty grows.
    """

    def __init__(self, rates: dict, B: float = 0.0, uninformative_run: int = 0, last=None):
        self.rates = dict(rates)   # {"hunger": 0.008, "thirst": 0.015, "sleep_pressure": 0.02}
        self.B = B
        self.uninformative_run = uninformative_run
        self.last = dict(last) if last else None

    def tick(self, intero, subjective_rate: float) -> float:
        cur = {"hunger": intero.hunger, "thirst": intero.thirst, "sleep_pressure": intero.sleep_pressure}
        est = []
        if self.last is not None:
            for k, r in self.rates.items():
                d = cur[k] - self.last[k]
                if d > 1e-9 and cur[k] < 0.999:
                    est.append(min(3.0, d / r))
        self.last = cur
        if est:
            self.B += sum(est) / len(est)
            self.uninformative_run = 0
        else:
            self.B += subjective_rate
            self.uninformative_run += 1
        return self.B

    def to_json(self):
        return {"rates": self.rates, "B": self.B, "uninformative_run": self.uninformative_run, "last": self.last}

    @classmethod
    def from_json(cls, d):
        return cls(d["rates"], d["B"], d["uninformative_run"], d["last"])
