"""Capability battery and self-discovery measures (SPEC section L).

Probing is OUT-OF-BAND: frozen snapshots are loaded in a separate process
(python -m battery.probe <cell_dir>); probe inputs never reach the live agent.
The composite is the "capability score". It is never called IQ and is not
comparable to human test scores. Null and negative results are reported.
"""
