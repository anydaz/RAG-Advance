import os

_DEV_PREFIX = "develop_"


def is_local() -> bool:
    return os.environ.get("APP_ENV", "").lower() == "local"


def prefixed(name: str) -> str:
    return f"{_DEV_PREFIX}{name}" if is_local() else name
