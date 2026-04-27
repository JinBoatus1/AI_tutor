from .grader import AutoGraderBase

_autograder: AutoGraderBase | None = None


def register_autograder(autograder: AutoGraderBase) -> None:
    """Register a concrete AutoGrader implementation for later injection at startup."""
    global _autograder
    _autograder = autograder


def get_autograder() -> AutoGraderBase:
    """Get the registered AutoGrader instance."""
    if _autograder is None:
        raise RuntimeError("AutoGrader has not been registered yet; call register_autograder() during startup first.")
    return _autograder


def has_autograder() -> bool:
    return _autograder is not None


# TODO: Add default-implementation selection logic or a config-driven factory here later.
