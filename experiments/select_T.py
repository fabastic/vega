"""Round 2, Change 1: choose the handoff tick T before any death the focal agent could perceive.

For each seed, run the life phase (round-2 focal settings) and record, per tick, the set of agents the
focal agent has ever perceived ("could perceive"), the first death among them, the first death of any
agent, and the first death within the focal agent's perception radius.
    python -m experiments.select_T
"""
import json
import time

from experiments.common import ROOT

POOL = [42, 101, 202, 303, 404, 1010, 606, 707, 808, 909, 1111, 1212, 1313, 1414, 1515]
HORIZON = 160


def scan(seed: int) -> dict:
    from civsys_focal.config import FocalConfig
    from civsys_focal.engine import FocalSimulationEngine
    cfg = FocalConfig(enabled=True, affect_enabled=True, focal_policy="mind", death_isolation=True)
    e = FocalSimulationEngine(seed=seed, population_size=150, width=128, height=128, focal=cfg)
    focal = e.state.agents[cfg.focal_agent_id]
    known, first_known, first_any, first_near = set(), None, None, None
    alive_prev = {a for a, ag in e.state.agents.items() if ag.is_alive}
    for _ in range(HORIZON):
        t = e.state.tick
        near = set(focal.perception.visible_agents) if focal.is_alive else set()
        known |= near
        e.step()
        alive_now = {a for a, ag in e.state.agents.items() if ag.is_alive}
        died = alive_prev - alive_now - {cfg.focal_agent_id}
        if died:
            first_any = t if first_any is None else first_any
            if first_known is None and died & known:
                first_known = t
            if first_near is None and died & near:
                first_near = t
        if not focal.is_alive:
            return {"seed": seed, "focal_died": t, "first_known_death": first_known, "first_any_death": first_any,
                    "first_near_death": first_near, "n_known": len(known)}
        alive_prev = alive_now
    return {"seed": seed, "focal_died": None, "first_known_death": first_known, "first_any_death": first_any,
            "first_near_death": first_near, "n_known": len(known)}


if __name__ == "__main__":
    t0 = time.time()
    rows = [scan(s) for s in POOL]
    for r in rows:
        print(json.dumps(r), flush=True)
    (ROOT / "results_round2" / "T_selection_scan.json").write_text(json.dumps({"horizon": HORIZON, "rows": rows,
                                                                              "seconds": round(time.time() - t0, 1)}, indent=1))
