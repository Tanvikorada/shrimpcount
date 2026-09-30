"""Compare ShrimpCount with manual counts and the reference app counts on the photos in data/manifest.csv.

Runs the classical counter over every row. Then, ONLY where the numbers exist:
  - ShrimpCount vs manual, ShrimpCount vs the reference app, the reference app vs manual (error %, within 5% / within 2%);
  - repeatability: how much the count varies between photos of the same tray (rows sharing a sample_id).
With no manual or the reference app numbers it prints repeatability only and says so. It never invents a reference.

Usage: python eval/compare_counts.py [--manifest data/manifest.csv] [--raw data/raw] [--out eval/out/comparison.csv]
"""
import argparse
import csv
import sys
from collections import defaultdict
from pathlib import Path

import cv2
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
sys.path.append(str(ROOT / "api"))
sys.path.append(str(ROOT / "eval"))
from classical import SIZE_PROFILES, Params, detect, size_for_stage  # noqa: E402
from metrics import cv_percent, mean_of_shots_cv, summarize  # noqa: E402


def num(v):
    try:
        x = float(v)
        return x if x > 0 else None
    except (TypeError, ValueError):
        return None


def show(title, s):
    if s is None:
        print(f"{title}: no data yet")
    else:
        print(f"{title}: n={s['n']}  MAPE {s['MAPE_%']}%  bias {s['bias_%']:+}%  worst {s['worst_abs_%']}%  "
              f"within 5%: {s['within_5%']}%  within 2%: {s['within_2%']}%")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--manifest", default="data/manifest.csv")
    ap.add_argument("--raw", default="data/raw")
    ap.add_argument("--out", default="eval/out/comparison.csv")
    ap.add_argument("--reference-typical", type=float, default=None,
                    help="the reference app's typical count for these photos when per-photo values are not known (for example 1850)")
    args = ap.parse_args()

    rows = list(csv.DictReader(open(args.manifest, encoding="utf-8")))
    out = []
    for r in rows:
        img = cv2.imdecode(np.fromfile(str(Path(args.raw) / r["image_file"]), np.uint8), cv2.IMREAD_COLOR)
        if img is None:
            print("could not read", r["image_file"])
            continue
        size = size_for_stage(r.get("pl_stage"))       # larger larvae (PL13 and up) use the large setting, as the app does
        boxes, _ = detect(img, Params(tray="fit", **SIZE_PROFILES[size]))   # same as the app: count inside the tray only
        out.append({"image_file": r["image_file"], "sample_id": r.get("sample_id", ""),
                    "manual": num(r.get("manual_count_a")), "reference": num(r.get("reference_count")), "shrimpcount": len(boxes)})

    Path(args.out).parent.mkdir(parents=True, exist_ok=True)
    with open(args.out, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=["image_file", "sample_id", "manual", "reference", "shrimpcount"])
        w.writeheader()
        w.writerows(out)

    print(f"{len(out)} photos counted. Table: {args.out}\n")
    show("ShrimpCount vs manual ", summarize([(o["shrimpcount"], o["manual"]) for o in out]))
    show("ShrimpCount vs the reference app ", summarize([(o["shrimpcount"], o["reference"]) for o in out]))
    show("the reference app vs manual      ", summarize([(o["reference"], o["manual"]) for o in out]))
    if args.reference_typical:
        ref = args.reference_typical
        errs = [abs((o["shrimpcount"] - ref) / ref * 100) for o in out]
        mean = sum(o["shrimpcount"] for o in out) / len(out)
        print(f"ShrimpCount vs the reference app typical {ref:.0f}: mean {mean:.0f} ({(mean-ref)/ref*100:+.1f}%), "
              f"photos within 5%: {100*sum(e <= 5 for e in errs)/len(errs):.0f}%, within 10%: {100*sum(e <= 10 for e in errs)/len(errs):.0f}% "
              f"(a typical value, not per-photo counts)")
    if not any(o["manual"] for o in out):
        print("\nNo manual counts in the manifest, so there is no accuracy figure. Add manual_count_a to get one.")

    groups = defaultdict(list)
    for o in out:
        groups[o["sample_id"] or "(no sample_id: treated as one group)"].append(o["shrimpcount"])
    print("\nRepeatability (photos of the same tray should give the same count):")
    for g, v in groups.items():
        c = cv_percent(v)
        if c is None:
            print(f"  {g}: {len(v)} photo, cannot measure")
        else:
            print(f"  {g}: {len(v)} photos, mean {sum(v)/len(v):.0f}, spread (CV) {c:.1f}%, range {min(v)}-{max(v)}"
                  f"; average of 3 shots would vary about {mean_of_shots_cv(v, 3):.1f}% if the noise is independent")
    print("\nNote: if the group mixes more than one tray, the spread includes real differences between trays.")


if __name__ == "__main__":
    main()
