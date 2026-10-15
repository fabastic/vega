"""Viable life (round 3): flag-gated fixes that let the CivSYS population survive a long life phase.

Unmodified CivSYS collapses on its own: the first agent starves at tick ~81 and everyone is dead by tick ~150-200
(DECISIONS_OVERNIGHT.md 00:46, DECISIONS_ROUND2.md 12:50). The causes are in upstream behaviour, so the fixes live
here, behind FocalConfig.viability, and apply to every agent. With viability off nothing here runs and the golden
backcompat test still reproduces unmodified CivSYS exactly.

Fixes (each one targets a diagnosed cause):
1. Eating counts thirst. CivSYS relieves thirst only by eating, but scores "eat" (and buying food) from hunger alone,
   and thirst rises ~2x faster. Eat utility (and trade_buy utility for an agent with money and no food, e.g. miners
   and crafters, whose work yields no food) uses max(hunger, thirst), with an urgency bonus at a critical need level.
2. Food is carried, so eating and resting happen where the agent stands instead of after a walk home.
3. Travel can end. CivSYS never re-decides while an agent is traveling, and some targets are unreachable
   (migrants aim for a non-existent "house" building; separation keeps workers off crowded farm cells). After
   `travel_timeout` ticks the agent performs its action where it stands; an agent with critical need and food on
   hand re-decides at once.
4. The food price is capped. The EMA price can run away (~1e79), which makes trade impossible and migration
   attractive.
5. Stable population (optional): no old-age deaths and no births during the life phase, so the focal agent never
   perceives a death and civ_control can run as long as the room.
6. Mechanized work works. After electricity unlocks (~tick 200) agents mostly pick "work_mechanized", which CivSYS's
   ActionSystem and TargetResolver never handle, so it produced nothing and agents starved while "working". It is
   executed as "work" with action_intent "work_mechanized", which ActionSystem already reads as mechanized.
"""
from __future__ import annotations

import numpy as np
from pydantic import BaseModel

from app.simulation.action import Action, ActionScore
from app.simulation.civilization.lifecycle import LifecycleSystem
from app.simulation.context import SimulationContext
from app.simulation.economy.markets import EconomySystem
from app.simulation.humans.decisions import DecisionSystem
from app.simulation.spatial.spatial import TargetResolver

IN_PLACE = ("eat", "rest", "sleep")


class ViabilityConfig(BaseModel):
    enabled: bool = False
    eat_weight: float = 4.0          # eat need_benefit = eat_weight * max(hunger, thirst)
    critical_need: float = 0.7       # at or above: urgency bonus for eating, and travel is interrupted
    urgency_bonus: float = 3.0
    travel_timeout: int = 12         # ticks of travel before the action is performed where the agent stands
    price_cap: float = 15.0          # upper bound on every market price (CivSYS default food price is 10)
    stable_population: bool = True   # no old-age mortality and no births


def _need(agent) -> float:
    return max(agent.needs.hunger, agent.needs.thirst)


class ViableDecisionSystem(DecisionSystem):
    """DecisionSystem with fixes 1-3. Identical to DecisionSystem when viability is disabled."""

    def __init__(self, viability: ViabilityConfig | None = None):
        super().__init__()
        self.viability = viability or ViabilityConfig()
        self.skip_ids: set = set()   # agents decided elsewhere (the mind-driven focal agent)

    def execute(self, context: SimulationContext) -> None:
        v = getattr(self, "viability", None)   # absent on instances unpickled from older checkpoints
        if v is None or not v.enabled:
            super().execute(context)
            return
        skip = getattr(self, "skip_ids", set())
        since = context.transient_data.setdefault("viability_travel_since", {})
        for agent in context.state.agents.values():
            if not agent.is_alive or agent.id in skip:
                continue
            if agent.movement_state == "traveling":
                start = since.setdefault(agent.id, context.tick)
                can_eat_now = _need(agent) >= v.critical_need and agent.economic.food_inventory >= 1.0
                if not can_eat_now:
                    if context.tick - start >= v.travel_timeout:
                        agent.movement_state = "arrived"   # act where it stands this tick
                        since.pop(agent.id, None)
                    continue
            since.pop(agent.id, None)
            self._decide(agent, context)
            if agent.movement_state == "traveling":
                since[agent.id] = context.tick

    def _decide(self, agent, context: SimulationContext) -> None:
        available = self.candidate_actions.copy()
        if "electricity" in context.state.world.active_capabilities:
            available.append("work_mechanized")
        scores = {a: self._score_action(a, agent, context) for a in available}
        u = np.array([scores[a].total_score for a in available], dtype=np.float64)
        p = np.exp((u - np.max(u)) / 0.5)
        p /= np.sum(p)
        chosen = available[context.np_rng.choice(len(available), p=p)]
        # fix 6: CivSYS offers "work_mechanized" once electricity exists, but ActionSystem and TargetResolver only
        # handle "work" (ActionSystem reads mechanization from action_intent), so it used to produce nothing
        agent.current_action = "work" if chosen == "work_mechanized" else chosen
        agent.action_intent = chosen
        TargetResolver.resolve(agent, context)
        if chosen in IN_PLACE:
            agent.target_type = "location"
            agent.target_entity_id = None
            agent.target_location = agent.current_location
            agent.movement_state = "arrived"
        context.pending_actions.append(Action(action_type=chosen, agent_id=agent.id, score_breakdown=scores[chosen]))

    def _score_action(self, action_type: str, agent, context: SimulationContext) -> ActionScore:
        score = super()._score_action(action_type, agent, context)
        v = getattr(self, "viability", None)
        if v is None or not v.enabled:
            return score
        has_food = agent.economic.food_inventory >= 1.0
        can_buy = not has_food and agent.economic.money >= agent.perception.perceived_food_price
        if not ((action_type == "eat" and has_food) or (action_type == "trade_buy" and can_buy)):
            return score
        need = _need(agent)
        old = score.need_benefit
        score.need_benefit = v.eat_weight * need + (v.urgency_bonus if need >= v.critical_need else 0.0)
        score.total_score += score.need_benefit - old
        return score


class ViableEconomySystem(EconomySystem):
    """EconomySystem with fix 4 (price cap)."""

    def __init__(self, viability: ViabilityConfig):
        super().__init__()
        self.viability = viability

    def execute(self, context: SimulationContext) -> None:
        super().execute(context)
        market = context.state.world.market
        for res in ("food", "wood", "stone", "metal", "tools"):
            key = f"{res}_price"
            setattr(market, key, min(self.viability.price_cap, getattr(market, key)))


class ViableLifecycleSystem(LifecycleSystem):
    """LifecycleSystem with fix 5: starvation deaths and aging stay; old-age deaths and births are off."""

    def __init__(self, viability: ViabilityConfig):
        super().__init__()
        self.viability = viability

    def execute(self, context: SimulationContext) -> None:
        if not self.viability.stable_population:
            super().execute(context)
            return
        for agent in list(context.state.agents.values()):
            if not agent.is_alive:
                continue
            if agent.needs.hunger > 0.95:
                agent.is_alive = False
                agent.social_identity.cause_of_death = "starvation"
                agent.social_identity.death_tick = context.tick
                context.log_causal_event(event_id=f"death_{agent.id}_{context.tick}", event_type="agent_death",
                                         subject_id=agent.id, previous_state={"alive": True, "hunger": agent.needs.hunger},
                                         new_state={"alive": False}, reason="starvation")
                continue
            if context.tick % 100 == 0 and context.tick > 0:
                agent.age += 1
                agent.social_identity.life_stage = ("child" if agent.age < 18 else "adult" if agent.age < 60 else "elder")
