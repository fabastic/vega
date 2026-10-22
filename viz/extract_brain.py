"""Export the learned v2 mind's inner state for the 3D brain viewer (viz/brain.html).

Reality track: the frozen life-trained model filters a held-out life stream (posterior z from real senses).
Dream track: at DREAM_AT the senses are cut and the model runs on its own prior (z = prior mean, no observation),
fed the same actions the agent actually took. What it decodes there is what it hallucinates.
Read-only: loads the life handoff, writes viz/brain_data.json.
"""
import csv, json, sys
from pathlib import Path
import torch
from safetensors.torch import load_file

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from mind.learned.model import WorldModel
from mind.learned import params as P
from mind.features import FEATURE_NAMES
from mind.types import ACTION_KINDS

SEED, AGENT = 42, 1
START, DREAM_AT, END = 300, 420, 540
LIFE = ROOT / "runs_round3" / "life" / f"seed_{SEED}"

state = json.loads((LIFE / "v2_state.json").read_text())
arch = state["v2"]["arch"]
tens = load_file(str(LIFE / "v2_state.safetensors"))
m = WorldModel(arch["H"], arch["Z"], arch["E"], arch["dec_depth"], arch.get("expert_hidden"),
               arch.get("residual", False), arch.get("bounded", False))
m.load_state_dict({k[6:]: v for k, v in tens.items() if k.startswith("model.")})
m.eval()

rows = list(csv.DictReader(open(LIFE / f"heldout_agent_{AGENT:04d}.csv")))
names = [k.value for k in ACTION_KINDS]
F_ = torch.tensor([[float(r[f"f{i}"]) for i in range(P.FEAT)] for r in rows])
A_ = torch.tensor([names.index(r["action"]) if r["action"] in names else 0 for r in rows])
acts = [r["action"] for r in rows]
r2 = lambda t: [round(x, 3) for x in t.flatten().tolist()]


@torch.no_grad()
def step(h, z, a_idx, f_prev):
    a = torch.nn.functional.one_hot(a_idx.view(1), P.ACT).float()
    h = m.dyn(h, z, a)
    g = torch.softmax(m.gate(h), -1)
    pm, ps = m.prior(h)
    return h, g, pm, ps


out = {"feature_names": FEATURE_NAMES, "actions": names, "start": START, "dream_at": DREAM_AT, "end": END,
       "H": m.H, "Z": m.Z, "reality": [], "dream": []}
with torch.no_grad():
    h, z, a_prev, f_prev = torch.zeros(1, m.H), torch.zeros(1, m.Z), torch.tensor(0), torch.zeros(1, P.FEAT)
    branch = None
    for t in range(END):
        h, g, pm, ps = step(h, z, a_prev, f_prev)
        pred = m.predict(h, pm, f_prev)
        f = F_[t:t + 1]
        qm, _ = m.posterior(h, m.enc(f))
        z = qm
        err = float(((pred - f) ** 2).mean())
        if t == DREAM_AT:
            branch = (h.clone(), z.clone(), f_prev.clone())
        if t >= START:
            _, _, sa = m.self_model(h, z)
            out["reality"].append({"t": t, "act": acts[t], "h": r2(h), "z": r2(z), "gate": r2(g), "err": round(err, 4),
                                   "pred": r2(pred), "real": r2(f),
                                   "intent": names[int(sa[0, :len(names)].argmax())]})
        f_prev, a_prev = f, A_[t]
    h, z, f_prev = branch
    for t in range(DREAM_AT, END):
        a_idx = A_[t - 1]
        h, g, pm, ps = step(h, z, a_idx, f_prev)
        z = pm                                   # no senses: the prior is all it has
        dec = m.predict(h, z, f_prev)
        f_prev = dec                             # it feeds on its own hallucination
        _, _, sa = m.self_model(h, z)
        out["dream"].append({"t": t, "act": acts[t], "h": r2(h), "z": r2(z), "gate": r2(g),
                             "pred": r2(dec), "real": r2(F_[t:t + 1]),
                             "err": round(float(((dec - F_[t:t + 1]) ** 2).mean()), 4),
                             "intent": names[int(sa[0, :len(names)].argmax())]})
(ROOT / "viz" / "brain_data.json").write_text(json.dumps(out, separators=(",", ":")))
print("reality", len(out["reality"]), "dream", len(out["dream"]),
      "dream err first/last", out["dream"][0]["err"], out["dream"][-1]["err"],
      "reality err mean", sum(r["err"] for r in out["reality"]) / len(out["reality"]))
