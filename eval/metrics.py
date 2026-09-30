"""Small, tested metric helpers shared by the evaluation scripts."""
import math


def pct_error(pred, ref):
    """Signed percentage error of pred against ref."""
    return (pred - ref) / ref * 100.0


def summarize(pairs):
    """pairs: list of (predicted, reference). Returns None if there are no usable pairs."""
    pairs = [(p, r) for p, r in pairs if p is not None and r is not None and r > 0]
    if not pairs:
        return None
    errs = [pct_error(p, r) for p, r in pairs]
    absn = [abs(e) for e in errs]
    return {
        "n": len(pairs),
        "MAPE_%": round(sum(absn) / len(absn), 2),
        "bias_%": round(sum(errs) / len(errs), 2),
        "worst_abs_%": round(max(absn), 2),
        "within_5%": round(100 * sum(a <= 5 for a in absn) / len(absn), 1),
        "within_2%": round(100 * sum(a <= 2 for a in absn) / len(absn), 1),
    }


def cv_percent(values):
    """Coefficient of variation in percent (sample standard deviation). None if fewer than 2 values."""
    v = [x for x in values if x is not None]
    if len(v) < 2:
        return None
    mean = sum(v) / len(v)
    sd = math.sqrt(sum((x - mean) ** 2 for x in v) / (len(v) - 1))
    return 100.0 * sd / mean if mean else None


def mean_of_shots_cv(values, k=3):
    """Expected CV of the mean of k independent shots, from the CV of single shots (assumes independent noise)."""
    c = cv_percent(values)
    return None if c is None else c / math.sqrt(k)
