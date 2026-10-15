"""Focal-agent systems inserted only when FocalConfig.enabled (SPEC A.2, A.3)."""
from __future__ import annotations

from app.simulation.action import Action as CivAction, ActionScore
from app.simulation.base import BaseSimulationSystem
from app.simulation.context import SimulationContext
from civsys_focal.adapter import (BodyFrame, apply_action, build_interoception, build_observation,
                                          civ_action_kind, update_frame)
from civsys_focal.viability import ViableDecisionSystem
from mind.features import features

LOG_FIELDS = ("action", "target", "phantom", "pe", "novelty", "control", "info", "valence", "arousal",
              "dominance", "mood", "S", "B", "body_uninformative_run", "replay", "selfpred_acc",
              "predicted_action", "n_memories", "internal_goals_total", "open_queries", "rules")


def _vision_counts(obs):
    c = {"agent": 0, "building": 0, "terrain": 0, "object": 0, "wall": 0}
    for v in obs.vision:
        key = v.category.split(":", 1)[0]
        c[key] = c.get(key, 0) + 1
    return c


class FocalDecisionSystem(ViableDecisionSystem):
    """DecisionSystem for everyone, plus the focal agent's mind.

    With focal_policy == "mind", the focal agent is skipped by the original loop
    (temporarily flagged as traveling, so other agents still see and target it)
    and acts through the mind instead.
    """

    def __init__(self, cfg):
        super().__init__(getattr(cfg, "viability", None))
        self.cfg = cfg

    def execute(self, context: SimulationContext) -> None:
        fs = context.transient_data["focal"]
        agent = context.state.agents.get(self.cfg.focal_agent_id)
        if agent is None or not agent.is_alive:
            super().execute(context)
            return
        traveling = agent.movement_state == "traveling"
        viable = getattr(getattr(self, "viability", None), "enabled", False)
        if self.cfg.focal_policy == "mind" and viable:
            self.skip_ids = {agent.id}
            super().execute(context)
        elif self.cfg.focal_policy == "mind":
            saved = agent.movement_state
            agent.movement_state = "traveling"
            try:
                super().execute(context)
            finally:
                agent.movement_state = saved
        else:
            super().execute(context)
        frame: BodyFrame = fs["frame"]
        update_frame(frame, agent)
        obs = build_observation(agent, context.state, frame)
        intero = build_interoception(agent)
        mind = fs["mind"]
        if hasattr(mind, "relationships"):
            mind.relationships = {tid: rel.affection for tid, rel in sorted(agent.relationships.items())}
        action = mind.observe(obs, intero)
        overridden = False
        if self.cfg.focal_policy == "mind":
            # No travel commitment for the mind-driven focal agent: it re-decides every
            # tick (an unexecuted choice would otherwise be scored as a failed action).
            overridden = False
            realized = apply_action(action, agent, context, frame)
            context.pending_actions.append(CivAction(action_type=realized, agent_id=agent.id,
                                                     score_breakdown=ActionScore()))
        else:
            realized = agent.current_action
        fs["last"] = {"obs": obs, "intero": intero, "action": action, "realized": realized,
                      "overridden": overridden}


class FocalExportSystem(BaseSimulationSystem):
    """Writes the egocentric export rows (focal + held-out agents) each tick (SPEC A.3)."""

    def __init__(self, cfg):
        super().__init__(name="FocalExportSystem", step_number=16.9)
        self.cfg = cfg

    def execute(self, context: SimulationContext) -> None:
        fs = context.transient_data["focal"]
        last = fs.get("last")
        agent = context.state.agents.get(self.cfg.focal_agent_id)
        if last is not None and agent is not None:
            mind_log = getattr(fs["mind"], "last_log", {})
            row = {"tick": context.tick, "realized": last["realized"], "overridden": last["overridden"]}
            if not self.cfg.death_isolation:
                row["alive"] = agent.is_alive      # round-1 layout; omitted under death isolation
            row.update({f"f{i}": float(x) for i, x in enumerate(features(last["obs"], last["intero"]))})
            row.update({f"vc_{k}": v for k, v in _vision_counts(last["obs"]).items()})
            row.update({k: mind_log.get(k) for k in LOG_FIELDS})
            row.update({f"I_{c}": mind_log.get(f"I_{c}") for c in _CHANNELS})
            row.update({f"legacy_{k}": e.intensity for k, e in agent.emotions})
            row["n_reflection_events"] = len(mind_log.get("reflection_events", []))
            if self.cfg.export_enabled:
                fs["rows"].append(row)
            fs["history"].append(row)
            fs["history"] = fs["history"][-self.cfg.history_ticks:]
            fs["last"] = None
        if self.cfg.export_all_agents and self.cfg.export_enabled:
            skip = set(self.cfg.heldout_agent_ids) | {self.cfg.focal_agent_id}
            for aid, a in sorted(context.state.agents.items()):
                if aid in skip or not a.is_alive:
                    continue
                frame = fs["train_frames"].setdefault(aid, BodyFrame(a.current_location))
                update_frame(frame, a)
                tobs = build_observation(a, context.state, frame)
                trow = {"tick": context.tick, "agent": aid, "action": civ_action_kind(a.current_action).value}
                trow.update({f"f{i}": float(x) for i, x in enumerate(features(tobs, build_interoception(a)))})
                fs["train_rows"].setdefault(aid, []).append(trow)
        for hid in self.cfg.heldout_agent_ids:
            h = context.state.agents.get(hid)
            if h is None or not h.is_alive or not self.cfg.export_enabled:
                continue
            frame = fs["heldout_frames"].setdefault(hid, BodyFrame(h.current_location))
            update_frame(frame, h)
            obs = build_observation(h, context.state, frame)
            intero = build_interoception(h)
            hrow = {"tick": context.tick, "action": civ_action_kind(h.current_action).value}
            hrow.update({f"f{i}": float(x) for i, x in enumerate(features(obs, intero))})
            fs["heldout_rows"].setdefault(hid, []).append(hrow)


from mind.affect.params import CHANNELS as _CHANNELS  # noqa: E402
