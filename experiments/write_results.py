"""Writes RESULTS.md from experiments.analysis output. Every pre-registered contrast is reported."""
from __future__ import annotations

import json

from experiments.analysis import DEPRIVATION, PRIMARY, main as analyse
from experiments.common import ROOT

FRAMING = """> **How to read this.** Emotions, mood and reflective queries here are functional state variables and typed data
> structures computed by explicit rules (or by a small learned model feeding explicit rules). They are not claims of
> felt experience or of philosophical thought. Reflective queries are **scripted by design** in both minds. For the
> rule-based mind, "parameters" means countable internal structure. More capacity is not more intelligence: the
> composite below is a **capability score** (never "IQ") measured on a fixed held-out battery. "Self-discovery" means
> the five operational measures SD1-SD5, nothing more. The only learning signal in the room is self-generated (replay of
> life memories plus imagination). Results are exploratory: 10 seeds, bootstrap CIs over seeds, many contrasts, no
> multiplicity correction. Null and negative results are reported with the same prominence as positive ones."""


def fmt(ci):
    if not ci or ci.get("mean") is None:
        return "n/a"
    if ci.get("lo") is None:
        return f"{ci['mean']:+.3f} (n={ci['n']})"
    star = " *" if ci.get("excludes_zero") else ""
    return f"{ci['mean']:+.3f} [{ci['lo']:+.3f}, {ci['hi']:+.3f}]{star}"


def write(K: int, extra_notes: str = "") -> str:
    a = analyse(K)
    c = a["contrasts"]
    L = ["# RESULTS: white-room sensory deprivation (stage 4)", "", FRAMING, "",
         f"Room length K = {K} ticks (pilot rule indicated 672; the 6-hour compute budget required 168; see DECISIONS_OVERNIGHT.md). "
         f"Runs analysed: {a['n_runs']} of 1,320. Pre-registration: prereg/params_v3.json (hash in prereg/CHANGELOG.md).", "",
         "`*` = 95% bootstrap CI over seeds excludes 0. Differences are paired per seed: arm minus furnished_room "
         "(or growth on minus off).", ""]
    if extra_notes:
        L += [extra_notes, ""]
    L += ["## 1. Pre-registered primary contrasts: deprivation arm minus furnished_room", ""]
    for tag in ("v1|g=on|refl=1|-", "v2|g=on|refl=1|replay_plus_imagination"):
        block = c["primary"].get(tag)
        if not block:
            continue
        L += [f"### {tag} (headline setting)", "", "| arm | " + " | ".join(PRIMARY) + " |", "|---|" + "---|" * len(PRIMARY)]
        for arm in DEPRIVATION:
            L.append(f"| {arm} | " + " | ".join(fmt(block[arm][m]) for m in PRIMARY) + " |")
        L.append("")
    n_star = sum(1 for tag, arms in c["primary"].items() for arm, ms in arms.items() for m in PRIMARY
                 if ms[m].get("excludes_zero"))
    n_all = sum(1 for tag, arms in c["primary"].items() for arm, ms in arms.items() for m in PRIMARY)
    L += [f"Across all {len(c['primary'])} settings x 4 arms x 4 primary metrics: {n_star} of {n_all} contrasts have a CI "
          "excluding 0. Full table: results/contrasts.json.", ""]
    L += ["## 2. Pre-registered: growth on minus off, within full_deprivation", "",
          "| setting | " + " | ".join(PRIMARY) + " | grants | interpretation (SPEC L.4) |", "|---|" + "---|" * (len(PRIMARY) + 2)]
    for tag, ms in c["growth_within_deprivation"].items():
        L.append(f"| {tag} | " + " | ".join(fmt(ms[m]) for m in PRIMARY) + f" | {fmt(ms['grants'])} | "
                 f"{a['interpretation'][tag]['label']} |")
    L += ["", "Mean grants per growth-on run, by mind and arm: " +
          ", ".join(f"{k}: {v:.2f}" for k, v in a["grants_by_mind_arm"].items() if v is not None), ""]
    L += ["## 3. Secondary contrasts (descriptive)", ""]
    for name in ("furnished_vs_civ_control|v1", "furnished_vs_civ_control|v2"):
        if name in c["secondary"]:
            L.append(f"- **{name}**: " + "; ".join(f"{m} {fmt(v)}" for m, v in c["secondary"][name].items()))
    for prefix in ("on_vs_schedule_matched", "on_vs_random_growth", "reflection_on_vs_off", "imagination_vs_replay_only"):
        keys = [k for k in c["secondary"] if k.startswith(prefix) and "full_deprivation" in k]
        for k in keys:
            L.append(f"- **{k}**: " + "; ".join(f"{m} {fmt(v)}" for m, v in c["secondary"][k].items()))
    L += ["", "## 4. Artifact and sanity checks", ""]
    art = a["artifacts"]
    L += [f"- NaN runs: {len(art['nan_runs'])}",
          f"- Runs missing battery results: {len(art['missing_battery'])}",
          f"- Focal deaths: {len(art['deaths'])} {art['deaths'][:10]}",
          f"- Cells with identical action counts across all seeds: {len(art['identical_across_seeds'])} {art['identical_across_seeds'][:6]}",
          f"- v2 latent-collapse flags (KL<0.01 nats for 24 ticks or effective rank<2): {len(art['v2_collapse_flags'])} of {art['v2_runs']} v2 runs",
          f"- Implausibly large capability/self-discovery changes (|change|>0.5): {len(art['implausibly_large_changes'])}", "",
          "Known design artifacts that affect interpretation (see also SPEC E.6 and MORNING_REPORT.md):", "",
          "1. **Upstream CivSYS collapses by tick ~150-200**, so the focal agent's life is ~4-6 social days followed by ~24 days "
          "alone in an emptied town; civ_control is that emptied town, not normal life.",
          "2. **Pre-handoff phantoms**: remembered CivSYS places do not exist in the room, so targeting them counts as a "
          "phantom percept by construction in every room arm, including furnished_room.",
          "3. **The subjective clock is an assumed rule**; time-estimate error follows from its coefficients.",
          "4. **Reflection is scripted by design**; query counts show what the rules do with the agent's state.",
          "5. **Growth rarely triggers for v1** under the pre-registered thresholds, so v1 growth contrasts are near-null by construction.",
          "6. **v2's world model generalises poorly** off its training data (scores 0 on F1-F4 at T vs simple baselines), "
          "so capability changes start from a floor.",
          "7. civ_control is subject to CivSYS natural mortality; room arms are not.", ""]
    L += ["## 5. Figures", ""] + [f"![{f}](results/figures/{f})" for f in a["figures"]] + [""]
    text = "\n".join(L)
    (ROOT / "RESULTS.md").write_text(text, encoding="utf-8")
    return text


if __name__ == "__main__":
    import argparse
    ap = argparse.ArgumentParser()
    ap.add_argument("--K", type=int, default=168)
    print(write(ap.parse_args().K)[:2000])
