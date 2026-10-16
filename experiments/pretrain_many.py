"""Run v2 pre-training for several seeds as parallel subprocesses (one log per seed), for unattended runs.

    CIVSYS_ROUND=3 python -m experiments.pretrain_many --attempt 1 --jobs 5 -- --wm 4000 --seq 80 --residual
"""
import argparse
import json
import os
import subprocess
import sys
import time
from concurrent.futures import ThreadPoolExecutor

from experiments.common import ROOT, RUN_ROOT, SEEDS, life_dir


def one(seed: int, attempt: int, extra: list) -> dict:
    if (life_dir(seed) / f"pretrain_r2_attempt{attempt}.json").exists():
        return {"seed": seed, "skipped": True}
    log = RUN_ROOT / "logs" / f"pretrain_seed_{seed}.log"
    env = {**os.environ, "PYTHONDONTWRITEBYTECODE": "1", "OMP_NUM_THREADS": "1", "MKL_NUM_THREADS": "1"}
    t0 = time.time()
    with open(log, "w", encoding="utf-8") as fh:
        rc = subprocess.run([sys.executable, "-m", "experiments.pretrain_v2_r2", "--seeds", str(seed),
                             "--attempt", str(attempt), *extra], cwd=str(ROOT), stdout=fh, stderr=subprocess.STDOUT,
                            env=env).returncode
    return {"seed": seed, "returncode": rc, "seconds": round(time.time() - t0, 1)}


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--attempt", type=int, required=True)
    ap.add_argument("--jobs", type=int, default=5)
    ap.add_argument("--seeds", type=int, nargs="+", default=SEEDS)
    ap.add_argument("extra", nargs=argparse.REMAINDER)
    a = ap.parse_args()
    extra = [x for x in a.extra if x != "--"]
    (RUN_ROOT / "logs").mkdir(parents=True, exist_ok=True)
    with ThreadPoolExecutor(a.jobs) as ex:
        for r in ex.map(lambda s: one(s, a.attempt, extra), a.seeds):
            print(json.dumps(r), flush=True)
    print("finished", flush=True)
