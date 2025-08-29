def is_int_like(x):
    try:
        if isinstance(x, int):
            return True
        if isinstance(x, str) and x.isdigit():
            return True
    except Exception:
        pass
    return False
