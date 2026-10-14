"""RSSM-style world model with growable parts (SPEC K.2).

Every growable piece is a plain nn.Linear so growth is row/column surgery with
exact index maps (growth/ops_v2.py). The GRU is written with separate gate
Linears for the same reason. Latent means and stds are separate heads.
"""
from __future__ import annotations

import torch
import torch.nn as nn
import torch.nn.functional as F

from mind.learned import params as P


def _mlp(i, o, depth, h=P.MLPH):
    layers, d = [], i
    for _ in range(depth):
        layers += [nn.Linear(d, h), nn.ReLU()]
        d = h
    layers.append(nn.Linear(d, o))
    return nn.Sequential(*layers)


class WorldModel(nn.Module):
    def __init__(self, H=P.BASE_H, Z=P.BASE_Z, E=P.BASE_E, dec_depth=P.BASE_DEC_DEPTH, expert_hidden=None,
                 residual=False):
        super().__init__()
        self.residual = bool(residual)   # round 2: the decoder predicts the change from the last observation
        self.H, self.Z, self.E, self.dec_depth = H, Z, E, dec_depth
        self.expert_hidden = expert_hidden or H   # fixed at base width; widening H does not change it
        self.enc = _mlp(P.FEAT, P.EMB, 1)
        xin = Z + P.ACT
        self.ir, self.iz, self.inn = nn.Linear(xin, H), nn.Linear(xin, H), nn.Linear(xin, H)
        self.hr, self.hz, self.hn = nn.Linear(H, H), nn.Linear(H, H), nn.Linear(H, H)
        self.experts = nn.ModuleList([_mlp(H, H, 1, self.expert_hidden) for _ in range(E)])
        self.gate = nn.Linear(H, E)
        self.prior_trunk = nn.Sequential(nn.Linear(H, P.MLPH), nn.ReLU())
        self.prior_m, self.prior_s = nn.Linear(P.MLPH, Z), nn.Linear(P.MLPH, Z)
        self.post_trunk = nn.Sequential(nn.Linear(H + P.EMB, P.MLPH), nn.ReLU())
        self.post_m, self.post_s = nn.Linear(P.MLPH, Z), nn.Linear(P.MLPH, Z)
        self.dec = _mlp(H + Z, P.FEAT, dec_depth)
        self.pi = _mlp(H + Z + P.REFL, P.ACT, 1)
        self.v = _mlp(H + Z, 1, 1)
        self.self_trunk = nn.Sequential(nn.Linear(H + Z, P.MLPH), nn.ReLU())
        self.self_h, self.self_z, self.self_a = nn.Linear(P.MLPH, H), nn.Linear(P.MLPH, Z), nn.Linear(P.MLPH, P.ACT)

    # ---- dynamics -----------------------------------------------------------
    def gru(self, x, h):
        r = torch.sigmoid(self.ir(x) + self.hr(h))
        u = torch.sigmoid(self.iz(x) + self.hz(h))
        n = torch.tanh(self.inn(x) + r * self.hn(h))
        return (1 - u) * n + u * h

    def dyn(self, h, z, a):
        h = self.gru(torch.cat([z, a], -1), h)
        g = torch.softmax(self.gate(h), -1)
        d = sum(g[..., k:k + 1] * e(h) for k, e in enumerate(self.experts))
        return h + d

    @staticmethod
    def _std(s):
        return F.softplus(s) + P.MIN_STD

    def prior(self, h):
        t = self.prior_trunk(h)
        return self.prior_m(t), self._std(self.prior_s(t))

    def posterior(self, h, emb):
        t = self.post_trunk(torch.cat([h, emb], -1))
        return self.post_m(t), self._std(self.post_s(t))

    def decode(self, h, z):
        return self.dec(torch.cat([h, z], -1))

    def predict(self, h, z, x_prev):
        """Predicted observation. Residual models add the decoded change to the last observation."""
        out = self.decode(h, z)
        return out + x_prev if self.residual else out

    def policy_logits(self, h, z, refl):
        return self.pi(torch.cat([h, z, refl], -1))

    def value(self, h, z):
        return self.v(torch.cat([h, z], -1)).squeeze(-1)

    def self_model(self, h, z):
        t = self.self_trunk(torch.cat([h, z], -1))
        return self.self_h(t), self.self_z(t), self.self_a(t)

    def param_count(self) -> int:
        return sum(p.numel() for p in self.parameters())

    def arch(self) -> dict:
        return {"H": self.H, "Z": self.Z, "E": self.E, "dec_depth": self.dec_depth, "expert_hidden": self.expert_hidden,
                "residual": self.residual}

    # ---- deterministic probe outputs (function-preservation checks) --------
    @torch.no_grad()
    def probe_outputs(self, probe: dict) -> dict:
        """Deterministic outputs on a fixed probe, restricted to the ORIGINAL output dims."""
        h, z, a, emb_in, refl = probe["h"], probe["z"], probe["a"], probe["f"], probe["refl"]
        H0, Z0 = probe["H0"], probe["Z0"]
        h = _pad(h, self.H, probe.get("h_src"))
        z = _pad(z, self.Z, None)
        out = {}
        hs = []
        for t in range(a.shape[1]):
            h = self.dyn(h, z, a[:, t])
            pm, ps = self.prior(h)
            qm, qs = self.posterior(h, self.enc(emb_in[:, t]))
            z = qm
            hs.append(h[:, :H0])
            out.setdefault("prior_m", []).append(pm[:, :Z0])
            out.setdefault("prior_s", []).append(ps[:, :Z0])
            out.setdefault("post_m", []).append(qm[:, :Z0])
            out.setdefault("dec", []).append(self.decode(h, z))
            out.setdefault("pi", []).append(self.policy_logits(h, z, refl))
            out.setdefault("v", []).append(self.value(h, z))
            sh, sz, sa = self.self_model(h, z)
            out.setdefault("self_h", []).append(sh[:, :H0])
            out.setdefault("self_z", []).append(sz[:, :Z0])
            out.setdefault("self_a", []).append(sa)
        out["h"] = hs
        return {k: torch.stack(v, 1) for k, v in out.items()}


def _pad(x, n, src):
    """Extend a state vector to n dims: duplicated units copy their source (Net2Wider), new latent dims are 0."""
    if x.shape[-1] == n:
        return x
    extra = n - x.shape[-1]
    if src is not None and len(src) >= extra:
        return torch.cat([x, x[:, src[:extra]]], -1)
    return torch.cat([x, torch.zeros(x.shape[0], extra)], -1)


def make_probe(model: WorldModel, seed: int = 1234, batch: int = 16, steps: int = 32) -> dict:
    g = torch.Generator().manual_seed(seed)
    a_idx = torch.randint(0, P.ACT, (batch, steps), generator=g)
    return {"h": torch.randn(batch, model.H, generator=g) * 0.5, "z": torch.randn(batch, model.Z, generator=g) * 0.5,
            "a": F.one_hot(a_idx, P.ACT).float(), "f": torch.rand(batch, steps, P.FEAT, generator=g),
            "refl": torch.rand(batch, P.REFL, generator=g), "H0": model.H, "Z0": model.Z}
