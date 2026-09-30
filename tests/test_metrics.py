import sys
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parents[1] / "eval"))
from metrics import cv_percent, mean_of_shots_cv, pct_error, summarize  # noqa: E402


def test_pct_error_sign():
    assert pct_error(105, 100) == 5.0
    assert pct_error(95, 100) == -5.0


def test_summarize_counts_within_thresholds():
    s = summarize([(101, 100), (104, 100), (90, 100), (100, 100)])
    assert s["n"] == 4
    assert s["MAPE_%"] == 3.75          # (1 + 4 + 10 + 0) / 4
    assert s["within_5%"] == 75.0       # 1, 4, 0 are within 5; 10 is not
    assert s["within_2%"] == 50.0
    assert s["worst_abs_%"] == 10.0


def test_summarize_ignores_missing_references():
    assert summarize([(100, None), (None, 100), (5, 0)]) is None
    assert summarize([(100, None), (110, 100)])["n"] == 1


def test_cv_and_mean_of_shots():
    assert cv_percent([100]) is None
    assert round(cv_percent([90, 100, 110]), 2) == 10.0
    assert round(mean_of_shots_cv([90, 100, 110], 4), 2) == 5.0
