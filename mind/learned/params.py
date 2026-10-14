"""Pre-registered v2 hyperparameters (SPEC K.2-K.4, K.6). Fixed: no schedules, no tuning after results."""
FEAT = 58
ACT = 12
EMB = 128
MLPH = 128
REFL = 10
BASE_H = 128
BASE_Z = 16
BASE_E = 2
BASE_DEC_DEPTH = 2
MIN_STD = 0.1

LR_WM = 3e-4
LR_AC = 1e-4
BETAS = (0.9, 0.999)
EPS = 1e-8
GRAD_CLIP = 100.0
FREE_NATS = 1.0
KL_WEIGHT = 1.0
SELF_WEIGHT = 0.5
GAMMA = 0.97
LAMBDA = 0.95
ENTROPY = 1e-3
LP_WEIGHT = 0.1

BATCH = 16
SEQ = 32
WM_UPDATES_PER_TICK = 4
AC_UPDATES_PER_TICK = 1
IMAG_HORIZON = 15
BUFFER_CAPACITY = 1440

PRETRAIN_WM = 3000
PRETRAIN_BC = 1000
HELDOUT_LIFE_TICKS = (600, 647)    # inclusive, life ticks excluded from replay and pre-training (Q13)
NLL_BASELINE_TICKS = 48            # last life ticks used for the PE trigger baseline
POLICY_TEMPERATURE = 1.0
REFLECTION_LOGIT_BETA = 1.0
