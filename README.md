# vega

A sensory-deprivation experiment on a simulated agent.

[CivSYS](https://github.com/ashvyagni/CivSYS) is used only to give one agent, the **focal agent**, a lived
history. At tick T the agent is handed off to a separate simulation, the **white room**, which then studies what
its internal state does when external input is reduced or removed.

CivSYS is a **dependency** of this repository: a git submodule (`civsys/`) pinned to an exact upstream commit,
used unmodified. Everything else here is vega's own code.

## Pathway

```
CivSYS life (focal agent driven by vega's rule-based mind, via civsys_focal/)
  → handoff file at tick T (handoff.json + sha256-checked sidecars)
  → white room: furnished room | exteroception removed | full deprivation | fade-out | noise-only
    + an in-civilisation control (CivSYS continued from the checkpoint at T)
  → out-of-band capability battery and self-discovery measures on frozen copies
  → analysis
```

The mind interface is `observe(obs, interoception) -> action`. There are two minds:
- **v1**, rule-based: an affect core, scripted reflection and a self-model.
- **v2**, learned: an RSSM world model plus actor-critic (PyTorch, CPU).

Growth is bounded and decided by the harness. The mind can only *request* capacity through a typed channel.

## Layout

| Path | What |
|---|---|
| `civsys/` | **CivSYS, git submodule**, pinned to `ashvyagni/CivSYS@70420010`; never modified |
| `civsys_focal/` | flag-gated focal-agent add-on that subclasses CivSYS's engine and decision system. Default off; the golden-hash test shows defaults reproduce unmodified CivSYS exactly |
| `mind/` | the agent's mind: rule-based v1 (`mind/rulebased`, `mind/affect`, `mind/reflection`) and learned v2 (`mind/learned`) |
| `whiteroom/` | the white-room simulation (never imports CivSYS) |
| `growth/` | harness-controlled, bounded, function-preserving capacity growth |
| `battery/` | capability battery (F1–F5) and self-discovery measures (SD1–SD5), probed out-of-band |
| `experiments/` | life runs, pre-training, calibration, pilot, full runs, analysis |
| `scripts/run_life.py` | the CivSYS life phase for one or more seeds, writing the handoff at T |
| `prereg/` | pre-registered parameters and the hash change log |
| `tests/` | vega's tests; `tests/civsys/` holds the golden backcompat and focal tests against CivSYS |
| `SPEC.md`, `docs/` | design (v3) and the CivSYS code map |
| `RESULTS.md`, `MORNING_REPORT.md`, `results/` | round 1 (partial run: 1,085/1,320) |
| `MORNING_REPORT_ROUND2.md`, `DECISIONS_ROUND2.md`, `STATUS.md`, `results_round2/` | round 2 (in progress: 688/1,320) |

The design documents were written before this repository existed, when the add-on lived inside a CivSYS
checkout. Their old paths map as follows:

| Old path | New path |
|---|---|
| `backend/app/simulation/focal/` | `civsys_focal/` |
| `backend/scripts/run_life.py` | `scripts/run_life.py` |
| `backend/tests/golden/`, `backend/tests/focal/`, `backend/tests/test_golden_backcompat.py` | `tests/civsys/` |
| `backend/app/` (CivSYS itself) | `civsys/backend/app/` |

## Setup

Use Python 3.14. CivSYS relies on deferred annotations and does not import under 3.12.

```bash
git clone --recurse-submodules https://github.com/fabastic/vega.git
```

If you already cloned without submodules:

```bash
git submodule update --init
```

```bash
python -m venv .venv-exp
```

```bash
.venv-exp/Scripts/python -m pip install -r requirements.txt
```

## Run

All tests (mind, white room, growth, battery, plus golden backcompat and focal tests against CivSYS):

```bash
.venv-exp/Scripts/python -m pytest
```

CivSYS's own upstream tests, inside the submodule:

```bash
cd civsys/backend && ../../.venv-exp/Scripts/python -m pytest tests
```

The life phase for two seeds:

```bash
.venv-exp/Scripts/python scripts/run_life.py --seeds 42 101 --out runs/life
```

The round-2 full run is resumable; completed runs are skipped:

```bash
CIVSYS_ROUND=2 .venv-exp/Scripts/python -m experiments.run_full --K 168 --workers 6
```

Run outputs go to `runs/` and `runs_round2/`. Both are gitignored. Summaries are committed in `results/` and
`results_round2/`.

## Honesty note

> **On "emotions" and "reflection" in this project.** The affect variables (valence, arousal, dominance, mood
> and the sixteen emotion channels) and the reflective queries (existential, epistemic, temporal, self-identity,
> meaning) are functional state variables and typed data structures. Each is computed by explicit rules, or by a
> small learned model whose outputs feed explicit rules, from concrete events, sensor contents and need states.
> They shape attention, memory and decision scoring. They are **not** claims that the agent has felt experience,
> feelings, beliefs about its existence, or any subjective state. Reflective queries are **scripted by design**.
> More capacity is not more intelligence: the composite is a **capability score**, never "IQ".

## Credits

CivSYS is by [ashvyagni](https://github.com/ashvyagni/CivSYS). See `NOTICE`.
