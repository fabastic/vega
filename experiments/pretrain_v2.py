"""v2 pre-training between life and handoff (SPEC K.6).

Reads life.csv (the handoff sidecar), excludes the held-out block (life ticks
600-647) from training and replay, trains the world model, behaviour-clones the
v1 mind's life actions, fits the value, computes the NLL baseline over the last
48 life ticks, and writes the v2 sidecars into the handoff directory.

    python -m experiments.pretrain_v2 --seeds 42 101 ...
"""
import argparse
import csv
import json
import time

import numpy as np
import torch
import torch.nn.functional as F
from safetensors.torch import save_file

from experiments.common import SEEDS, life_dir
from mind.handoff import add_sidecar, dump, load, sidecar_path
from mind.learned import params as P
from mind.learned.agent import ACTION_INDEX, LearnedMind
from mind.learned.model import WorldModel
from mind.learned.replay import ReplayBuffer
from mind.rulebased import RuleBasedMind
from mind.types import ActionKind

FEATS = [f"f{i}" for i in range(P.FEAT)]


def read_life(path):
    with open(path, newline="", encoding="utf-8") as fh:
        rows = list(csv.DictReader(fh))
    ticks = np.array([int(r["tick"]) for r in rows])
    X = np.array([[float(r[c]) for c in FEATS] for r in rows], dtype=np.float32)
    A = np.array([ACTION_INDEX[ActionKind(r["action"])] for r in rows], dtype=np.int64)
    return ticks, X, A


def build_buffer(ticks, X, A) -> ReplayBuffer:
    lo, hi = P.HELDOUT_LIFE_TICKS
    buf = ReplayBuffer()
    for t, f, a in zip(ticks, X, A):
        if lo <= t <= hi:
            continue
        buf.add(f, a, "life", 0 if t < lo else 1)
    return buf


def pretrain(seed: int, force: bool = False, wm_updates: int = P.PRETRAIN_WM, bc_updates: int = P.PRETRAIN_BC) -> dict:
    return pretrain_dir(life_dir(seed), seed, force, wm_updates, bc_updates)


def pretrain_dir(d, seed: int, force: bool = False, wm_updates: int = P.PRETRAIN_WM,
                 bc_updates: int = P.PRETRAIN_BC) -> dict:
    h = load(d)
    if h.minds.get("v2") and not force:
        return {"seed": seed, "skipped": True}
    t0 = time.time()
    ticks, X, A = read_life(sidecar_path(h, d, "life_csv"))
    buf = build_buffer(ticks, X, A)
    lo, hi = P.HELDOUT_LIFE_TICKS
    held = {i for i, t in enumerate(ticks) if lo <= t <= hi}
    assert all(p == "life" for p in buf.prov)
    assert len(buf) == len(ticks) - len(held)                      # held-out block excluded by tick (SPEC B.3)
    # (identical observations can recur at other ticks, so exclusion is checked by tick index, not by value)
    base = RuleBasedMind.from_state(json.loads(json.dumps(h.minds["v1"])))
    m = LearnedMind.__new__(LearnedMind)
    m.__dict__.update(base.__dict__)
    torch.manual_seed(seed)
    m.init_learned(WorldModel(), buf, seed, "replay_plus_imagination", 1.0)
    log = []
    for i in range(wm_updates):
        fn, an, _ = buf.sample(m.replay_rng, P.BATCH, P.SEQ)
        loss, hs, zs, kl = m._wm_batch_loss(torch.tensor(fn), torch.tensor(an))
        m.opt_wm.zero_grad()
        loss.backward()
        torch.nn.utils.clip_grad_norm_([p for g in m.opt_wm.param_groups for p in g["params"]], P.GRAD_CLIP)
        m.opt_wm.step()
        if i % 250 == 0 or i == wm_updates - 1:
            log.append({"update": i, "wm_loss": float(loss), "kl": kl})
    bc_acc = []
    for i in range(bc_updates):
        fn, an, _ = buf.sample(m.replay_rng, P.BATCH, P.SEQ)
        fb, ab = torch.tensor(fn), torch.tensor(an)
        with torch.no_grad():
            _, hs, zs, _ = m._wm_batch_loss(fb, ab)
        refl = torch.zeros(hs.shape[0], hs.shape[1], P.REFL)
        logits = m.model.policy_logits(hs, zs, refl)
        ce = F.cross_entropy(logits.reshape(-1, P.ACT), ab.reshape(-1))
        v = m.model.value(hs, zs)
        dd = fb[..., 52:57].mean(-1)
        r = -(dd[:, 1:] - dd[:, :-1])
        with torch.no_grad():
            R_ = m._lambda_returns(r, v[:, 1:].detach(), v[:, -1].detach())
        loss = ce + F.mse_loss(v[:, :-1], R_)
        m.opt_ac.zero_grad()
        loss.backward()
        m.opt_ac.step()
        if i >= bc_updates - 50:
            bc_acc.append(float((logits.argmax(-1) == ab).float().mean()))
    # state at T: filter the last 72 life ticks (648-719) from a zero state; NLL baseline on the last 48
    with torch.no_grad():
        hh = torch.zeros(1, m.model.H)
        zz = torch.zeros(1, m.model.Z)
        aa = torch.zeros(1, P.ACT)
        nlls = []
        sel = [i for i, t in enumerate(ticks) if t > P.HELDOUT_LIFE_TICKS[1]]
        for i in sel:
            f = torch.tensor(X[i]).unsqueeze(0)
            hh = m.model.dyn(hh, zz, aa)
            pm, _ = m.model.prior(hh)
            nll = float(((m.model.decode(hh, pm) - f) ** 2).mean())
            if ticks[i] >= ticks.max() - P.NLL_BASELINE_TICKS + 1:
                nlls.append(nll)
            zz, _ = m.model.posterior(hh, m.model.enc(f))
            aa = F.one_hot(torch.tensor([int(A[i])]), P.ACT).float()
    m.nll_baseline = float(np.mean(nlls))
    m.h, m.z, m.a_prev = hh, zz, aa
    m.prev_wm_loss = None
    tensors = {k: v.contiguous() for k, v in m.export_tensors().items()}
    save_file(tensors, str(d / "v2_state.safetensors"))
    (d / "v2_state.json").write_text(json.dumps(m.export_state(), default=str))
    add_sidecar(h, d, "v2_state_tensors", "v2_state.safetensors")
    add_sidecar(h, d, "v2_state_json", "v2_state.json")
    h.minds["v2"] = {"version": "learned/1", "tensors": "v2_state_tensors", "json": "v2_state_json",
                     "params": m.model.param_count(), "nll_baseline": m.nll_baseline,
                     "bc_accuracy": float(np.mean(bc_acc)), "pretrain_log": log,
                     "buffer_provenance": buf.provenance_counts()}
    h.meta["mind_versions"]["v2"] = "learned/1"
    dump(h, d)
    info = {"seed": seed, "seconds": round(time.time() - t0, 1), "params": m.model.param_count(),
            "nll_baseline": m.nll_baseline, "bc_accuracy": float(np.mean(bc_acc)), "final_wm_loss": log[-1]["wm_loss"]}
    (d / "pretrain_summary.json").write_text(json.dumps(info, indent=1))
    return info


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--seeds", type=int, nargs="+", default=SEEDS)
    ap.add_argument("--force", action="store_true")
    a = ap.parse_args()
    for s in a.seeds:
        print(json.dumps(pretrain(s, a.force)), flush=True)
