"""Shared mind package: types, features, handoff schema, and the minds.

Dependency rule (SPEC D13): this package imports only the standard library,
numpy and pydantic; ``mind.learned`` additionally imports torch. It never
imports CivSYS (``app``), ``whiteroom``, ``growth`` or ``battery``.
"""
