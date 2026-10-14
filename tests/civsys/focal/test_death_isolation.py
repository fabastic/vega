"""Round 2, Change 2: the focal mind can never learn that other agents died ("they just vanish").

An agent in the focal agent's view is killed mid-life. Nothing about that death may reach the focal mind's
observations, memory, beliefs, relationships, the handoff or its sidecars. The harness may know the truth.
"""
import ast
import csv
import json
import pathlib

import pytest

from civsys_focal.adapter import build_observation
from civsys_focal.config import FocalConfig
from civsys_focal.engine import FocalSimulationEngine
from civsys_focal.handoff_writer import DEATH_TOKENS, find_death_information, write_life_outputs
from mind.handoff import load

ROOT = pathlib.Path(__file__).resolve().parents[3]


def _life_with_a_death(tmp_path, T=40, kill_from=15):
    cfg = FocalConfig(enabled=True, affect_enabled=True, focal_policy="mind", export_enabled=True,
                      heldout_agent_ids=["agent_0001"], snapshot_tick=T, death_isolation=True, export_all_agents=True)
    e = FocalSimulationEngine(seed=17, population_size=40, width=64, height=64, focal=cfg)
    focal = e.state.agents[cfg.focal_agent_id]
    mind = e.focal_state["mind"]
    seen_refs = []                                      # every ref the mind is shown, per tick
    orig = mind.observe

    def spy(obs, intero):
        seen_refs.append((e.state.tick, obs.refs()))
        return orig(obs, intero)

    mind.observe = spy
    victim, kill_tick = None, None
    for _ in range(T):
        if victim is None and e.state.tick >= kill_from:
            visible = [a for a in focal.perception.visible_agents if e.state.agents[a].is_alive]
            if visible:
                victim, kill_tick = visible[0], e.state.tick
                v = e.state.agents[victim]
                v.is_alive = False
                v.social_identity.cause_of_death = "starvation"
                v.social_identity.death_tick = kill_tick
                if victim not in focal.relationships:
                    from app.simulation.humans.agent import RelationshipState
                    focal.relationships[victim] = RelationshipState(target_id=victim, affection=0.9, trust=0.7)
        e.step()
    del mind.observe
    assert victim is not None, "test setup: no agent was ever in view to be killed"
    out = tmp_path / "life"
    write_life_outputs(e, 17, out)
    return e, victim, out, kill_tick, seen_refs


@pytest.fixture(scope="module")
def life(tmp_path_factory):
    return _life_with_a_death(tmp_path_factory.mktemp("death"))


def test_dead_agent_vanishes_from_every_later_observation(life):
    e, victim, _, kill_tick, seen = life
    assert any(victim in refs for t, refs in seen if t < kill_tick), "victim must have been visible before"
    assert not any(victim in refs for t, refs in seen if t >= kill_tick)


def test_relationship_reads_as_living_agent(life):
    e, victim, out, _, _ = life
    h = load(out)
    rel = h.relationships[victim]
    assert set(rel) <= {"target_id", "trust", "affection", "respect", "loyalty", "conflict", "familiarity",
                        "influence", "name"}
    assert not find_death_information(rel)


def test_handoff_and_sidecars_have_no_death_information(life):
    _, _, out, _, _ = life
    h = load(out)
    assert find_death_information(h.model_dump(), allow=("body.physiology.starvation_threshold",)) == []
    for name in ("life.csv", "train_agents.csv", "heldout_agent_0001.csv"):
        with open(out / name, newline="", encoding="utf-8") as fh:
            header = next(csv.reader(fh))
        assert not [c for c in header if any(t in c.lower() for t in DEATH_TOKENS)], (name, header)


def test_mind_state_memory_and_beliefs_are_clean(life):
    e, _, out, _, _ = life
    m = e.focal_state["mind"]
    assert find_death_information(m.export_state()) == []          # no exemptions inside the mind
    h = load(out)
    for rec in h.memory["civsys_records"]:
        assert not any(t in rec["event_type"].lower() for t in DEATH_TOKENS)
    assert find_death_information(h.beliefs) == []


def test_no_grief_only_unexplained_absence(life):
    e, _, _, _, _ = life
    m = e.focal_state["mind"]
    assert m.absence_only
    assert m.affect.I["grief"] == 0.0
    rows = e.focal_state["rows"]
    assert all("R7|" not in (r.get("rules") or "") + "|" for r in rows)


def test_mind_code_has_no_concept_of_death():
    """Identifiers and string constants in mind/ (not comments) contain no death vocabulary."""
    banned = ("death", "dead", "died", "dying", "deceas", "mortal", "corpse", "killed", "alive", "starv")
    hits = []
    for py in (ROOT / "mind").rglob("*.py"):
        tree = ast.parse(py.read_text(encoding="utf-8"))
        docs = {id(n.body[0].value) for n in ast.walk(tree)
                if isinstance(n, (ast.Module, ast.FunctionDef, ast.ClassDef, ast.AsyncFunctionDef))
                and n.body and isinstance(n.body[0], ast.Expr) and isinstance(n.body[0].value, ast.Constant)}
        for node in ast.walk(tree):
            words = []
            if isinstance(node, ast.Name):
                words = [node.id]
            elif isinstance(node, ast.Attribute):
                words = [node.attr]
            elif isinstance(node, (ast.FunctionDef, ast.ClassDef)):
                words = [node.name]
            elif isinstance(node, ast.arg):
                words = [node.arg]
            elif isinstance(node, ast.Constant) and isinstance(node.value, str) and id(node) not in docs:
                words = [node.value]
            for w in words:
                if any(b in w.lower() for b in banned):
                    hits.append((py.name, w[:40]))
    assert not hits, hits


def test_default_config_keeps_round1_layout(tmp_path):
    """Without the flag, the export still carries the round-1 'alive' column (defaults unchanged)."""
    cfg = FocalConfig(enabled=True, affect_enabled=True, focal_policy="mind", export_enabled=True, snapshot_tick=5)
    e = FocalSimulationEngine(seed=3, population_size=20, width=48, height=48, focal=cfg)
    for _ in range(5):
        e.step()
    assert "alive" in e.focal_state["rows"][0]
    assert not e.focal_state["mind"].absence_only
