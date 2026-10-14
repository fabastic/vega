"""File I/O for the learned mind's frozen state (kept out of mind/ by the no-route rule).

safetensors only: no pickle on any load path (D5).
"""
from __future__ import annotations

import copy
import json
from pathlib import Path

from safetensors.torch import load_file, save_file

from mind.handoff import sidecar_path


def build_v2_from_handoff(handoff, handoff_dir, cell, channel):
    from mind.learned.agent import LearnedMind
    d = Path(handoff_dir)
    tensors = load_file(str(sidecar_path(handoff, d, "v2_state_tensors")))
    state = json.loads(sidecar_path(handoff, d, "v2_state_json").read_text())
    m = LearnedMind.from_parts(state, tensors, channel, cell.learning)
    m.reflection.enabled = cell.reflection
    m.clock.anchoring = False
    return m


def save_snapshot(mind, out_dir: Path, with_optimizer: bool = False) -> Path:
    """Frozen snapshot for out-of-band probing (SPEC L.1)."""
    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    state = mind.export_state()
    (out_dir / "state.json").write_text(json.dumps(state, default=str))
    if hasattr(mind, "export_tensors"):
        t = mind.export_tensors()
        if not with_optimizer:
            t = {k: v for k, v in t.items() if not k.startswith("opt.")}
        save_file({k: v.contiguous() for k, v in t.items()}, str(out_dir / "tensors.safetensors"))
    return out_dir


def load_snapshot(snap_dir: Path):
    snap_dir = Path(snap_dir)
    state = json.loads((snap_dir / "state.json").read_text())
    if state["version"].startswith("learned"):
        from mind.learned.agent import LearnedMind
        tensors = load_file(str(snap_dir / "tensors.safetensors"))
        m = LearnedMind.from_parts(state, tensors)
        m.learning_enabled = False
        return m
    from mind.rulebased import RuleBasedMind
    return RuleBasedMind.from_state(copy.deepcopy(state))
