"""Import boundaries (SPEC D13, F.1), checked statically with ast."""
import ast
import pathlib

ROOT = pathlib.Path(__file__).resolve().parents[1]


def _imports(folder: pathlib.Path):
    for py in folder.rglob("*.py"):
        if any(part.startswith(".venv") or part == "node_modules" for part in py.parts):
            continue
        tree = ast.parse(py.read_text(encoding="utf-8"))
        for node in ast.walk(tree):
            if isinstance(node, ast.Import):
                for a in node.names:
                    yield py, a.name
            elif isinstance(node, ast.ImportFrom) and node.module and node.level == 0:
                yield py, node.module


def _top(name):
    return name.split(".")[0]


CIVSYS_APP = ROOT / "civsys" / "backend" / "app"   # upstream CivSYS (copied in, unmodified)
FOCAL = ROOT / "civsys_focal"                       # our flag-gated add-on to CivSYS


def test_civsys_never_imports_room_growth_battery():
    for folder in (CIVSYS_APP, FOCAL):
        for py, mod in _imports(folder):
            assert _top(mod) not in {"whiteroom", "growth", "battery", "experiments"}, (py, mod)


def test_upstream_civsys_never_imports_our_code():
    for py, mod in _imports(CIVSYS_APP):
        assert _top(mod) not in {"mind", "civsys_focal"}, (py, mod)


def test_focal_addon_imports_mind_but_never_learned():
    for py, mod in _imports(FOCAL):
        assert not mod.startswith("mind.learned"), (py, mod)


def test_mind_imports_no_world_or_harness():
    for py, mod in _imports(ROOT / "mind"):
        assert _top(mod) not in {"app", "whiteroom", "growth", "battery", "experiments"}, (py, mod)


def test_whiteroom_never_imports_civsys():
    folder = ROOT / "whiteroom"
    if folder.exists():
        for py, mod in _imports(folder):
            assert _top(mod) != "app", (py, mod)


def test_only_mind_learned_and_growth_v2_import_torch():
    allowed = ("learned", "ops_v2.py", "battery", "experiments", "tests")
    for folder in ("mind", "growth", "whiteroom", "civsys_focal", "civsys/backend/app"):
        for py, mod in _imports(ROOT / folder):
            if _top(mod) == "torch":
                assert any(a in py.parts or py.name == a for a in allowed), (py, mod)


def test_default_civsys_import_does_not_load_torch(tmp_path):
    import subprocess
    import sys
    code = ("import sys; sys.path[:0]=[r'%s', r'%s']; "
            "from app.simulation.engine import SimulationEngine; "
            "e=SimulationEngine(seed=1, population_size=10, width=32, height=32); e.step(); "
            "import civsys_focal.engine; import app.main; print('torch' in sys.modules)") % (ROOT, ROOT / "civsys" / "backend")
    out = subprocess.run([sys.executable, "-c", code], capture_output=True, text=True, timeout=300,
                         cwd=str(tmp_path), env={**__import__("os").environ, "PYTHONDONTWRITEBYTECODE": "1"})
    assert out.returncode == 0, out.stderr
    assert out.stdout.strip().splitlines()[-1] == "False"
