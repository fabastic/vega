"""Round 3: does the CivSYS population survive a long life phase with FocalConfig.viability on?

Runs the life-phase engine settings (focal agent driven by the v1 mind, death isolation) and records, per seed:
the first death of any agent, the first death the focal agent could perceive, deaths by cause, and need levels.
    python -m experiments.viability_scan --seeds 42 101 --horizon 1000 [--off]
"""
import argparse
import json
import statistics
import time
from collections import Counter

from experiments.common import ROOT


def scan(seed: int, horizon: int, viability: bool, pop: int = 150, size: int = 128, overrides=None) -> dict:
    from civsys_focal.config import FocalConfig
    from civsys_focal.engine import FocalSimulationEngine
    from civsys_focal.viability import ViabilityConfig
    via = ViabilityConfig(enabled=viability, **(overrides or {}))
    cfg = FocalConfig(enabled=True, affect_enabled=True, focal_policy="mind", death_isolation=True, viability=via)
    e = FocalSimulationEngine(seed=seed, population_size=pop, width=size, height=size, focal=cfg)
    focal = e.state.agents[cfg.focal_agent_id]
    t0 = time.time()
    known, first_known, first_any, focal_died = set(), None, None, None
    alive_prev = {a for a, ag in e.state.agents.items() if ag.is_alive}
    alive_by_tick, need_by_tick = {}, {}
    for _ in range(horizon):
        t = e.state.tick
        if focal.is_alive:
            known |= set(focal.perception.visible_agents)
        e.step()
        alive_now = {a for a, ag in e.state.agents.items() if ag.is_alive}
        died = alive_prev - alive_now - {cfg.focal_agent_id}
        if died:
            first_any = t if first_any is None else first_any
            if first_known is None and died & known:
                first_known = t
        if not focal.is_alive and focal_died is None:
            focal_died = t
        alive_prev = alive_now
        if t % 100 == 99:
            living = [a for a in e.state.agents.values() if a.is_alive]
            alive_by_tick[t + 1] = len(living)
            need_by_tick[t + 1] = {k: round(statistics.mean(getattr(a.needs, k) for a in living), 3) if living else None
                                   for k in ("hunger", "thirst", "health")}
    agents = e.state.agents.values()
    causes = Counter(a.social_identity.cause_of_death or "health_depletion" for a in agents if not a.is_alive)
    return {"seed": seed, "viability": viability, "horizon": horizon, "start_pop": pop,
            "alive_end": sum(1 for a in agents if a.is_alive), "n_agents_end": len(e.state.agents),
            "first_any_death": first_any, "first_known_death": first_known, "focal_died": focal_died,
            "n_known": len(known), "causes": dict(causes), "alive_by_tick": alive_by_tick, "needs_by_tick": need_by_tick,
            "food_price_end": e.state.world.market.food_price, "seconds": round(time.time() - t0, 1)}


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--seeds", type=int, nargs="+", default=[42, 101, 202])
    ap.add_argument("--horizon", type=int, default=1000)
    ap.add_argument("--off", action="store_true", help="viability off (unmodified CivSYS behaviour)")
    ap.add_argument("--out", default=None)
    a = ap.parse_args()
    rows = []
    for s in a.seeds:
        r = scan(s, a.horizon, not a.off)
        rows.append(r)
        print(json.dumps({k: r[k] for k in ("seed", "viability", "alive_end", "first_any_death", "first_known_death",
                                            "focal_died", "causes", "food_price_end", "seconds")}), flush=True)
    if a.out:
        (ROOT / a.out).write_text(json.dumps({"rows": rows}, indent=1))
