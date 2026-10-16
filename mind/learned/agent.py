"""Learned mind v2 (SPEC K, D.6).

Subclasses the rule-based mind so the SAME scripted affect core, clocks,
reflection module, self-model bookkeeping and capacity request rule are used
(Q18). Overridden: prediction error and novelty (world model), self-prediction
(self-model head), decision (policy logits + scripted reflection bonus), and
learning (replay + optional imagination). The reflection generator stays
SCRIPTED BY DESIGN; only its input signals are learned.

No file I/O here (no-route rule): tensors come in and go out as dicts.
"""
from __future__ import annotations

import math
import random
from typing import Dict, Optional

import numpy as np
import torch
import torch.nn.functional as F

from mind.channel import CapacityChannel
from mind.features import features as feature_vector
from mind.learned import params as P
from mind.learned.model import WorldModel
from mind.learned.replay import ReplayBuffer
from mind.rng import stable_seed
from mind.rulebased.mind import RuleBasedMind
from mind.types import ACTION_KINDS, ActionKind, CapacityKind as K, ReasonCode as R

ACTION_INDEX = {k: i for i, k in enumerate(ACTION_KINDS)}
VERSION = "learned/1"


def _setup_torch():
    torch.set_num_threads(1)
    torch.use_deterministic_algorithms(True)


class V2Capacity:
    kinds = (K.WIDEN_HIDDEN, K.ENLARGE_LATENT, K.ADD_EXPERT, K.DEEPEN, K.REFLECTION_WORKING_SET)

    def __init__(self, mind: "LearnedMind"):
        self._m = mind

    def size(self, kind):
        md = self._m.model
        return float({K.WIDEN_HIDDEN: md.H, K.ENLARGE_LATENT: md.Z, K.ADD_EXPERT: md.E, K.DEEPEN: md.dec_depth,
                      K.REFLECTION_WORKING_SET: self._m.reflection.working_set}[kind])

    def grow(self, kind, step):
        if kind is K.REFLECTION_WORKING_SET:
            self._m.reflection.working_set += step
        else:
            raise KeyError("network growth goes through growth.ops_v2")


def _deficit(f: torch.Tensor) -> torch.Tensor:
    # need deficit from decoded/observed interoception features (dims 52..56)
    return f[..., 52:57].mean(-1)


class LearnedMind(RuleBasedMind):
    version = VERSION
    family_kinds = {
        R.PREDICTION_ERROR: (K.WIDEN_HIDDEN, K.ENLARGE_LATENT),
        R.BOREDOM: (K.ADD_EXPERT, K.DEEPEN),
        R.REFLECTIVE_BACKLOG: (K.REFLECTION_WORKING_SET,),
    }
    request_pe_threshold = 1.25

    # ---- construction ------------------------------------------------------
    def init_learned(self, model: WorldModel, buffer: ReplayBuffer, seed: int, learning: str,
                     nll_baseline: float):
        _setup_torch()
        self.model = model
        self.buffer = buffer
        self.learning = learning or "replay_plus_imagination"
        self.nll_baseline = max(1e-6, float(nll_baseline))
        self.train_gen = torch.Generator().manual_seed(stable_seed(seed, "v2_train"))
        self.growth_gen = torch.Generator().manual_seed(stable_seed(seed, "v2_growth"))
        self.growth_rng = random.Random(stable_seed(seed, "v2_growth_units"))
        self.replay_rng = random.Random(stable_seed(seed, "v2_replay"))
        self._make_optimizers()
        self.h = torch.zeros(1, model.H)
        self.z = torch.zeros(1, model.Z)
        self.a_prev = torch.zeros(1, P.ACT)
        self.f_prev = torch.zeros(1, P.FEAT)
        self.last_nll = self.nll_baseline
        self.last_ratio = 1.0
        self.prev_wm_loss = None
        self.v2_pred_action = None
        self.v2_selfpred_hits = []
        self.loss_log = []
        self.room_segment = 1000
        self.learning_enabled = True

    def _make_optimizers(self):
        wm, ac = self._param_groups()
        self.opt_wm = torch.optim.Adam(wm, lr=P.LR_WM, betas=P.BETAS, eps=P.EPS)
        self.opt_ac = torch.optim.Adam(ac, lr=P.LR_AC, betas=P.BETAS, eps=P.EPS)

    def _param_groups(self):
        ac_ids = {id(p) for p in list(self.model.pi.parameters()) + list(self.model.v.parameters())}
        wm = [p for p in self.model.parameters() if id(p) not in ac_ids]
        ac = [p for p in self.model.parameters() if id(p) in ac_ids]
        return wm, ac

    def param_count(self) -> int:
        return self.model.param_count()

    def capacity_handles(self):
        return V2Capacity(self)

    # ---- growth hook (called by growth.ops_v2 after surgery) ----------------
    def after_growth(self, kind, transfer: dict, info: dict):
        old_states = {}
        for opt in (self.opt_wm, self.opt_ac):
            for p, st in opt.state.items():
                old_states[id(p)] = st
        self._make_optimizers()
        for opt in (self.opt_wm, self.opt_ac):
            for group in opt.param_groups:
                for p in group["params"]:
                    if id(p) in old_states:                      # untouched parameter: same tensor
                        opt.state[p] = old_states[id(p)]
                    elif id(p) in transfer:                       # rebuilt: copy original slices, zeros elsewhere
                        old_p, rows, cols = transfer[id(p)]
                        st_old = old_states.get(id(old_p))
                        if st_old is None:
                            continue
                        st = {"step": st_old["step"].clone() if torch.is_tensor(st_old["step"]) else st_old["step"],
                              "exp_avg": torch.zeros_like(p.data), "exp_avg_sq": torch.zeros_like(p.data)}
                        for key in ("exp_avg", "exp_avg_sq"):
                            src = st_old[key]
                            if cols is None:
                                ni = torch.tensor([i for i, _ in rows])
                                oi = torch.tensor([r for _, r in rows])
                                st[key][ni] = src[oi]
                            else:
                                ni = torch.tensor([i for i, _ in rows]).unsqueeze(1)
                                oi = torch.tensor([r for _, r in rows]).unsqueeze(1)
                                nj = torch.tensor([j for j, _ in cols]).unsqueeze(0)
                                oj = torch.tensor([c for _, c in cols]).unsqueeze(0)
                                st[key][ni, nj] = src[oi, oj]
                        opt.state[p] = st
        if kind is K.WIDEN_HIDDEN:
            src = info.get("h_src")
            extra = self.model.H - self.h.shape[1]
            self.h = torch.cat([self.h, self.h[:, src] if src else torch.zeros(1, extra)], -1)
        if kind is K.ENLARGE_LATENT:
            self.z = torch.cat([self.z, torch.zeros(1, self.model.Z - self.z.shape[1])], -1)

    # ---- perception (overrides v1 PE / novelty) ----------------------------
    def observe(self, obs, intero):
        f = feature_vector(obs, intero)
        ft = torch.tensor(f, dtype=torch.float32).unsqueeze(0)
        with torch.no_grad():
            h = self.model.dyn(self.h, self.z, self.a_prev)
            pm, _ = self.model.prior(h)
            pred = self.model.predict(h, pm, self.f_prev)
            nll = float(((pred - ft) ** 2).mean())
            qm, _ = self.model.posterior(h, self.model.enc(ft))
            self.h, self.z = h, qm
            self.f_prev = ft
            _, _, sa = self.model.self_model(h, qm)
            self.v2_pred_action = ACTION_KINDS[int(sa[0, :len(ACTION_KINDS)].argmax())].value
        self.last_nll = nll
        self.last_ratio = nll / self.nll_baseline
        self._cur_f = f
        action = super().observe(obs, intero)
        # self-prediction accuracy of the learned self-model head (SD1, v2)
        self.v2_selfpred_hits = (self.v2_selfpred_hits + [int(self.v2_pred_action == action.kind.value)])[-24:]
        self.a_prev = F.one_hot(torch.tensor([ACTION_INDEX[action.kind]]), P.ACT).float()
        self.buffer.add(f, ACTION_INDEX[action.kind], "room", self.room_segment)
        if self.learning_enabled:
            self._learn()
        self.last_log.update(nll=nll, nll_ratio=self.last_ratio,
                             v2_selfpred_acc=sum(self.v2_selfpred_hits) / len(self.v2_selfpred_hits))
        return action

    def _prediction(self, o):
        pe = min(1.0, max(0.0, self.last_ratio - 1.0))
        sig = "".join("1" if v > 0 else "0" for v in self.z[0, :8].tolist())
        for k in list(self.familiarity):
            self.familiarity[k] *= 0.99
            if self.familiarity[k] < 1e-3:
                del self.familiarity[k]
        count = self.familiarity.get(sig, 0.0)
        self.familiarity[sig] = count + 1.0
        return pe, math.exp(-count / 3.0)

    def _predict_self_action(self, state_bin):
        return self.v2_pred_action

    def _request_pe_signal(self, pe):
        return self.last_ratio

    # ---- decision ----------------------------------------------------------
    def _utilities(self, obs, intero, agents):
        refl = torch.tensor([self.reflection.summary_vector()], dtype=torch.float32)
        with torch.no_grad():
            logits = self.model.policy_logits(self.h, self.z, refl)[0, :len(ACTION_KINDS)].tolist()
        u = {k: logits[i] / P.POLICY_TEMPERATURE for i, k in enumerate(ACTION_KINDS)}
        for k, bonus in self.reflection.action_utility().items():     # scripted logit bonus (D18)
            u[k] += P.REFLECTION_LOGIT_BETA * bonus
        return u

    def _softmax_choice(self, u):
        kinds = list(u)
        vals = np.array([u[k] for k in kinds], dtype=np.float64)
        p = np.exp(vals - vals.max())
        p /= p.sum()
        r, acc = self.rng.random(), 0.0
        for k, pk in zip(kinds, p):
            acc += pk
            if r < acc:
                return k
        return kinds[-1]

    # ---- learning ----------------------------------------------------------
    def _wm_batch_loss(self, f, a):
        B, L, _ = f.shape
        h = torch.zeros(B, self.model.H)
        z = torch.zeros(B, self.model.Z)
        a_prev = torch.zeros(B, P.ACT)
        emb = self.model.enc(f)
        rec, kl, hs, zs = 0.0, 0.0, [], []
        for t in range(L):
            h = self.model.dyn(h, z, a_prev)
            pm, ps = self.model.prior(h)
            qm, qs = self.model.posterior(h, emb[:, t])
            eps = torch.randn(qm.shape, generator=self.train_gen)
            z = qm + qs * eps
            x_prev = f[:, t - 1] if t > 0 else torch.zeros_like(f[:, 0])
            rec = rec + ((self.model.predict(h, z, x_prev) - f[:, t]) ** 2).mean()
            kl_t = (torch.log(ps / qs) + (qs ** 2 + (qm - pm) ** 2) / (2 * ps ** 2) - 0.5).sum(-1).mean()
            kl = kl + torch.clamp(kl_t, min=P.FREE_NATS)
            hs.append(h)
            zs.append(z)
            a_prev = F.one_hot(a[:, t], P.ACT).float()
        selfl = 0.0
        for t in range(L - 1):
            sh, sz, sa = self.model.self_model(hs[t], zs[t])
            selfl = selfl + F.mse_loss(sh, hs[t + 1].detach()) + F.mse_loss(sz, zs[t + 1].detach()) + \
                F.cross_entropy(sa, a[:, t])
        loss = (rec + P.KL_WEIGHT * kl + P.SELF_WEIGHT * selfl) / L
        return loss, torch.stack(hs, 1).detach(), torch.stack(zs, 1).detach(), float(kl.detach()) / L

    def _lambda_returns(self, r, v, v_last):
        R_ = torch.zeros_like(r)
        nxt = v_last
        for t in reversed(range(r.shape[1])):
            nxt = r[:, t] + P.GAMMA * ((1 - P.LAMBDA) * (v[:, t + 1] if t + 1 < v.shape[1] else v_last) + P.LAMBDA * nxt)
            R_[:, t] = nxt
        return R_

    def _ac_imagination(self, h0, z0, x0=None):
        refl = torch.zeros(h0.shape[0], P.REFL)
        hs, zs, logps, ents, rs = [h0], [z0], [], [], []
        h, z = h0, z0
        with torch.no_grad():
            x = x0 if (self.model.residual and x0 is not None) else self.model.decode(h, z)
            d0 = _deficit(x)
        for _ in range(P.IMAG_HORIZON):
            logits = self.model.policy_logits(h, z, refl)
            dist = torch.distributions.Categorical(logits=logits)
            a = torch.multinomial(F.softmax(logits.detach(), -1), 1, generator=self.train_gen).squeeze(-1)
            logps.append(dist.log_prob(a))
            ents.append(dist.entropy())
            with torch.no_grad():
                h = self.model.dyn(h, z, F.one_hot(a, P.ACT).float())
                z, _ = self.model.prior(h)
                x = self.model.predict(h, z, x)
                d1 = _deficit(x)
            rs.append(-(d1 - d0))
            d0 = d1
            hs.append(h)
            zs.append(z)
        H_ = torch.stack(hs, 1)
        Z_ = torch.stack(zs, 1)
        v = self.model.value(H_, Z_)
        r = torch.stack(rs, 1)
        with torch.no_grad():
            R_ = self._lambda_returns(r, v[:, 1:].detach(), v[:, -1].detach())
        adv = (R_ - v[:, :-1]).detach()
        actor = -(torch.stack(logps, 1) * adv).mean() - P.ENTROPY * torch.stack(ents, 1).mean()
        critic = F.mse_loss(v[:, :-1], R_)
        return actor + critic

    def _ac_replay(self, hs, zs, f, a, lp):
        refl = torch.zeros(hs.shape[0], hs.shape[1], P.REFL)
        logits = self.model.policy_logits(hs, zs, refl)
        dist = torch.distributions.Categorical(logits=logits)
        v = self.model.value(hs, zs)
        d = _deficit(f)
        r = torch.zeros_like(d)
        r[:, :-1] = -(d[:, 1:] - d[:, :-1]) + P.LP_WEIGHT * lp
        with torch.no_grad():
            R_ = self._lambda_returns(r[:, :-1], v[:, 1:].detach(), v[:, -1].detach())
        adv = (R_ - v[:, :-1]).detach()
        actor = -(dist.log_prob(a)[:, :-1] * adv).mean() - P.ENTROPY * dist.entropy().mean()
        critic = F.mse_loss(v[:, :-1], R_)
        return actor + critic

    def _learn(self):
        if len(self.buffer.valid_starts(P.SEQ)) == 0:
            return
        hs = zs = fb = ab = None
        lp = 0.0
        for _ in range(P.WM_UPDATES_PER_TICK):
            fn, an, _ = self.buffer.sample(self.replay_rng, P.BATCH, P.SEQ)
            fb, ab = torch.tensor(fn), torch.tensor(an)
            loss, hs, zs, kl = self._wm_batch_loss(fb, ab)
            self.opt_wm.zero_grad()
            loss.backward()
            torch.nn.utils.clip_grad_norm_([p for g in self.opt_wm.param_groups for p in g["params"]], P.GRAD_CLIP)
            self.opt_wm.step()
            lv = float(loss.detach())
            if self.prev_wm_loss is not None:
                lp = max(0.0, self.prev_wm_loss - lv)
            self.prev_wm_loss = lv
        if self.learning == "replay_plus_imagination":
            ac_loss = self._ac_imagination(hs[:, -1], zs[:, -1], fb[:, -1])
        else:
            ac_loss = self._ac_replay(hs, zs, fb, ab, lp)
        self.opt_ac.zero_grad()
        ac_loss.backward()
        torch.nn.utils.clip_grad_norm_([p for g in self.opt_ac.param_groups for p in g["params"]], P.GRAD_CLIP)
        self.opt_ac.step()
        with torch.no_grad():
            lat = zs.reshape(-1, zs.shape[-1])
            c = torch.cov(lat.T) if lat.shape[0] > 1 else torch.zeros(1, 1)
            ev = torch.linalg.eigvalsh(c).clamp(min=0)
            eff_rank = float(torch.exp(-(ev / ev.sum().clamp(min=1e-12) * torch.log((ev / ev.sum().clamp(min=1e-12)).clamp(min=1e-12))).sum()))
        acl = float(ac_loss.detach())
        self.loss_log.append({"wm": self.prev_wm_loss, "ac": acl, "kl": kl, "eff_rank": eff_rank})
        self.last_log.update(wm_loss=self.prev_wm_loss, ac_loss=acl, kl=kl, latent_eff_rank=eff_rank)

    # ---- state -------------------------------------------------------------
    def export_tensors(self) -> Dict[str, torch.Tensor]:
        out = {f"model.{k}": v.detach().clone() for k, v in self.model.state_dict().items()}
        names = {id(p): n for n, p in self.model.named_parameters()}
        for tag, opt in (("wm", self.opt_wm), ("ac", self.opt_ac)):
            for p, st in opt.state.items():
                n = names[id(p)]
                out[f"opt.{tag}.{n}.exp_avg"] = st["exp_avg"].clone()
                out[f"opt.{tag}.{n}.exp_avg_sq"] = st["exp_avg_sq"].clone()
                out[f"opt.{tag}.{n}.step"] = torch.as_tensor(st["step"]).clone().reshape(1)
        out["state.h"], out["state.z"], out["state.a_prev"] = self.h.clone(), self.z.clone(), self.a_prev.clone()
        out["state.f_prev"] = self.f_prev.clone()
        out["buffer.feats"] = torch.tensor(self.buffer.feats_array())
        out["gen.train"] = self.train_gen.get_state().clone()
        out["gen.growth"] = self.growth_gen.get_state().clone()
        return out

    def export_state(self) -> dict:
        s = super().export_state()
        s["version"] = VERSION
        from mind.rng import random_state_to_json
        s["v2"] = {"arch": self.model.arch(), "learning": self.learning, "nll_baseline": self.nll_baseline,
                   "buffer": self.buffer.to_json(), "last_nll": self.last_nll, "prev_wm_loss": self.prev_wm_loss,
                   "v2_selfpred_hits": self.v2_selfpred_hits, "room_segment": self.room_segment,
                   "growth_rng": random_state_to_json(self.growth_rng),
                   "replay_rng": random_state_to_json(self.replay_rng)}
        return s

    @classmethod
    def from_parts(cls, state: dict, tensors: Dict[str, torch.Tensor], channel: Optional[CapacityChannel] = None,
                   learning: Optional[str] = None) -> "LearnedMind":
        from mind.rng import random_state_from_json
        _setup_torch()
        base = RuleBasedMind.from_state({**state, "version": "rulebased/1"}, channel)
        m = cls.__new__(cls)
        m.__dict__.update(base.__dict__)
        v2 = state["v2"]
        arch = v2["arch"]
        model = WorldModel(arch["H"], arch["Z"], arch["E"], arch["dec_depth"], arch.get("expert_hidden"),
                           arch.get("residual", False), arch.get("bounded", False))
        model.load_state_dict({k[len("model."):]: v for k, v in tensors.items() if k.startswith("model.")})
        buf = ReplayBuffer.from_parts(v2["buffer"], tensors["buffer.feats"].numpy())
        m.init_learned(model, buf, 0, learning or v2["learning"], v2["nll_baseline"])
        m.train_gen.set_state(tensors["gen.train"])
        m.growth_gen.set_state(tensors["gen.growth"])
        m.growth_rng = random_state_from_json(v2["growth_rng"])
        m.replay_rng = random_state_from_json(v2["replay_rng"])
        names = dict(m.model.named_parameters())
        for tag, opt in (("wm", m.opt_wm), ("ac", m.opt_ac)):
            for n, p in names.items():
                key = f"opt.{tag}.{n}.exp_avg"
                if key in tensors:
                    step = tensors[f"opt.{tag}.{n}.step"].reshape(())
                    opt.state[p] = {"step": step.clone(), "exp_avg": tensors[key].clone(),
                                    "exp_avg_sq": tensors[f"opt.{tag}.{n}.exp_avg_sq"].clone()}
        m.h, m.z, m.a_prev = tensors["state.h"].clone(), tensors["state.z"].clone(), tensors["state.a_prev"].clone()
        if "state.f_prev" in tensors:
            m.f_prev = tensors["state.f_prev"].clone()
        m.last_nll, m.prev_wm_loss = v2["last_nll"], v2["prev_wm_loss"]
        m.v2_selfpred_hits = list(v2["v2_selfpred_hits"])
        m.room_segment = v2["room_segment"]
        return m
