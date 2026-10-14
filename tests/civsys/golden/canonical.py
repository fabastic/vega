"""Canonical per-tick digests of CivSYS state, used by the golden backcompat test.

Floats are serialised with json's exact repr, so any behavioural change in the
default engine changes the digest.
"""
import hashlib
import json


def _agent_view(a):
    return {
        "id": a.id,
        "alive": a.is_alive,
        "age": a.age,
        "loc": list(a.current_location),
        "home": list(a.home_location),
        "target": list(a.target_location) if a.target_location else None,
        "action": a.current_action,
        "movement": a.movement_state,
        "migrating": a.is_migrating,
        "needs": a.needs.model_dump(),
        "econ": a.economic.model_dump(),
        "skills": a.skills.model_dump(),
        "emotions": {k: v.intensity for k, v in a.emotions},
        "n_mem": len(a.memories),
        "last_mem": a.memories[-1].id if a.memories else None,
        "mem_conf": sum(m.confidence for m in a.memories),
        "beliefs": {k: [b.value, b.confidence] for k, b in sorted(a.beliefs.items())},
        "rels": {k: [r.trust, r.affection, r.familiarity, r.conflict] for k, r in sorted(a.relationships.items())},
        "goals": [[g.name, g.priority, g.urgency, g.progress] for g in a.goals],
        "n_known_buildings": len(a.information.known_buildings),
        "cog_lr": a.cognition.learning_rate,
    }


def tick_digest(state) -> str:
    w = state.world
    data = {
        "tick": state.tick,
        "world": {
            "weather": w.weather,
            "crop": w.crop_yield_multiplier,
            "caps": list(w.active_capabilities),
            "tech": w.tech_progress,
            "market": w.market.model_dump(),
        },
        "agents": [_agent_view(a) for _, a in sorted(state.agents.items())],
        "groups": {k: [sorted(g.members), g.cohesion, g.influence] for k, g in sorted(state.groups.items())},
        "metrics": state.metrics_history[-1].model_dump() if state.metrics_history else None,
        "ledger_len": len(state.causal_ledger),
    }
    return hashlib.sha256(json.dumps(data, sort_keys=True).encode("utf-8")).hexdigest()


def cells_digest(state) -> str:
    data = [
        [c.food_resources, c.wood_resources, c.stone_resources, c.metal_resources, c.fertility]
        for c in state.world.cells
    ]
    return hashlib.sha256(json.dumps(data).encode("utf-8")).hexdigest()
