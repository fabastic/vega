"""Flag-gated focal-agent upgrades for the white-room pathway (SPEC section A).

Nothing here runs unless FocalConfig.enabled is True. No existing CivSYS file
is modified; FocalSimulationEngine subclasses SimulationEngine.
This is the only CivSYS package that imports mind/, and it never imports
mind.learned (torch) itself (SPEC D13).
"""
