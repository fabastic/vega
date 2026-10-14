"""Writes RESULTS_ROUND2.md: round 1 vs round 2 on the same metrics (CIVSYS_ROUND=2)."""
from __future__ import annotations

import csv
import json
import statistics

import numpy as np

from experiments.analysis import ARMS, DEPRIVATION, PRIMARY, main as analyse
from experiments.common import ROOT, SEEDS, life_dir
from experiments.write_results import FRAMING, fmt

R1 = ROOT / "results"
R2 = ROOT / "results_round2"
HEADLINE = ("v1|g=on|refl=1|-", "v2|g=on|refl=1|replay_plus_imagination")


def _r1():
    c = json.loads((R1 / "contrasts.json").read_text())
    with open(R1 / "summary_table.csv", newline="", encoding="utf-8") as fh:
        rows = list(csv.DictReader(fh))
    return c, rows


def _mean(rows, key, **f):
    v = [float(r[key]) for r in rows if all(str(r[k]) == str(x) for k, x in f.items()) and r.get(key) not in (None, "", "None")]
    return statistics.mean(v) if v else None


def comparison_figures(c1, c2):
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    out = []
    (R2 / "figures").mkdir(parents=True, exist_ok=True)
    for metric in PRIMARY:
        fig, axes = plt.subplots(1, 2, figsize=(10, 3.4), sharey=False)
        for ax, tag in zip(axes, HEADLINE):
            x = np.arange(len(DEPRIVATION))
            for i, (lab, c) in enumerate((("round 1", c1), ("round 2", c2))):
                blk = c["contrasts"]["primary"].get(tag, {})
                m = [blk.get(a, {}).get(metric, {}).get("mean") or 0 for a in DEPRIVATION]
                lo = [(blk.get(a, {}).get(metric, {}).get("lo")) for a in DEPRIVATION]
                hi = [(blk.get(a, {}).get(metric, {}).get("hi")) for a in DEPRIVATION]
                err = [[mm - (l if l is not None else mm) for mm, l in zip(m, lo)],
                       [(h if h is not None else mm) - mm for mm, h in zip(m, hi)]]
                ax.bar(x + (i - 0.5) * 0.38, m, 0.38, yerr=err, capsize=3, label=lab)
            ax.axhline(0, color="k", lw=0.6)
            ax.set_xticks(x)
            ax.set_xticklabels([a.replace("_", "\n") for a in DEPRIVATION], fontsize=7)
            ax.set_title(tag.split("|")[0] + " (growth on, reflection on)", fontsize=9)
        axes[0].set_ylabel(f"{metric}\n(arm minus furnished_room)", fontsize=8)
        axes[1].legend(fontsize=8)
        fig.tight_layout()
        p = R2 / "figures" / f"compare_{metric}.png"
        fig.savefig(p, dpi=110)
        plt.close(fig)
        out.append(p.name)
    # grants per run by mind and arm
    fig, ax = plt.subplots(figsize=(10, 3.4))
    keys = [f"{m}|{a}" for m in ("v1", "v2") for a in ARMS]
    x = np.arange(len(keys))
    for i, (lab, c) in enumerate((("round 1", c1), ("round 2", c2))):
        ax.bar(x + (i - 0.5) * 0.38, [c["grants_by_mind_arm"].get(k) or 0 for k in keys], 0.38, label=lab)
    ax.set_xticks(x)
    ax.set_xticklabels([k.replace("|", "\n").replace("_", " ") for k in keys], fontsize=6)
    ax.set_ylabel("mean grants per growth-on run")
    ax.legend(fontsize=8)
    fig.tight_layout()
    p = R2 / "figures" / "compare_grants.png"
    fig.savefig(p, dpi=110)
    plt.close(fig)
    out.append(p.name)
    return out


def write(K: int = 168, notes: str = "") -> str:
    c2 = analyse(K)
    c1, rows1 = _r1()
    rows2 = []
    with open(R2 / "summary_table.csv", newline="", encoding="utf-8") as fh:
        rows2 = list(csv.DictReader(fh))
    figs = comparison_figures(c1, c2)
    L = ["# RESULTS, ROUND 2: round 1 vs round 2 on the same metrics", "", FRAMING, "",
         f"Round 2 runs analysed: {c2['n_runs']} of 1,320. Round 1: partial run (tag `round1-final`). "
         "`*` = 95% bootstrap CI over seeds excludes 0; differences are paired per seed.", ""]
    if notes:
        L += [notes, ""]
    L += ["## 0. What changed in round 2", "",
          "| | Round 1 | Round 2 |", "|---|---|---|",
          "| Handoff tick T | 720 (day 30; civilisation dead from ~day 6) | **80** (day 3.3; before any perceivable death in all seeds) |",
          "| Life history | ~4-6 social days + ~24 days alone in an emptied town | 3.3 social days, everyone alive |",
          "| Death information reaching the focal mind | none by construction, but an own-alive column, starvation threshold and absence-triggered 'grief' rule existed | removed behind `death_isolation`; tested |",
          "| civ_control length | 168 ticks in an emptied town | stops before the first perceivable death (see section 4) |",
          "| v2 training data | 672 focal transitions | ~12,400 transitions (all non-held-out agents of the seed, pre-T) |",
          "| v2 surprise baseline | in-sample (last 48 life ticks) | out-of-sample (held-out agents), threshold from held-out windows |",
          "| v1 growth thresholds | PE 0.4, boredom 0.5, novelty 0.2 | recalibrated on furnished-room runs to ~1 grant per run (post-hoc, logged) |", ""]
    L += ["## 1. Primary contrasts (deprivation arm minus furnished_room), headline settings", ""]
    for tag in HEADLINE:
        b1, b2 = c1["contrasts"]["primary"].get(tag, {}), c2["contrasts"]["primary"].get(tag, {})
        L += [f"### {tag}", "", "| arm | metric | round 1 | round 2 |", "|---|---|---|---|"]
        for arm in DEPRIVATION:
            for m in PRIMARY:
                L.append(f"| {arm} | {m} | {fmt(b1.get(arm, {}).get(m))} | {fmt(b2.get(arm, {}).get(m))} |")
        L.append("")
    def count(c):
        n = s = 0
        for arms in c["contrasts"]["primary"].values():
            for ms in arms.values():
                for m in PRIMARY:
                    n += 1
                    s += bool(ms[m].get("excludes_zero"))
        return s, n
    s1, n1 = count(c1)
    s2, n2 = count(c2)
    L += [f"Primary contrasts with CI excluding 0: round 1 {s1}/{n1}, round 2 {s2}/{n2}.", ""]
    L += ["## 2. Growth on minus off within full_deprivation", "",
          "| setting | metric | round 1 | round 2 |", "|---|---|---|---|"]
    for tag in sorted(set(c1["contrasts"]["growth_within_deprivation"]) | set(c2["contrasts"]["growth_within_deprivation"])):
        for m in ("grants",) + PRIMARY:
            L.append(f"| {tag} | {m} | {fmt(c1['contrasts']['growth_within_deprivation'].get(tag, {}).get(m))} | "
                     f"{fmt(c2['contrasts']['growth_within_deprivation'].get(tag, {}).get(m))} |")
    L += ["", "| setting | interpretation round 1 | interpretation round 2 |", "|---|---|---|"]
    for tag in sorted(set(c1["interpretation"]) | set(c2["interpretation"])):
        L.append(f"| {tag} | {c1['interpretation'].get(tag, {}).get('label', 'n/a')} | {c2['interpretation'].get(tag, {}).get('label', 'n/a')} |")
    L += ["", "## 3. Growth firing rates (mean grants per growth-on run)", "", "| mind | arm | round 1 | round 2 |", "|---|---|---|---|"]
    for m in ("v1", "v2"):
        for a in ARMS:
            g1, g2 = c1["grants_by_mind_arm"].get(f"{m}|{a}"), c2["grants_by_mind_arm"].get(f"{m}|{a}")
            L.append(f"| {m} | {a} | {'n/a' if g1 is None else f'{g1:.2f}'} | {'n/a' if g2 is None else f'{g2:.2f}'} |")
    L += ["", "## 4. Capability at T and the civ_control window", ""]
    for m in ("v1", "v2"):
        L.append(f"- {m}: mean capability score at T (furnished_room, growth on): round 1 "
                 f"{_mean(rows1, 'capability_T', mind=m, arm='furnished_room', growth='on') or float('nan'):.3f}, round 2 "
                 f"{_mean(rows2, 'capability_T', mind=m, arm='furnished_room', growth='on') or float('nan'):.3f}; "
                 f"F1 at end: round 1 {_mean(rows1, 'F1_end', mind=m) or 0:.3f}, round 2 {_mean(rows2, 'F1_end', mind=m) or 0:.3f}")
    cw = [int(r["n_ticks"]) for r in c2.get("_control_rows", [])] if False else []
    ctrl = [json.loads((p).read_text()) for p in (ROOT / "runs_round2" / "full" / f"K{K}").glob("seed_*/civ_control__*/summary.json")]
    wins = [s.get("control_window") for s in ctrl if s.get("control_window") is not None]
    if wins:
        L.append(f"- civ_control window (round 2): mean {np.mean(wins):.1f} ticks, min {min(wins)}, max {max(wins)} "
                 f"(n={len(wins)} runs), versus 168 room ticks. Contrasts involving civ_control compare a {np.mean(wins):.0f}-tick "
                 "window with a 168-tick one and are reported descriptively only; furnished_room is the primary comparison arm.")
    gate_rows = []
    for s in SEEDS:
        p = sorted(life_dir(s).glob("pretrain_r2_attempt*.json"))
        if p:
            g = json.loads(p[-1].read_text())
            gate_rows.append(f"| {s} | {g['attempt']} | {g['gate']['model_mse']:.4f} | {g['gate']['persistence_mse']:.4f} | "
                             f"{g['gate']['ratio_model_to_persistence']:.2f} | {g['gate']['beats_persistence']} |")
    if gate_rows:
        L += ["", "### v2 held-out baseline gate (round 2)", "", "| seed | attempt | model MSE | persistence MSE | ratio | beats |",
              "|---|---|---|---|---|---|"] + gate_rows
    art = c2["artifacts"]
    L += ["", "## 5. Round-2 artifact and sanity checks", "",
          f"- NaN runs: {len(art['nan_runs'])}; missing battery: {len(art['missing_battery'])}; focal deaths: {len(art['deaths'])}",
          f"- Cells identical across all seeds: {len(art['identical_across_seeds'])}",
          f"- v2 latent-collapse flags: {len(art['v2_collapse_flags'])} of {art['v2_runs']}",
          f"- Implausibly large capability/self-discovery changes: {len(art['implausibly_large_changes'])}", "",
          "## 6. Figures", ""] + [f"![{f}](results_round2/figures/{f})" for f in figs + c2["figures"]] + [""]
    text = "\n".join(L)
    (ROOT / "RESULTS_ROUND2.md").write_text(text, encoding="utf-8")
    return text


if __name__ == "__main__":
    print(write()[:3000])
