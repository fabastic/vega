"""Handoff contract (SPEC section B): everything the agent carries at tick T.

CivSYS writes it; the white room reads it. Neither imports the other. The
top-level keys are a whitelist: anything global (world, market, other agents'
internal state) is rejected.
"""
from __future__ import annotations

import hashlib
import json
from pathlib import Path
from typing import Any, Dict, Optional

from pydantic import BaseModel, ConfigDict

SCHEMA_VERSION = "handoff/2"
HANDOFF_FILE = "handoff.json"


class Handoff(BaseModel):
    model_config = ConfigDict(extra="forbid")

    meta: Dict[str, Any]
    body: Dict[str, Any]                 # needs, physiology
    traits: Dict[str, Any]               # personality, values, cognition, skills
    identity: Dict[str, Any]
    affect: Dict[str, Any]               # mind affect + 19 legacy channels
    memory: Dict[str, Any]               # CivSYS MemoryRecords (full store) + mind store summary
    beliefs: Dict[str, Any]
    goals: Dict[str, Any]
    relationships: Dict[str, Any]        # target id -> fields + name; no state of the other agents
    known_places: Dict[str, Any]         # egocentric bearing/distance at T only
    clock: Dict[str, Any]
    expectation: Dict[str, Any]
    observation_history: Dict[str, Any]  # last 168 ticks of feature vectors, harness ticks stripped
    observation_stats: Dict[str, Any]
    capacity: Dict[str, Any]
    reflection: Dict[str, Any]
    minds: Dict[str, Any]                # {"v1": full rule-based state, "v2": sidecar refs or null}
    sidecars: Dict[str, Any] = {}        # name -> {"path", "sha256"}
    rng: Dict[str, Any] = {}


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as fh:
        for chunk in iter(lambda: fh.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def dump(handoff: Handoff, directory: Path) -> Path:
    directory = Path(directory)
    directory.mkdir(parents=True, exist_ok=True)
    out = directory / HANDOFF_FILE
    out.write_text(json.dumps(handoff.model_dump(), sort_keys=True, indent=1), encoding="utf-8")
    return out


def add_sidecar(handoff: Handoff, directory: Path, name: str, filename: str) -> None:
    p = Path(directory) / filename
    handoff.sidecars[name] = {"path": filename, "sha256": sha256_file(p)}


def load(directory: Path, verify_sidecars: bool = True) -> Handoff:
    directory = Path(directory)
    data = json.loads((directory / HANDOFF_FILE).read_text(encoding="utf-8"))
    version = data.get("meta", {}).get("schema_version", "")
    if version.split("/")[0] != "handoff" or version.split("/")[-1] != SCHEMA_VERSION.split("/")[-1]:
        raise ValueError(f"unsupported handoff schema version: {version!r}")
    h = Handoff.model_validate(data)
    if verify_sidecars:
        for name, ref in h.sidecars.items():
            got = sha256_file(directory / ref["path"])
            if got != ref["sha256"]:
                raise ValueError(f"sidecar {name!r} failed sha256 check")
    return h


def sidecar_path(h: Handoff, directory: Path, name: str) -> Optional[Path]:
    ref = h.sidecars.get(name)
    return None if ref is None else Path(directory) / ref["path"]
