"""Round 2, Change 4: v2 pre-training on pooled pre-T agent streams, held-out baseline gate, NLL baseline.

Per seed (independent): world model trained on the pre-T egocentric streams of all agents except the focal
agent and held-out agents 0001-0003, plus the focal life; policy behaviour-cloned on the focal agent's (v1
mind's) actions; value fitted. Then the pre-registered gate (DECISIONS_ROUND2.md) is evaluated on held-out
streams with the battery-F1 procedure, and the out-of-sample NLL baseline is computed.

    CIVSYS_ROUND=2 python -m experiments.pretrain_v2_r2 --seeds 42 --attempt 1 --wm 6000
"""
import argparse
import copy
import csv
import json
import time
from collections import defaultdict
from pathlib import Path

import numpy as np
import torch
import torch.nn.functional as F
from safetensors.torch import save_file

from experiments.common import SEEDS, life_dir
from mind.handoff import add_sidecar, dump, load
from mind.learned import params as P
from mind.learned.agent import ACTION_INDEX, LearnedMind
from mind.learned.model import WorldModel
from mind.learned.replay import ReplayBuffer
from mind.rulebased import RuleBasedMind
from mind.types import ActionKind

FEATS = [f"f{i}" for i in range(P.FEAT)]


def _rows(path):
    with open(path, newline="", encoding="utf-8") as fh:
        return list(csv.DictReader(fh))


def _arrays(rows):
    X = np.array([[float(r[c]) for c in FEATS] for r in rows], dtype=np.float32)
    A = np.array([ACTION_INDEX[ActionKind(r["action"])] for r in rows], dtype=np.int64)
    return X, A


def load_streams(d: Path):
    """Focal life rows inside P.HELDOUT_LIFE_TICKS (the battery's held-out window) are dropped; once T > 600 they
    would otherwise be in training. Training on the focal life uses the rows before and after that window."""
    lo, hi = P.HELDOUT_LIFE_TICKS
    kept = [r for r in sorted(_rows(d / "life.csv"), key=lambda r: int(r["tick"])) if not lo <= int(r["tick"]) <= hi]
    # segment ids keep replay sequences from bridging the gap: 0 before the window, -1 after it
    focal = _arrays(kept) + (np.array([0 if int(r["tick"]) < lo else -1 for r in kept], dtype=np.int64),)
    by_agent = defaultdict(list)
    for r in _rows(d / "train_agents.csv"):
        by_agent[r["agent"]].append(r)
    train = [_arrays(sorted(v, key=lambda r: int(r["tick"]))) for _, v in sorted(by_agent.items())]
    held = [_arrays(_rows(p)) for p in sorted(d.glob("heldout_agent_*.csv"))]
    return focal, [t for t in train if len(t[0]) >= P.SEQ + 1], [h for h in held if len(h[0]) >= 30]


@torch.no_grad()
def one_step_errors(model, X, A):
    """Battery-F1 procedure: filter from a zero state; model error predicting x_t, persistence error x_{t-1}."""
    h = torch.zeros(1, model.H)
    z = torch.zeros(1, model.Z)
    a = torch.zeros(1, P.ACT)
    x_prev = torch.zeros(1, X.shape[1])
    m_err = []
    for t in range(len(X)):
        h = model.dyn(h, z, a)
        pm, _ = model.prior(h)
        if t > 0:
            m_err.append(float(((model.predict(h, pm, x_prev)[0].numpy() - X[t]) ** 2).mean()))
        z, _ = model.posterior(h, model.enc(torch.tensor(X[t:t + 1])))
        x_prev = torch.tensor(X[t:t + 1])
        a = F.one_hot(torch.tensor([int(A[t])]), P.ACT).float()
    p_err = list(((X[1:] - X[:-1]) ** 2).mean(1))
    return m_err, p_err


GUARD_EVERY, GUARD_MAX_LOSS = 250, 100.0


def pretrain_seed(seed: int, attempt: int, wm_updates: int, bc_updates: int = P.PRETRAIN_BC, seq: int = P.SEQ,
                  residual: bool = False, guard: bool = False, bounded: bool = False) -> dict:
    """guard (round 3, attempt 2): snapshot the world model and optimiser every GUARD_EVERY updates; if a batch loss
    is non-finite or above GUARD_MAX_LOSS, roll back to the last snapshot and continue (round-3 attempt 1 diverged
    in 2 of 5 seeds: latent means ran away and the KL reached ~3e24). Rollbacks are counted and logged."""
    d = life_dir(seed)
    h = load(d)
    t0 = time.time()
    (fX, fA, fSeg), train, held = load_streams(d)
    pre = ReplayBuffer(capacity=10 ** 7)
    for f, a, g in zip(fX, fA, fSeg):
        pre.add(f, a, "life_focal", int(g))
    for i, (X, A) in enumerate(train, start=1):
        for f, a in zip(X, A):
            pre.add(f, a, "life_other", i)
    focal_buf = ReplayBuffer(capacity=10 ** 6)
    for f, a, g in zip(fX, fA, fSeg):
        focal_buf.add(f, a, "life_focal", int(g))
    base = RuleBasedMind.from_state(json.loads(json.dumps(h.minds["v1"])))
    m = LearnedMind.__new__(LearnedMind)
    m.__dict__.update(base.__dict__)
    torch.manual_seed(seed)
    m.init_learned(WorldModel(residual=residual, bounded=bounded), pre, seed, "replay_plus_imagination", 1.0)
    log, rollbacks, good = [], [], None
    for i in range(wm_updates):
        fn, an, _ = pre.sample(m.replay_rng, P.BATCH, seq)
        loss, _, _, kl = m._wm_batch_loss(torch.tensor(fn), torch.tensor(an))
        if guard:
            if not (torch.isfinite(loss) and float(loss) < GUARD_MAX_LOSS) and good is not None:
                m.model.load_state_dict(good[0])
                m.opt_wm.load_state_dict(good[1])
                rollbacks.append({"update": i, "to": good[2], "loss": float(loss.detach())})
                print(json.dumps({"seed": seed, "rollback": rollbacks[-1]}), flush=True)
                continue
            if good is None or i % GUARD_EVERY == 0:   # only weights that just produced an acceptable loss are kept
                good = (copy.deepcopy(m.model.state_dict()), copy.deepcopy(m.opt_wm.state_dict()), i)
        m.opt_wm.zero_grad()
        loss.backward()
        torch.nn.utils.clip_grad_norm_([p for g in m.opt_wm.param_groups for p in g["params"]], P.GRAD_CLIP)
        m.opt_wm.step()
        if i % 500 == 0 or i == wm_updates - 1:
            log.append({"update": i, "wm_loss": float(loss.detach()), "kl": kl})
            print(json.dumps({"seed": seed, **log[-1], "elapsed_s": round(time.time() - t0, 1)}), flush=True)
    bc_acc = []
    for i in range(bc_updates):
        fn, an, _ = focal_buf.sample(m.replay_rng, P.BATCH, P.SEQ)
        fb, ab = torch.tensor(fn), torch.tensor(an)
        with torch.no_grad():
            _, hs, zs, _ = m._wm_batch_loss(fb, ab)
        logits = m.model.policy_logits(hs, zs, torch.zeros(hs.shape[0], hs.shape[1], P.REFL))
        ce = F.cross_entropy(logits.reshape(-1, P.ACT), ab.reshape(-1))
        v = m.model.value(hs, zs)
        dd = fb[..., 52:57].mean(-1)
        with torch.no_grad():
            R_ = m._lambda_returns(-(dd[:, 1:] - dd[:, :-1]), v[:, 1:].detach(), v[:, -1].detach())
        loss = ce + F.mse_loss(v[:, :-1], R_)
        m.opt_ac.zero_grad()
        loss.backward()
        m.opt_ac.step()
        if i >= bc_updates - 50:
            bc_acc.append(float((logits.argmax(-1) == ab).float().mean()))
    # held-out gate (battery-F1 procedure) and out-of-sample NLL baseline
    m_all, p_all, ratios = [], [], []
    for X, A in held:
        me, pe = one_step_errors(m.model, X, A)
        m_all += me
        p_all += pe
    baseline = float(np.mean(m_all))
    for X, A in held:
        me, _ = one_step_errors(m.model, X, A)
        r = np.array(me) / baseline
        ratios += [float(np.mean(r[i - 24:i])) for i in range(24, len(r) + 1)]
    gate = {"model_mse": baseline, "persistence_mse": float(np.mean(p_all)),
            "ratio_model_to_persistence": baseline / float(np.mean(p_all)), "beats_persistence": baseline < float(np.mean(p_all))}
    # state at T: filter the whole focal life from zero
    with torch.no_grad():
        hh, zz, aa = torch.zeros(1, m.model.H), torch.zeros(1, m.model.Z), torch.zeros(1, P.ACT)
        for f, a in zip(fX, fA):
            hh = m.model.dyn(hh, zz, aa)
            zz, _ = m.model.posterior(hh, m.model.enc(torch.tensor(f).unsqueeze(0)))
            aa = F.one_hot(torch.tensor([int(a)]), P.ACT).float()
    m.h, m.z, m.a_prev = hh, zz, aa
    m.f_prev = torch.tensor(fX[-1:])
    m.nll_baseline = baseline
    m.prev_wm_loss = None
    room = ReplayBuffer(P.BUFFER_CAPACITY)
    for f, a, g in zip(fX, fA, fSeg):
        room.add(f, a, "life", int(g))
    for i, (X, A) in enumerate(train, start=1):
        if len(room) + len(X) > P.BUFFER_CAPACITY:
            break
        for f, a in zip(X, A):
            room.add(f, a, "life", i)
    m.buffer = room
    tensors = {k: v.contiguous() for k, v in m.export_tensors().items()}
    save_file(tensors, str(d / "v2_state.safetensors"))
    (d / "v2_state.json").write_text(json.dumps(m.export_state(), default=str))
    add_sidecar(h, d, "v2_state_tensors", "v2_state.safetensors")
    add_sidecar(h, d, "v2_state_json", "v2_state.json")
    h.minds["v2"] = {"version": "learned/1", "tensors": "v2_state_tensors", "json": "v2_state_json",
                     "params": m.model.param_count(), "nll_baseline_heldout": baseline, "gate": gate,
                     "attempt": attempt, "wm_updates": wm_updates, "pretrain_seq": seq, "residual": residual, "bounded": bounded, "guard": guard, "rollbacks": len(rollbacks), "bc_accuracy": float(np.mean(bc_acc)),
                     "pretrain_log": log, "train_transitions": len(pre)}
    h.meta["mind_versions"]["v2"] = "learned/1"
    dump(h, d)
    info = {"seed": seed, "attempt": attempt, "wm_updates": wm_updates, "pretrain_seq": seq, "seconds": round(time.time() - t0, 1),
            "train_transitions": len(pre), "heldout_sequences": len(held), "gate": gate,
            "bc_accuracy": float(np.mean(bc_acc)), "final_wm_loss": log[-1]["wm_loss"], "heldout_window_ratios": ratios,
            "guard": guard, "bounded": bounded, "rollbacks": rollbacks}
    (d / f"pretrain_r2_attempt{attempt}.json").write_text(json.dumps(info, indent=1))
    return info


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--seeds", type=int, nargs="+", default=SEEDS)
    ap.add_argument("--attempt", type=int, required=True)
    ap.add_argument("--wm", type=int, default=6000)
    ap.add_argument("--seq", type=int, default=P.SEQ)
    ap.add_argument("--residual", action="store_true")
    ap.add_argument("--guard", action="store_true")
    ap.add_argument("--bounded", action="store_true")
    a = ap.parse_args()
    for s in a.seeds:
        r = pretrain_seed(s, a.attempt, a.wm, seq=a.seq, residual=a.residual, guard=a.guard, bounded=a.bounded)
        r.pop("heldout_window_ratios")
        r.pop("rollbacks")
        print(json.dumps(r), flush=True)
