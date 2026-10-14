"""Physiology constants as hard-coded inline in CivSYS (SPEC D11).

Source lines: humans/needs.py 21-39, economy/production.py 35-37,
civilization/lifecycle.py 31. tests/focal/test_physiology.py measures one real
tick and one eat action and checks every value, so these cannot drift.
"""
PHYSIOLOGY = {
    "hunger_per_tick": 0.008,
    "thirst_per_tick": 0.015,
    "sleep_per_tick": 0.02,
    "energy_loss_active": 0.015,
    "energy_gain_rest": 0.1,
    "sleep_relief_rest": 0.2,
    "health_loss": 0.02,
    "hunger_damage_threshold": 0.85,
    "thirst_damage_threshold": 0.92,
    "starvation_threshold": 0.95,
    "eat_hunger_relief": 0.4,
    "eat_thirst_relief": 0.4,
    "eat_health_gain": 0.02,
}
