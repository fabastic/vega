"""Per-tick log rows, identical in layout for room arms and civ_control."""
from __future__ import annotations

import hashlib
import json

from mind.affect.params import CHANNELS


def mind_state_hash(mind) -> str:
    return hashlib.sha256(json.dumps(mind.export_state(), sort_keys=True, default=str).encode()).hexdigest()


def reference_sets(handoff) -> set:
    """Entities the agent knew before handoff (CivSYS places and agents): phantoms on these are 'pre'."""
    v1 = handoff.minds["v1"]
    return set(v1.get("place_memory", {}).keys()) | set(v1.get("relationships", {}).keys()) | \
        set(handoff.relationships.keys())


def make_row(tau, mind, action, obs, intero, grant_recs, pre_refs, extra=None) -> dict:
    log = getattr(mind, "last_log", {}) or {}
    target = action.target_ref
    phantom = bool(log.get("phantom"))
    ev = log.get("reflection_events", []) or []
    row = {
        "tau": tau, "action": action.kind.value, "target": target or "",
        "phantom": int(phantom),
        "phantom_origin": ("pre" if target in pre_refs else "room") if phantom else "",
        "S": log.get("S"), "B": log.get("B"), "body_uninformative_run": log.get("body_uninformative_run"),
        "pe": log.get("pe"), "novelty": log.get("novelty"), "control": log.get("control"), "info": log.get("info"),
        "valence": log.get("valence"), "arousal": log.get("arousal"), "dominance": log.get("dominance"),
        "mood": log.get("mood"), "replay": int(bool(log.get("replay"))), "rules": log.get("rules", ""),
        "selfpred_acc": log.get("selfpred_acc"), "predicted_action": log.get("predicted_action") or "",
        "n_memories": log.get("n_memories"), "internal_goals_total": log.get("internal_goals_total"),
        "open_queries": log.get("open_queries"),
        "q_created": "|".join(f"{e['type']}:{e.get('depth', 0)}" for e in ev if e["event"] == "created"),
        "q_resolved": "|".join(f"{e['type']}:{e.get('resolution', '')}" for e in ev if e["event"] == "resolved"),
        "q_abandoned": "|".join(e["type"] for e in ev if e["event"] == "abandoned"),
        "q_revisited": "|".join(e["type"] for e in ev if e["event"] == "revisited"),
        "hunger": intero.hunger, "thirst": intero.thirst, "fatigue": intero.fatigue,
        "sleep_pressure": intero.sleep_pressure, "health_deficit": intero.health_deficit,
        "vision_n": len(obs.vision), "sound": obs.sound.level,
        "grants": sum(1 for r in grant_recs if r.get("decision") == "granted"),
        "grant_kinds": "|".join(r["kind"] for r in grant_recs if r.get("decision") == "granted"),
        "requests": sum(1 for r in grant_recs if r.get("decision") in ("granted", "denied")),
    }
    for k in ("nll", "nll_ratio", "wm_loss", "ac_loss", "kl", "latent_eff_rank", "v2_selfpred_acc"):
        if k in log:
            row[k] = log.get(k)
    if hasattr(mind, "param_count"):
        row["params"] = mind.param_count()
    cap = mind.telemetry().capacity
    for k, v in sorted(cap.items()):
        row[f"cap_{k}"] = v
    for c in CHANNELS:
        row[f"I_{c}"] = log.get(f"I_{c}")
    if extra:
        row.update(extra)
    return row
