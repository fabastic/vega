"""Parameter and per-tick compute caps for the learned mind (SPEC I.2)."""
PARAM_CAP = 1_500_000
FLOP_MULTIPLE_CAP = 4.5
# deterministic per-tick proxy: 6 * params * (4 world-model updates x batch 16 x seq 32 + 16 imagined x 15 steps)
_TOKENS = 4 * 16 * 32 + 16 * 15


def flop_proxy(params: int) -> float:
    return 6.0 * params * _TOKENS


def flop_cap_for(params_at_T: int) -> float:
    return FLOP_MULTIPLE_CAP * flop_proxy(params_at_T)
