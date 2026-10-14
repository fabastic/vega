"""World arms (SPEC E.1). civ_control runs in CivSYS, not here."""
ROOM_ARMS = ("furnished_room", "exteroception_removed", "full_deprivation", "fade_out", "noise_only")
ALL_ARMS = ("civ_control",) + ROOM_ARMS

ARM_SPEC = {
    # arm:                  (exteroception mode, feedback)
    "furnished_room":        ("furnished", "full"),
    "exteroception_removed": ("off", "proprioceptive"),
    "full_deprivation":      ("off", "none"),
    "fade_out":              ("fade", "full"),        # feedback becomes "none" once lambda reaches 0
    "noise_only":            ("noise", "none"),
}


def fade_lambda(tau: int, fade_ticks: int) -> float:
    return max(0.0, 1.0 - tau / float(fade_ticks))


def feedback_for(arm: str, tau: int, fade_ticks: int) -> str:
    ext, fb = ARM_SPEC[arm]
    if ext == "fade" and fade_lambda(tau, fade_ticks) <= 0.0:
        return "none"
    return fb
