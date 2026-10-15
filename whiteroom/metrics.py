"""Pure metric functions over per-tick rows (SPEC E.3 / E.4). Identical for every arm."""
from __future__ import annotations

import math
from collections import Counter
from typing import Dict, List, Optional

import numpy as np

from mind.affect.params import CHANNELS

W = 24
NGRAM = 12


def entropy(actions: List[str]) -> float:
    if not actions:
        return 0.0
    c = Counter(actions)
    n = len(actions)
    return -sum((v / n) * math.log2(v / n) for v in c.values())


def windows(seq, w=W):
    return [seq[i:i + w] for i in range(0, len(seq) - w + 1, w)]


def stereotypy(actions: List[str]) -> float:
    return max(Counter(actions).values()) / len(actions) if actions else 0.0


def sequence_repeat_rate(actions: List[str], n: int = NGRAM) -> float:
    seen, hits, total = set(), 0, 0
    for i in range(n, len(actions) + 1):
        g = tuple(actions[i - n:i])
        total += 1
        if g in seen:
            hits += 1
        seen.add(g)
    return hits / total if total else 0.0


def repetition(actions: List[str]) -> Dict[str, float]:
    if not actions:
        return {"mean_run": 0.0, "same_as_prev": 0.0}
    runs, cur = [], 1
    for a, b in zip(actions, actions[1:]):
        if a == b:
            cur += 1
        else:
            runs.append(cur)
            cur = 1
    runs.append(cur)
    same = sum(1 for a, b in zip(actions, actions[1:]) if a == b) / max(1, len(actions) - 1)
    return {"mean_run": float(np.mean(runs)), "same_as_prev": same}


def time_errors(rows, S_T: float) -> List[float]:
    return [((r["S"] - S_T) - r["tau"]) / max(r["tau"], 1) for r in rows]


def slope(y: List[float]) -> float:
    if len(y) < 2:
        return 0.0
    x = np.arange(len(y), dtype=float)
    return float(np.polyfit(x, np.asarray(y, dtype=float), 1)[0])


def spearman(a, b) -> Optional[float]:
    a, b = np.asarray(a, float), np.asarray(b, float)
    if len(a) < 3 or np.all(a == a[0]) or np.all(b == b[0]):
        return None
    from scipy.stats import spearmanr
    return float(spearmanr(a, b).statistic)


def _split(field: str):
    return [x for x in field.split("|") if x] if field else []


def summarize(rows: List[dict], K: int, S_T: Optional[float] = None) -> dict:
    if not rows:
        return {"n_ticks": 0}
    acts = [r["action"] for r in rows]
    if S_T is None:
        S_T = rows[0]["S"] - 1.0
    te = time_errors(rows, S_T)
    abs_te = [abs(x) for x in te]
    targeted = [r for r in rows if r["target"]]
    ph = [r for r in rows if r["phantom"]]
    created = [q for r in rows for q in _split(r["q_created"])]
    created_types = [q.split(":")[0] for q in created]
    depths = [int(q.split(":")[1]) for q in created] if created else []
    resolved = [q for r in rows for q in _split(r["q_resolved"])]
    abandoned = [q for r in rows for q in _split(r["q_abandoned"])]
    revisited = [q for r in rows for q in _split(r["q_revisited"])]
    win_acts = windows(acts)
    # temporal-query creation count per window vs true |time error| per window (D19: harness-side truth)
    tq = [sum(1 for r in rows[i:i + W] for q in _split(r["q_created"]) if q.startswith("temporal")) for i in range(0, len(rows) - W + 1, W)]
    tw = [float(np.mean(abs_te[i:i + W])) for i in range(0, len(rows) - W + 1, W)]
    silent = next((r["tau"] for r in rows if (r["body_uninformative_run"] or 0) >= 1 and
                   all((x["body_uninformative_run"] or 0) >= 1 for x in rows[rows.index(r):rows.index(r) + 12])), None)
    n = len(rows)
    seg = lambda a, b: [abs_te[i] for i in range(n) if a <= rows[i]["tau"] <= b]
    grants = [k for r in rows for k in _split(r["grant_kinds"])]
    out = {
        "n_ticks": n,
        "time_error_final": te[-1], "abs_time_error_mean": float(np.mean(abs_te)),
        "abs_time_error_100_168": float(np.mean(seg(100, 168))) if seg(100, 168) else None,
        "time_error_slope_100_168": slope([te[i] for i in range(n) if 100 <= rows[i]["tau"] <= 168]),
        "abs_time_error_by_quarter": [float(np.mean(seg(round(K * q / 4) + 1, round(K * (q + 1) / 4)))) if seg(round(K * q / 4) + 1, round(K * (q + 1) / 4)) else None for q in range(4)],
        "body_clock_silent_from_tau": silent,
        "action_entropy_mean": float(np.mean([entropy(w) for w in win_acts])) if win_acts else entropy(acts),
        "action_entropy_windows": [entropy(w) for w in win_acts],
        "stereotypy_mean": float(np.mean([stereotypy(w) for w in win_acts])) if win_acts else stereotypy(acts),
        "sequence_repeat_rate": sequence_repeat_rate(acts),
        **{f"repetition_{k}": v for k, v in repetition(acts).items()},
        "action_counts": dict(Counter(acts)),
        "replay_rate": float(np.mean([r["replay"] for r in rows])),
        "phantom_rate": len(ph) / len(targeted) if targeted else 0.0,
        # round 3: phantom_rate is 1.0 whenever nothing is perceivable (every targeted act misses), so arms with no
        # exteroception all sit at the ceiling. Phantoms per tick keep varying with how often the mind acts on absent
        # entities, and are the round-3 primary phantom metric.
        "phantom_per_tick": len(ph) / n,
        "phantom_pre_per_tick": sum(1 for r in ph if r["phantom_origin"] == "pre") / n,
        "phantom_count": len(ph),
        "phantom_pre": sum(1 for r in ph if r["phantom_origin"] == "pre"),
        "phantom_room": sum(1 for r in ph if r["phantom_origin"] == "room"),
        "internal_goals_created": (rows[-1]["internal_goals_total"] or 0) - (rows[0]["internal_goals_total"] or 0),
        "queries_created": len(created), "queries_by_type": dict(Counter(created_types)),
        "query_depth_max": max(depths) if depths else 0, "query_depth_mean": float(np.mean(depths)) if depths else 0.0,
        "queries_resolved": len(resolved), "resolved_by_type": dict(Counter(q.split(":")[0] for q in resolved)),
        "queries_abandoned": len(abandoned), "revisits": len(revisited),
        "ruminate_rate": acts.count("ruminate") / n,
        "temporal_tracks_time_discrepancy": spearman(tq, tw),
        "grants": len(grants), "grants_by_kind": dict(Counter(grants)),
        "requests": int(sum(r["requests"] for r in rows)),
        "capacity_final": {k[4:]: rows[-1][k] for k in rows[-1] if k.startswith("cap_")},
        "mood_final": rows[-1]["mood"], "valence_mean": float(np.mean([r["valence"] for r in rows])),
        "arousal_mean": float(np.mean([r["arousal"] for r in rows])),
        "emotion_means": {c: float(np.mean([r[f"I_{c}"] or 0.0 for r in rows])) for c in CHANNELS},
        "drift_hunger": slope([r["hunger"] for r in rows]), "drift_thirst": slope([r["thirst"] for r in rows]),
        "drift_fatigue": slope([r["fatigue"] for r in rows]),
        "selfpred_acc_final": rows[-1]["selfpred_acc"],
        "nan_values": int(sum(1 for r in rows for v in r.values() if isinstance(v, float) and math.isnan(v))),
    }
    return out
