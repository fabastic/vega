"""Affect core: appraisal rules R1-R14, decay, VAD and mood (SPEC D.5, H)."""
from __future__ import annotations

from dataclasses import dataclass

from mind.affect import params as P


@dataclass
class AppraisalInputs:
    need_deficit: float = 0.0
    deficit_rise: float = 0.0
    hunger: float = 0.0
    thirst: float = 0.0
    prediction_error: float = 0.0
    novelty: float = 0.5
    social_gain: float = 0.0
    social_loss: float = 0.0
    contact_lost: bool = False
    control: float = 0.5
    outcome_value: int = 0            # +1 improved, -1 worsened, 0 neither
    grief_signal: float = 0.0         # summed affection of agents newly unseen for 24 subjective ticks (round 1)
    absence_signal: float = 0.0       # same signal under death isolation: unexplained absence (round 2)
    low_novelty_run: int = 0          # consecutive ticks with novelty < 0.2 and PE < 0.2
    visual_extent_high: bool = False
    relief_predicted: bool = False
    aversive: float = 0.0             # R14 test hook only


def trait_terms(traits: dict) -> dict:
    def g(k):
        return float(traits.get(k, 0.5))
    return {
        "neuroticism": 1.0 - g("emotional_stability"),
        "disagreeableness": 1.0 - g("agreeableness"),
        "extraversion": g("extraversion"),
        "openness": g("openness"),
        "conscientiousness": g("conscientiousness"),
    }


class AffectCore:
    def __init__(self, traits: dict):
        self.traits = dict(traits)
        self.terms = trait_terms(self.traits)
        self.I = {c: 0.0 for c in P.CHANNELS}
        self.source = {c: None for c in P.CHANNELS}
        self.v = 0.0
        self.a = 0.0
        self.d = 0.5
        self.mood = 0.0
        c = self.terms["conscientiousness"]
        self.half_life = {
            ch: P.HALF_LIFE[ch] * ((1.0 - P.CONSCIENTIOUS_RECOVERY * c) if ch in P.NEGATIVE else 1.0)
            for ch in P.CHANNELS
        }

    def gain(self, ch: str) -> float:
        if ch not in P.GAIN:
            return 1.0
        term, k = P.GAIN[ch]
        return 1.0 + k * self.terms[term]

    def _add(self, ch: str, delta: float, src: str):
        if delta <= 0:
            return
        self.I[ch] = min(1.0, self.I[ch] + self.gain(ch) * delta)
        self.source[ch] = src

    def apply_rules(self, x: AppraisalInputs) -> list:
        fired = []

        def fire(rule, ch, delta):
            self._add(ch, delta, rule)
            fired.append(rule)

        if x.deficit_rise > 0.02 or x.hunger > 0.8 or x.thirst > 0.8:
            fire("R1", "fear", 0.15)
        if x.prediction_error > 0.5 and x.outcome_value < 0:
            fire("R2", "fear", 0.1 * x.prediction_error)
            fire("R2", "surprise", x.prediction_error)
        if x.prediction_error > 0.5:
            fire("R3", "surprise", 0.5 * x.prediction_error)
        if x.contact_lost:
            fire("R4", "loneliness", 0.2)
        if x.social_loss > 0:
            fire("R5", "sadness", 0.1 * x.social_loss)
        if x.social_gain > 0:
            fire("R6", "joy", 0.1 * x.social_gain)
            fire("R6", "attachment", 0.05 * x.social_gain)
        if x.grief_signal > 0:
            fire("R7", "grief", 0.1 * x.grief_signal)
            fire("R7", "sadness", 0.05)
        if x.absence_signal > 0:
            # R7a: a valued agent has not been seen for a long time and nothing explains why.
            # No concept of the other's death exists anywhere in the mind.
            fire("R7a", "loneliness", 0.1 * x.absence_signal)
            fire("R7a", "sadness", 0.05)
        if x.novelty > 0.6 and x.control > 0.3:
            fire("R8", "curiosity", 0.1)
        if x.low_novelty_run >= 12:
            fire("R9", "boredom", 0.02)
        if x.outcome_value > 0:
            fire("R10", "joy", 0.1)
            fire("R10", "pride", 0.05 * x.control)
        if x.outcome_value < 0 and x.control > 0.5:
            fire("R11", "anger", 0.1)
        if x.novelty > 0.8 and x.visual_extent_high:
            fire("R12", "awe", 0.05)
        if x.need_deficit > 0.6 and x.relief_predicted:
            fire("R13", "anticipation", 0.1)
        if x.aversive > 0:
            fire("R14", "disgust", 0.5 * x.aversive)
        return fired

    def decay(self):
        for ch in P.CHANNELS:
            if self.I[ch] > 0:
                self.I[ch] *= 2.0 ** (-1.0 / self.half_life[ch])
                if self.I[ch] < 1e-6:
                    self.I[ch] = 0.0
                    self.source[ch] = None

    def update_vad(self, need_deficit: float, control: float):
        total = sum(self.I.values())
        if total > 1e-9:
            self.v = max(-1.0, min(1.0, sum(P.SIGN[c] * self.I[c] for c in P.CHANNELS) / total))
            a = sum(P.AROUSAL[c] * self.I[c] for c in P.CHANNELS) / total
        else:
            self.v, a = 0.0, 0.0
        self.a = max(0.0, min(1.0, a + 0.2 * need_deficit))
        dom = sum(P.DOMINANCE[c] * self.I[c] for c in P.CHANNELS) / len(P.CHANNELS)
        self.d = max(0.0, min(1.0, 0.5 + 0.3 * dom + 0.2 * (control - 0.5)))
        self.mood += P.MOOD_ETA * (self.v - self.mood)

    def step(self, x: AppraisalInputs) -> list:
        """One tick: decay, then rules, then VAD and mood."""
        self.decay()
        fired = self.apply_rules(x)
        self.update_vad(x.need_deficit, x.control)
        return fired

    def to_json(self) -> dict:
        return {"I": dict(self.I), "source": dict(self.source), "v": self.v, "a": self.a,
                "d": self.d, "mood": self.mood, "traits": self.traits}

    @classmethod
    def from_json(cls, data: dict) -> "AffectCore":
        core = cls(data["traits"])
        core.I = {c: float(data["I"][c]) for c in P.CHANNELS}
        core.source = {c: data["source"].get(c) for c in P.CHANNELS}
        core.v, core.a, core.d, core.mood = data["v"], data["a"], data["d"], data["mood"]
        return core
