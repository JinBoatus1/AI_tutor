from .grader import AutoGraderBase

_autograder: AutoGraderBase | None = None


def register_autograder(autograder: AutoGraderBase) -> None:
    """注册具体的 AutoGrader 实现，便于后续在启动阶段注入。"""
    global _autograder
    _autograder = autograder


def get_autograder() -> AutoGraderBase:
    """获取已注册的 AutoGrader 实例。"""
    if _autograder is None:
        raise RuntimeError("AutoGrader 尚未注册，请先在启动流程中调用 register_autograder()。")
    return _autograder


def has_autograder() -> bool:
    return _autograder is not None


# TODO: 后续可在这里加入默认实现选择逻辑或配置驱动的工厂。
