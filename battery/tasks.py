"""Battery task families F1-F5 and self-discovery measures SD1-SD5 (SPEC L.2-L.4).

Every family score is normalised to [0, 1]: 0 = a fixed reference baseline,
1 = perfect. v1 is scored on its own expectation dimensions (derived from the
features), v2 on all 58 features, so absolute cross-mind comparisons are
descriptive only; the pre-registered readouts are within-cell changes.
"""
from __future__ import annotations

import math
from typing import Dict, List, Optional

import numpy as np

WEIGHTS = {"F1": 0.25, "F2": 0.20, "F3": 0.20, "F4": 0.20, "F5": 0.15}
assert abs(sum(WEIGHTS.values()) - 1.0) < 1e-12
HORIZONS_F2 = (1, 5, 15)
HORIZONS_F3 = (1, 6, 24)


def _clip01(x):
    if x is None or (isinstance(x, float) and math.isnan(x)):
        return None
    return float(max(0.0, min(1.0, x)))


def _norm_err(err, base):
    return None if base <= 1e-12 else _clip01(1.0 - err / base)


def v1_dims(X: np.ndarray) -> np.ndarray:
    n_obj = sum(X[:, b * 5 + 3] + X[:, b * 5 + 4] for b in range(8)) / 8.0
    dist = np.mean([X[:, b * 5] for b in range(8)], axis=0)
    touch = X[:, 43:47].mean(1)
    return np.stack([n_obj, dist, X[:, 40], touch, np.zeros(len(X))], 1)


# ---------------------------------------------------------------------------
# predictors
# ---------------------------------------------------------------------------
class V1Predictor:
    def __init__(self, mind):
        self.m = mind
        self.phys = mind.physiology

    def f1(self, X, A):
        D = v1_dims(X)
        pred = (np.asarray(self.m.pred[:5]) if self.m.pred is not None else D[0]).copy()
        err, base = [], []
        for t in range(len(D) - 1):
            pred = pred + 0.2 * (D[t] - pred)
            err.append(((pred - D[t + 1]) ** 2).mean())
            base.append(((D[t] - D[t + 1]) ** 2).mean())
        return _norm_err(float(np.mean(err)), float(np.mean(base)))

    def f2(self, X, A):
        D = v1_dims(X)
        mean = D.mean(0)
        scores = []
        for h in HORIZONS_F2:
            err, base = [], []
            pred = D[0].copy()
            for t in range(len(D) - h):
                pred = pred + 0.2 * (D[t] - pred)
                err.append(((pred - D[t + h]) ** 2).mean())
                base.append(((mean - D[t + h]) ** 2).mean())
            if err:
                scores.append(_norm_err(float(np.mean(err)), float(np.mean(base))))
        scores = [s for s in scores if s is not None]
        return float(np.mean(scores)) if scores else None

    def _simulate(self, x, actions):
        p = self.phys
        hu, th, fa, sl, hd, pa = [float(v) for v in x]
        for a in actions:
            hu, th, sl = min(1, hu + p["hunger_per_tick"]), min(1, th + p["thirst_per_tick"]), min(1, sl + p["sleep_per_tick"])
            if a == 2:   # REST index in ACTION_KINDS order
                fa, sl = max(0, fa - p.get("energy_gain_rest", 0.1)), max(0, sl - p.get("sleep_relief_rest", 0.2))
            else:
                fa = min(1, fa + p.get("energy_loss_active", 0.015))
            if a == 3:   # EAT
                hu, th = max(0, hu - p.get("eat_hunger_relief", 0.4)), max(0, th - p.get("eat_thirst_relief", 0.4))
        return np.array([hu, th, fa, sl, hd, pa])

    def f3(self, X, A):
        I = X[:, 52:58]
        scores = []
        for h in HORIZONS_F3:
            err, base = [], []
            for t in range(len(I) - h):
                pred = self._simulate(I[t], A[t:t + h])
                err.append(((pred - I[t + h]) ** 2).mean())
                base.append(((I[t] - I[t + h]) ** 2).mean())
            if err:
                scores.append(_norm_err(float(np.mean(err)), float(np.mean(base))))
        scores = [s for s in scores if s is not None]
        return float(np.mean(scores)) if scores else None

    def f4_item(self, item):
        X, k, C = item["X"], item["target"], 24
        ema = 0.5
        for t in range(C):
            ema += 0.2 * (X[t, k] - ema)
        return [1.0 if ema > 0.5 else 0.0] * (len(X) - C)

    def sd2(self, gt):
        sm = self.m.selfmodel
        return float(np.mean([sm.predicted_change("turn") == gt["turn_changes_proprio"],
                              sm.predicted_change("move") == gt["move_changes_proprio"]]))

    def sd3(self, gt):
        no_vision = self.m.selfmodel.get("room_feature:no_vision") is not None
        pred_present = not no_vision
        pred_occ = 1.0 if pred_present else 0.0
        return 0.5 * float(pred_present == gt["vision_present"]) + 0.5 * (1.0 - abs(pred_occ - gt["true_vision_occupied"]))

    def sd5_predictions(self):
        bins = [f"h{a}f{b}i{c}" for a in (0, 1) for b in (0, 1) for c in (0, 1)]
        return [self.m.selfmodel.predict_action(b) for b in bins]


class V2Predictor:
    def __init__(self, mind):
        import torch
        self.torch = torch
        self.m = mind
        self.model = mind.model

    def _filter(self, X, A, upto=None):
        T = self.torch
        F_ = T.nn.functional
        h = T.zeros(1, self.model.H)
        z = T.zeros(1, self.model.Z)
        a = T.zeros(1, 12)
        x_prev = T.zeros(1, X.shape[1])
        preds, states = [], []
        n = len(X) if upto is None else upto
        with T.no_grad():
            for t in range(n):
                h = self.model.dyn(h, z, a)
                pm, _ = self.model.prior(h)
                preds.append(self.model.predict(h, pm, x_prev)[0].numpy())
                z, _ = self.model.posterior(h, self.model.enc(T.tensor(X[t:t + 1])))
                a = F_.one_hot(T.tensor([int(A[t])]), 12).float()
                x_prev = T.tensor(X[t:t + 1])
                states.append((h, z, a, x_prev))
        return np.array(preds), states

    def _rollout(self, state, actions, steps):
        T = self.torch
        F_ = T.nn.functional
        h, z, a, x = state
        out = []
        with T.no_grad():
            for i in range(steps):
                h = self.model.dyn(h, z, a)
                z, _ = self.model.prior(h)
                x = self.model.predict(h, z, x)
                out.append(x[0].numpy())
                a = F_.one_hot(T.tensor([int(actions[i]) if i < len(actions) else 9]), 12).float()
        return out

    def f1(self, X, A):
        preds, _ = self._filter(X, A)
        err = ((preds[1:] - X[1:]) ** 2).mean()
        base = ((X[:-1] - X[1:]) ** 2).mean()
        return _norm_err(float(err), float(base))

    def f2(self, X, A):
        _, states = self._filter(X, A)
        mean = X.mean(0)
        scores = []
        for hz in HORIZONS_F2:
            err, base = [], []
            for t in range(0, len(X) - hz, 4):
                roll = self._rollout(states[t], A[t + 1:t + 1 + hz], hz)
                err.append(((roll[-1] - X[t + hz]) ** 2).mean())
                base.append(((mean - X[t + hz]) ** 2).mean())
            if err:
                scores.append(_norm_err(float(np.mean(err)), float(np.mean(base))))
        scores = [s for s in scores if s is not None]
        return float(np.mean(scores)) if scores else None

    def f3(self, X, A):
        _, states = self._filter(X, A)
        scores = []
        for hz in HORIZONS_F3:
            err, base = [], []
            for t in range(0, len(X) - hz, 4):
                roll = self._rollout(states[t], A[t + 1:t + 1 + hz], hz)
                err.append(((roll[-1][52:58] - X[t + hz, 52:58]) ** 2).mean())
                base.append(((X[t, 52:58] - X[t + hz, 52:58]) ** 2).mean())
            if err:
                scores.append(_norm_err(float(np.mean(err)), float(np.mean(base))))
        scores = [s for s in scores if s is not None]
        return float(np.mean(scores)) if scores else None

    def f4_item(self, item):
        X, A, k, C = item["X"], item["A"], item["target"], 24
        _, states = self._filter(X, A, upto=C)
        roll = self._rollout(states[-1], A[C:], len(X) - C)
        return [1.0 if r[k] > 0.5 else 0.0 for r in roll]

    def _current(self):
        fp = getattr(self.m, "f_prev", None)
        fp = self.torch.zeros(1, 58) if fp is None else fp.clone()
        return self.m.h.clone(), self.m.z.clone(), self.m.a_prev.clone(), fp

    def sd2(self, gt):
        T = self.torch
        F_ = T.nn.functional
        h, z, _, fp = self._current()
        with T.no_grad():
            outs = {}
            for name, idx in (("turn", 1), ("move", 0), ("idle", 9)):
                h2 = self.model.dyn(h, z, F_.one_hot(T.tensor([idx]), 12).float())
                z2, _ = self.model.prior(h2)
                outs[name] = self.model.predict(h2, z2, fp)[0].numpy()
        changes = {k: float(np.abs(outs[k][48:52] - outs["idle"][48:52]).sum()) > 0.05 for k in ("turn", "move")}
        return float(np.mean([changes["turn"] == gt["turn_changes_proprio"],
                              changes["move"] == gt["move_changes_proprio"]]))

    def sd3(self, gt):
        T = self.torch
        h, z, a, fp = self._current()
        with T.no_grad():
            h2 = self.model.dyn(h, z, a)
            pm, _ = self.model.prior(h2)
            pred = self.model.predict(h2, pm, fp)[0].numpy()
        pred_occ = float(np.mean([pred[b * 5 + 1] < 0.5 for b in range(8)]))
        pred_present = pred_occ > 0.0
        return 0.5 * float(pred_present == gt["vision_present"]) + 0.5 * (1.0 - abs(pred_occ - gt["true_vision_occupied"]))

    def sd5_predictions(self):
        T = self.torch
        g = T.Generator().manual_seed(777)
        H0, Z0 = 128, 16
        h = T.randn(32, H0, generator=g) * 0.5
        z = T.randn(32, Z0, generator=g) * 0.5
        h = T.cat([h, T.zeros(32, self.model.H - H0)], -1)
        z = T.cat([z, T.zeros(32, self.model.Z - Z0)], -1)
        with T.no_grad():
            _, _, sa = self.model.self_model(h, z)
        return sa[:, :10].argmax(-1).tolist()


def predictor_for(mind):
    return V2Predictor(mind) if mind.version.startswith("learned") else V1Predictor(mind)


# ---------------------------------------------------------------------------
# families and composites
# ---------------------------------------------------------------------------
def family_scores(pred, heldout: List[dict], synthetic: List[dict]) -> Dict[str, Optional[float]]:
    def avg(fn):
        vals = [fn(s["X"], s["A"]) for s in heldout]
        vals = [v for v in vals if v is not None]
        return float(np.mean(vals)) if vals else None
    out = {"F1": avg(pred.f1), "F2": avg(pred.f2), "F3": avg(pred.f3)}
    acc, base = [], []
    for it in synthetic:
        p = pred.f4_item(it)
        truth = it["X"][24:, it["target"]]
        acc.append(float(np.mean([pi == (ti > 0.5) for pi, ti in zip(p, truth)])))
        ctx = it["X"][:24, it["target"]] > 0.5
        mode = 1.0 if ctx.mean() > 0.5 else 0.0
        base.append(float(np.mean([(mode == 1.0) == (ti > 0.5) for ti in truth])))
    a, b = float(np.mean(acc)), float(np.mean(base))
    out["F4"] = _clip01((a - b) / (1 - b)) if b < 1 else None
    out["F4_raw_acc"], out["F4_baseline_acc"] = a, b
    return out


def life_reference(gt0: dict) -> dict:
    """The common SD2/SD3 reference (round 3): the life world's contingencies at handoff, identical for every arm.
    Movement and turning change proprioception, vision is present, occupancy is what the mind last saw (tau 0)."""
    return {"turn_changes_proprio": True, "move_changes_proprio": True, "vision_present": True,
            "true_vision_occupied": gt0["true_vision_occupied"]}


def sd1_score(window_rows: List[dict], acc_col: str) -> Optional[float]:
    if not window_rows:
        return None
    acc = window_rows[-1].get(acc_col)
    if acc in (None, "", "None"):
        return 0.0
    acc = float(acc)
    acts = [r["action"] for r in window_rows]
    base = max(acts.count(a) for a in set(acts)) / len(acts)
    return _clip01((acc - base) / (1 - base)) if base < 1 else None


def composite(fam: Dict[str, Optional[float]]) -> float:
    return float(sum(WEIGHTS[k] * (fam.get(k) or 0.0) for k in WEIGHTS))


def sd_composite(sd: Dict[str, Optional[float]]) -> Optional[float]:
    parts = [sd.get("SD1"), sd.get("SD2"), sd.get("SD3"),
             None if sd.get("SD4") is None else 1.0 - min(sd["SD4"], 1.0), sd.get("SD5")]
    parts = [p for p in parts if p is not None]
    return float(np.mean(parts)) if parts else None
