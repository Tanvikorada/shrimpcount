import sys
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parents[1] / "eval"))
from field_test_report import per_tray, report  # noqa: E402


def row(tray, counter, final, manual="", other=""):
    return {"tray_id": tray, "counter_result": counter, "final_count": final, "manual_count": manual, "other_app_count": other}


def test_says_so_when_there_are_no_hand_counts():
    out = report([row("a", 1700, 1700)])
    assert "no accuracy figure" in out.lower()
    assert "%" not in out.split("\n")[1]  # no invented percentage


def test_scores_the_counter_against_hand_counts_per_tray():
    rows = [row("a", 1800, 1800, 2000), row("b", 1000, 1000, 1000), row("c", 900, 950, 1000, 1000)]
    out = report(rows)
    assert "3 trays" in out
    # errors: -10%, 0%, -10%  -> average 6.67% and negative bias
    assert "average error 6.67%" in out
    assert "bias -6.67%" in out
    assert "Only 3 trays" in out  # warns that this is far too few


def test_photos_of_one_tray_are_averaged():
    trays = per_tray([row("t", 1700, 1700, 1800), row("t", 1800, 1800, 1800)])
    assert len(trays) == 1 and trays[0]["counter"] == 1750 and trays[0]["photos"] == 2
