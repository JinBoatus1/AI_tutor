from .grader import AutoGraderBase, PlaceholderAutoGrader

_autograder: AutoGraderBase | None = None


def get_autograder() -> AutoGraderBase:
    global _autograder
    if _autograder is None:
        _autograder = PlaceholderAutoGrader()
    return _autograder
