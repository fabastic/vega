"""v1 growth operations: fixed-size increments of countable structure (SPEC I.2)."""


def apply(handles, kind, step, random_init=False, dry_run=False):
    if dry_run:
        return None   # v1 has no parameter/compute caps
    handles.grow(kind, step)
    return {}
