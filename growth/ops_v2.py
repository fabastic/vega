"""Function-preserving growth operations for the learned mind (SPEC I.4), and random-init variants.

All operations are pure tensor surgery on nn.Linear layers via explicit row/column maps.
New units are appended (after the old ones) inside each logical block, so "original"
slices keep their optimizer moments and new parameters start at zero moments.
"""
from __future__ import annotations

import copy
import math
import random
from typing import Dict, List, Optional, Tuple

import torch
import torch.nn as nn

from mind.learned import params as P
from mind.learned.model import WorldModel, make_probe
from mind.types import CapacityKind as K

SYMMETRY_NOISE = 1e-4
# Layers the operations may replace. Lookups go through this allowlist, never dynamic getattr/setattr.
_LAYER_NAMES = frozenset({"ir", "iz", "inn", "hr", "hz", "hn", "gate", "prior_m", "prior_s", "post_m", "post_s",
                          "self_h", "self_z", "self_a", "0", "2"})


def _get_layer(owner: nn.Module, name: str) -> nn.Linear:
    if name not in _LAYER_NAMES:
        raise KeyError(name)
    return owner._modules[name]


def _set_layer(owner: nn.Module, name: str, layer: nn.Linear) -> None:
    if name not in _LAYER_NAMES:
        raise KeyError(name)
    owner._modules[name] = layer
STD_BIAS_UNIT = math.log(math.expm1(1.0 - P.MIN_STD))   # softplus(b) + MIN_STD == 1


# ---------------------------------------------------------------------------
# generic surgery
# ---------------------------------------------------------------------------
def _kaiming(rows: int, cols: int, gen: torch.Generator) -> torch.Tensor:
    bound = 1.0 / math.sqrt(max(1, cols))
    return (torch.rand(rows, cols, generator=gen) * 2 - 1) * bound


def rebuild(lin: nn.Linear, out_map: List[Optional[int]], in_map: List[Optional[Tuple[int, float]]],
            gen: torch.Generator, random_new: bool = False, noise_rows: Optional[List[int]] = None,
            new_bias: float = 0.0):
    """Returns (new_linear, transfer) where transfer maps new param -> (old param, rows, cols) of originals."""
    old_w, old_b = lin.weight.data, lin.bias.data
    n_out, n_in = len(out_map), len(in_map)
    W = torch.zeros(n_out, n_in)
    B = torch.zeros(n_out)
    src_rows = [i for i, r in enumerate(out_map) if r is not None]
    src_cols = [j for j, c in enumerate(in_map) if c is not None]
    if src_rows and src_cols:
        ri = torch.tensor([out_map[i] for i in src_rows])
        ci = torch.tensor([in_map[j][0] for j in src_cols])
        sc = torch.tensor([in_map[j][1] for j in src_cols], dtype=W.dtype)
        block = old_w[ri][:, ci] * sc
        W[torch.tensor(src_rows).unsqueeze(1), torch.tensor(src_cols).unsqueeze(0)] = block
        B[torch.tensor(src_rows)] = old_b[ri]
    new_rows = [i for i, r in enumerate(out_map) if r is None]
    new_cols = [j for j, c in enumerate(in_map) if c is None]
    if random_new:
        if new_rows:
            W[torch.tensor(new_rows)] = _kaiming(len(new_rows), n_in, gen)
            B[torch.tensor(new_rows)] = 0.0
        if new_cols:
            W[:, torch.tensor(new_cols)] = _kaiming(n_out, len(new_cols), gen)
    elif new_rows:
        B[torch.tensor(new_rows)] = new_bias
    if noise_rows:
        W[torch.tensor(noise_rows)] += torch.randn(len(noise_rows), n_in, generator=gen) * SYMMETRY_NOISE
    new = nn.Linear(n_in, n_out)
    new.weight.data.copy_(W)
    new.bias.data.copy_(B)
    # originals: first occurrence of each source row/col
    seen_r, orig_rows = set(), []
    for i, r in enumerate(out_map):
        if r is not None and r not in seen_r:
            seen_r.add(r)
            orig_rows.append((i, r))
    seen_c, orig_cols = set(), []
    for j, c in enumerate(in_map):
        if c is not None and c[0] not in seen_c:
            seen_c.add(c[0])
            orig_cols.append((j, c[0]))
    transfer = {id(new.weight): (lin.weight, orig_rows, orig_cols), id(new.bias): (lin.bias, orig_rows, None)}
    return new, transfer


def ident(n):
    return [(j, 1.0) for j in range(n)]


def rows_ident(n):
    return list(range(n))


# ---------------------------------------------------------------------------
# operations (each returns transfer dict and extra info); model is mutated in place
# ---------------------------------------------------------------------------
def widen_hidden(model: WorldModel, step: int, gen: torch.Generator, rnd: random.Random, random_init=False):
    H = model.H
    src = sorted(rnd.sample(range(H), step))
    if random_init:
        out_map = rows_ident(H) + [None] * step
        in_h = ident(H) + [None] * step
        noise = None
    else:
        out_map = rows_ident(H) + src
        in_h = [(j, 0.5 if j in src else 1.0) for j in range(H)] + [(j, 0.5) for j in src]
        noise = list(range(H, H + step))
    T = {}

    def swap(owner, name, om, im, noise_rows=None):
        new, tr = rebuild(_get_layer(owner, name), om, im, gen, random_init, noise_rows)
        _set_layer(owner, name, new)
        T.update(tr)

    xin = model.Z + P.ACT
    for nm in ("ir", "iz", "inn"):
        swap(model, nm, out_map, ident(xin), noise)
    for nm in ("hr", "hz", "hn"):
        swap(model, nm, out_map, in_h, noise)
    for e in model.experts:
        swap(e, "0", rows_ident(e[0].out_features), in_h)
        swap(e, "2", out_map, ident(e[2].in_features))
    swap(model, "gate", rows_ident(model.E), in_h)
    swap(model.prior_trunk, "0", rows_ident(P.MLPH), in_h)
    swap(model.post_trunk, "0", rows_ident(P.MLPH), in_h + [(H + j, 1.0) for j in range(P.EMB)])
    hz_cols = in_h + [(H + j, 1.0) for j in range(model.Z)]
    swap(model.dec, "0", rows_ident(P.MLPH), hz_cols)
    swap(model.pi, "0", rows_ident(P.MLPH), hz_cols + [(H + model.Z + j, 1.0) for j in range(P.REFL)])
    swap(model.v, "0", rows_ident(P.MLPH), hz_cols)
    swap(model.self_trunk, "0", rows_ident(P.MLPH), hz_cols)
    swap(model, "self_h", out_map, ident(P.MLPH))
    model.H = H + step
    return T, {"h_src": src if not random_init else None, "H_before": H, "H_after": model.H}


def enlarge_latent(model: WorldModel, step: int, gen: torch.Generator, rnd: random.Random, random_init=False):
    Z, H = model.Z, model.H
    T = {}
    new_rows = rows_ident(Z) + [None] * step
    zcols_new = [None] * step

    def swap(owner, name, om, im, new_bias=0.0):
        new, tr = rebuild(_get_layer(owner, name), om, im, gen, random_init, None, new_bias)
        _set_layer(owner, name, new)
        T.update(tr)

    for trunk_out in ("prior_m", "post_m"):
        swap(model, trunk_out, new_rows, ident(P.MLPH))
    for trunk_out in ("prior_s", "post_s"):
        swap(model, trunk_out, new_rows, ident(P.MLPH), new_bias=STD_BIAS_UNIT)
    xin_cols = ident(Z) + zcols_new + [(Z + j, 1.0) for j in range(P.ACT)]
    for nm in ("ir", "iz", "inn"):
        swap(model, nm, rows_ident(H), xin_cols)
    hz_cols = ident(H + Z) + zcols_new
    swap(model.dec, "0", rows_ident(P.MLPH), hz_cols)
    swap(model.pi, "0", rows_ident(P.MLPH), hz_cols + [(H + Z + j, 1.0) for j in range(P.REFL)])
    swap(model.v, "0", rows_ident(P.MLPH), hz_cols)
    swap(model.self_trunk, "0", rows_ident(P.MLPH), hz_cols)
    swap(model, "self_z", new_rows, ident(P.MLPH))
    model.Z = Z + step
    return T, {"Z_before": Z, "Z_after": model.Z}


def add_expert(model: WorldModel, step: int, gen: torch.Generator, rnd: random.Random, random_init=False):
    T = {}
    for _ in range(step):
        E = model.E
        e = rnd.randrange(E)
        clone = copy.deepcopy(model.experts[e])
        with torch.no_grad():
            if random_init:
                for lin in (clone[0], clone[2]):
                    lin.weight.copy_(_kaiming(*lin.weight.shape, gen))
                    lin.bias.zero_()
            else:
                for lin in (clone[0], clone[2]):
                    lin.weight.add_(torch.randn(lin.weight.shape, generator=gen) * SYMMETRY_NOISE)
        model.experts.append(clone)
        gate_map = rows_ident(E) + ([None] if random_init else [e])
        new, tr = rebuild(model.gate, gate_map, ident(model.H), gen, random_init)
        if not random_init:
            with torch.no_grad():
                new.bias[e] -= math.log(2.0)
                new.bias[E] -= math.log(2.0)
        model.gate = new
        T.update(tr)
        model.E = E + 1
    return T, {"E_after": model.E}


def deepen(model: WorldModel, step: int, gen: torch.Generator, rnd: random.Random, random_init=False):
    for _ in range(step):
        layers = list(model.dec.children())
        lin = nn.Linear(P.MLPH, P.MLPH)
        with torch.no_grad():
            if random_init:
                lin.weight.copy_(_kaiming(P.MLPH, P.MLPH, gen))
                lin.bias.zero_()
            else:
                lin.weight.copy_(torch.eye(P.MLPH))
                lin.bias.zero_()
        # insert after the last hidden ReLU, i.e. before the output Linear
        model.dec = nn.Sequential(*layers[:-1], lin, nn.ReLU(), layers[-1])
        model.dec_depth += 1
    return {}, {"dec_depth_after": model.dec_depth}


OPS = {K.WIDEN_HIDDEN: widen_hidden, K.ENLARGE_LATENT: enlarge_latent, K.ADD_EXPERT: add_expert, K.DEEPEN: deepen}


def max_preservation_diff(before: Dict[str, torch.Tensor], after: Dict[str, torch.Tensor]) -> float:
    return max(float((before[k] - after[k]).abs().max()) for k in before)


def make_apply(mind):
    """Harness-side callable bound to one learned mind (SPEC I.1 step 3)."""

    def apply(handles, kind, step, random_init=False, dry_run=False):
        if kind is K.REFLECTION_WORKING_SET:
            if dry_run:
                return {"params_after": mind.model.param_count()}
            handles.grow(kind, step)
            return {}
        op = OPS[kind]
        if dry_run:
            m2 = copy.deepcopy(mind.model)
            op(m2, step, torch.Generator().manual_seed(0), random.Random(0), random_init)
            return {"params_after": m2.param_count()}
        probe = make_probe(mind.model)
        before = mind.model.probe_outputs(probe)
        transfer, info = op(mind.model, step, mind.growth_gen, mind.growth_rng, random_init)
        if info.get("h_src") is not None:
            probe["h_src"] = info["h_src"]
        after = mind.model.probe_outputs(probe)
        diff = max_preservation_diff(before, after)
        mind.after_growth(kind, transfer, info)
        info.update(max_preservation_diff=diff, random_init=random_init, params=mind.model.param_count())
        return info

    return apply
