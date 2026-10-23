"""Test configuration: repository root, then the CivSYS backend from civsys/, on sys.path."""
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parent
for i, p in enumerate((ROOT, ROOT / "civsys" / "backend")):
    if str(p) not in sys.path:
        sys.path.insert(i, str(p))
