"""Learned mind v2 (SPEC section K): a small RSSM-style predictive world model.

Torch is imported only inside this subpackage (and growth/ops_v2, battery/,
experiments/). Reported runs are CPU-only with deterministic algorithms and
one thread per process (D15); GPU nondeterminism would break exact
reproducibility, so GPU runs are never reported.
"""
