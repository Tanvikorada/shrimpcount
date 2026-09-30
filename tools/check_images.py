"""Quality check for raw hatchery images. Flags problems so bad photos are caught before labeling.

Checks: resolution, blur (variance of Laplacian), brightness, glare (fraction of saturated pixels),
exact/near duplicates (average hash), and consistency of resolution across the set.
Thresholds are starting points. Tune them once you have looked at real images.

Usage: python tools/check_images.py [--raw data/raw] [--out data/quality_report.csv]
"""
import argparse
import csv
from collections import Counter
from pathlib import Path

import cv2
import numpy as np

EXTS = {".jpg", ".jpeg", ".png", ".webp", ".tif", ".tiff"}
MIN_SIDE = 1200          # px, shorter side (phone originals are far larger; WhatsApp copies are 1280)
BLUR_MIN = 15.0          # Laplacian variance on a 1024px-wide copy (larvae are faint, so real photos score low)
BRIGHT_RANGE = (90, 240) # mean gray level
GLARE_MAX = 0.02         # fraction of pixels >= 250
DUP_DIFF = 2.0           # mean grey-level difference at 128x128 below which two files are the same photo


def ahash(gray: np.ndarray) -> int:
    small = cv2.resize(gray, (8, 8), interpolation=cv2.INTER_AREA)
    bits = (small > small.mean()).flatten()
    return int("".join("1" if b else "0" for b in bits), 2)


def analyse(path: Path) -> dict:
    img = cv2.imdecode(np.fromfile(str(path), dtype=np.uint8), cv2.IMREAD_COLOR)
    if img is None:
        return {"file": path.as_posix(), "error": "unreadable"}
    h, w = img.shape[:2]
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    scale = 1024 / max(w, 1)
    small = cv2.resize(gray, (1024, max(1, int(h * scale)))) if w != 1024 else gray
    return {
        "file": path.as_posix(), "width": w, "height": h,
        "blur": round(float(cv2.Laplacian(small, cv2.CV_64F).var()), 1),
        "brightness": round(float(gray.mean()), 1),
        "glare": round(float((gray >= 250).mean()), 4),
        "small": cv2.resize(gray, (128, 128), interpolation=cv2.INTER_AREA).astype(np.float32),
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--raw", default="data/raw")
    ap.add_argument("--out", default="data/quality_report.csv")
    args = ap.parse_args()

    files = sorted(p for p in Path(args.raw).rglob("*") if p.suffix.lower() in EXTS)
    if not files:
        print(f"No images under {args.raw}.")
        return
    rows = [analyse(p) for p in files]
    ok = [r for r in rows if "error" not in r]

    sizes = Counter((r["width"], r["height"]) for r in ok)
    common = sizes.most_common(1)[0][0] if sizes else None

    for i, r in enumerate(rows):
        flags = []
        if "error" in r:
            r["flags"] = "unreadable"
            continue
        if min(r["width"], r["height"]) < MIN_SIDE:
            flags.append("low_res")
        if (r["width"], r["height"]) != common:
            flags.append("odd_size")
        if r["blur"] < BLUR_MIN:
            flags.append("blurry")
        if not BRIGHT_RANGE[0] <= r["brightness"] <= BRIGHT_RANGE[1]:
            flags.append("bad_exposure")
        if r["glare"] > GLARE_MAX:
            flags.append("glare")
        for other in rows[:i]:
            if "small" in other and float(np.abs(r["small"] - other["small"]).mean()) < DUP_DIFF:
                flags.append(f"same_photo_as:{Path(other['file']).name}")
                break
        r["flags"] = ";".join(flags)

    keys = ["file", "width", "height", "blur", "brightness", "glare", "flags"]
    with open(args.out, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=keys, extrasaction="ignore")
        w.writeheader()
        w.writerows(rows)

    flagged = [r for r in rows if r.get("flags")]
    print(f"{len(rows)} images checked, {len(flagged)} flagged. Most common size: {common}. Report: {args.out}")
    for tag, n in Counter(t.split(":")[0] for r in flagged for t in r["flags"].split(";")).most_common():
        print(f"  {tag}: {n}")


if __name__ == "__main__":
    main()
