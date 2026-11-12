"""Score a hatchery field test straight from the app's "Download CSV" (Count history).

In the app, on each count the operator can enter their own hand count of the same tray (Details, "Your hand count") and,
if they have it, another app's count. This script reads that CSV and reports how close the counter is to the hand counts:
  - counter_result  = the automatic count before the operator touched any marks
  - final_count     = the count after the operator's corrections
  - other_app_count = another app's count, when entered
Only rows with a hand count are scored. Nothing is invented: with no hand counts it says so and prints no accuracy figure.

Usage: python eval/field_test_report.py path/to/counts.csv [more.csv ...]
"""
import csv
import sys
from collections import defaultdict
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parent))
from metrics import summarize  # noqa: E402


def num(v):
    try:
        x = float(v)
        return x if x > 0 else None
    except (TypeError, ValueError):
        return None


def load_rows(paths):
    rows = []
    for p in paths:
        with open(p, encoding="utf-8", newline="") as f:
            rows += list(csv.DictReader(f))
    return rows


def per_tray(rows):
    """Photos of one tray are averaged into one value, as the app does. Rows without a tray id stand alone."""
    groups = defaultdict(list)
    for i, r in enumerate(rows):
        groups[r.get("tray_id") or f"row{i}"].append(r)
    out = []
    for g in groups.values():
        def mean(key):
            v = [num(r.get(key)) for r in g if num(r.get(key))]
            return sum(v) / len(v) if v else None
        out.append({"counter": mean("counter_result"), "final": mean("final_count"), "manual": mean("manual_count"), "other": mean("other_app_count"), "clump": mean("clump_fraction"), "photos": len(g)})
    return out


def line(title, s):
    if s is None:
        return f"{title}: no pairs yet"
    return (f"{title}: trays={s['n']}  average error {s['MAPE_%']}%  bias {s['bias_%']:+}% (negative = counter reads low)  "
            f"worst {s['worst_abs_%']}%  within 5%: {s['within_5%']}%  within 2%: {s['within_2%']}%")


CLUMP_WARN = 0.30   # the app's "may read low" notice (web/src/screens/Count.jsx); set from three trays, to be checked here


def clump_check(trays):
    """Does the app's clumping figure really separate the trays that read low from those that do not? Compares the bias of
    trays at or above the notice threshold with those below. Reports only what the data shows; needs both groups."""
    hi = [t for t in trays if t["clump"] is not None and t["clump"] >= CLUMP_WARN]
    lo = [t for t in trays if t["clump"] is not None and t["clump"] < CLUMP_WARN]
    if not hi or not lo:
        return [f"Clumping check: needs trays on both sides of {CLUMP_WARN} (now {len(hi)} at or above, {len(lo)} below) before it can say anything."]
    out = ["Clumping check (does the 'may read low' notice pick the right trays?):"]
    for name, g in (("  notice shown  ", hi), ("  no notice     ", lo)):
        s = summarize([(t["counter"], t["manual"]) for t in g])
        out.append(f"{name}: trays={s['n']}  bias {s['bias_%']:+}%  average error {s['MAPE_%']}%")
    return out


def report(rows):
    trays = per_tray(rows)
    with_manual = [t for t in trays if t["manual"]]
    lines = [f"{len(rows)} photos, {len(trays)} trays, {len(with_manual)} trays with a hand count."]
    if not with_manual:
        lines.append("No hand counts entered, so there is no accuracy figure. Enter 'Your hand count' in Details when saving a count.")
        return "\n".join(lines)
    lines.append(line("Counter (automatic) vs hand count  ", summarize([(t["counter"], t["manual"]) for t in trays])))
    lines.append(line("Final (after corrections) vs hand  ", summarize([(t["final"], t["manual"]) for t in trays])))
    lines.append(line("Other app vs hand count            ", summarize([(t["other"], t["manual"]) for t in trays])))
    lines.append(line("Counter vs other app               ", summarize([(t["counter"], t["other"]) for t in trays])))
    lines.extend(clump_check(with_manual))
    if len(with_manual) < 15:
        lines.append(f"Only {len(with_manual)} trays with a hand count. Fewer than about 15 different trays is too few to trust these percentages.")
    lines.append("Note: one person's hand count is itself uncertain by several percent. Have two people count and enter the average.")
    return "\n".join(lines)


if __name__ == "__main__":
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    print(report(load_rows(sys.argv[1:])))
