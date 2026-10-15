"""Furnished-room calibration runs for the v1 growth thresholds (round 2 procedure, any round >= 2).

v1, growth off, reflection on and off, every seed, K = 168, written to RUN_ROOT/calib_v1/. Growth is off, so the
thresholds play no part; experiments.calibrate_v1 then replays this telemetry under candidate thresholds.
    CIVSYS_ROUND=3 python -m experiments.calib_runs
"""
import json
import time

from experiments.common import RUN_ROOT, SEEDS, life_dir, memory_base


def main() -> dict:
    from whiteroom.config import CellConfig, RoomConfig
    from whiteroom.runner import run_room_cell
    t0, n, mem = time.time(), 0, memory_base()
    for s in SEEDS:
        for refl in (True, False):
            cell = CellConfig(arm="furnished_room", mind="v1", growth="off", reflection=refl, K=168)
            run_room_cell(life_dir(s), cell, RUN_ROOT / "calib_v1" / f"seed_{s}_r{int(refl)}", RoomConfig(), mem)
            n += 1
    return {"runs": n, "memory_base": mem, "seconds": round(time.time() - t0, 1)}


if __name__ == "__main__":
    print(json.dumps(main()))
