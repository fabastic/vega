"""No route from the mind or the growth path to code execution, files or network (SPEC I.6, F.1).

(a) static: banned imports and calls in mind/ and growth/ (mind/handoff.py is the contract
    file reader used by the harness; no mind runtime module may import it);
(b) runtime: an audit hook fails on file/process/network/exec/compile/import events raised
    while the mind observes, requests capacity, and the harness evaluates and applies a grant.
"""
import ast
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
BANNED_MODULES = {"os", "sys", "subprocess", "socket", "importlib", "pathlib", "shutil", "urllib", "http",
                  "requests", "pickle", "marshal", "ctypes", "multiprocessing", "io", "builtins", "tempfile"}
BANNED_CALLS = {"eval", "exec", "compile", "open", "__import__", "input", "breakpoint"}
EXEMPT = {ROOT / "mind" / "handoff.py"}


def _py_files():
    for folder in ("mind", "growth"):
        for py in (ROOT / folder).rglob("*.py"):
            if py not in EXEMPT:
                yield py


def test_static_ban():
    problems = []
    for py in _py_files():
        tree = ast.parse(py.read_text(encoding="utf-8"))
        for node in ast.walk(tree):
            if isinstance(node, ast.Import):
                for a in node.names:
                    if a.name.split(".")[0] in BANNED_MODULES:
                        problems.append((py.name, a.name))
            elif isinstance(node, ast.ImportFrom) and node.module:
                if node.module.split(".")[0] in BANNED_MODULES:
                    problems.append((py.name, node.module))
                if node.module == "mind.handoff":
                    problems.append((py.name, "imports mind.handoff"))
            elif isinstance(node, ast.Call) and isinstance(node.func, ast.Name):
                if node.func.id in BANNED_CALLS:
                    problems.append((py.name, node.func.id + "()"))
                if node.func.id in ("getattr", "setattr") and len(node.args) >= 2 and not isinstance(node.args[1], ast.Constant):
                    problems.append((py.name, node.func.id + " with dynamic name"))
    assert not problems, problems


_WATCH = {"active": False, "events": []}
_BANNED_PREFIXES = ("open", "socket.", "subprocess.", "os.system", "os.exec", "os.spawn", "os.posix_spawn",
                    "os.remove", "os.rename", "shutil.", "exec", "compile", "import", "urllib.", "ctypes.",
                    "http.", "ftplib.", "smtplib.", "webbrowser.")


def _hook(event, args):
    if _WATCH["active"] and event.startswith(_BANNED_PREFIXES):
        _WATCH["events"].append(event)


sys.addaudithook(_hook)   # cannot be removed; inert unless _WATCH["active"]


def test_runtime_audit_during_observe_request_and_grant():
    from growth import ops_v1
    from growth.harness import GrowthHarness, v1_rules
    from mind.channel import CapacityChannel
    from mind.rulebased import RuleBasedMind
    from mind.types import (CapacityKind, Interoception, Observation, ReasonCode, SoundSample, Telemetry,
                            VisualSample)

    phys = {"hunger_per_tick": 0.008, "thirst_per_tick": 0.015, "sleep_per_tick": 0.02}
    ch = CapacityChannel()
    mind = RuleBasedMind({}, phys, 1, {"a": 0.9}, ch)
    harness = GrowthHarness(v1_rules(64), "on", ops_v1.apply)

    def step(tau):
        obs = Observation(vision=(VisualSample(0.1 * tau, 2.0, "agent", "a"),) if tau % 2 else (),
                          sound=SoundSample(0.3))
        mind.observe(obs, Interoception(hunger=0.3, thirst=0.3))
        ch.request_capacity(CapacityKind.EXPECTATION_DIMS, ReasonCode.PREDICTION_ERROR)
        mind.telemetry_cache = Telemetry(0.9, 0.0, 1.0, False, 0, mind.telemetry_cache.capacity)
        harness.tick(tau, mind, ch)

    for tau in range(1, 30):      # warm-up: lazy imports, first-use allocations
        step(tau)
    _WATCH["events"].clear()
    _WATCH["active"] = True
    try:
        for tau in range(30, 120):
            step(tau)
    finally:
        _WATCH["active"] = False
    assert harness.grants_total >= 1, "the audited window must include at least one grant"
    assert _WATCH["events"] == [], sorted(set(_WATCH["events"]))


def test_requests_carrying_arbitrary_objects_are_rejected_before_the_harness():
    import pytest
    from mind.channel import CapacityChannel, channel_drain
    from mind.types import CapacityKind, ReasonCode
    ch = CapacityChannel()
    for bad in [("import os", ReasonCode.BOREDOM), (CapacityKind.DEEPEN, lambda: None), ({"code": 1}, 0)]:
        with pytest.raises(TypeError):
            ch.request_capacity(*bad)
    assert channel_drain(ch) == ([], 0)


def test_audit_hook_is_not_vacuous(tmp_path):
    """The runtime check must actually see file, import and exec events when they happen."""
    _WATCH["events"].clear()
    _WATCH["active"] = True
    try:
        with open(tmp_path / "x.txt", "w") as fh:
            fh.write("x")
        exec("1 + 1")
        __import__("this_module_does_not_exist_xyz", fromlist=["*"]) if False else None
        try:
            __import__("antigravity_not_installed_zz")
        except ImportError:
            pass
    finally:
        _WATCH["active"] = False
    seen = set(_WATCH["events"])
    _WATCH["events"].clear()
    assert "open" in seen and "exec" in seen and "import" in seen, seen
