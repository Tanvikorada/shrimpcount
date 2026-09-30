"""Run the classical counter over images and save overlays so a person can judge it by eye.

Usage: python tools/preview_counts.py [--raw data/raw] [--out eval/out/preview] [--min-area 8 ...]
Prints one count per image. These are the counter's outputs, NOT accuracy: compare against manual counts to measure that.
"""
import argparse
import sys
from pathlib import Path

import cv2
import numpy as np

sys.path.append(str(Path(__file__).resolve().parents[1] / "api"))
from classical import Params, detect  # noqa: E402

EXTS = {".jpg", ".jpeg", ".png", ".webp"}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--raw", default="data/raw")
    ap.add_argument("--out", default="eval/out/preview")
    ap.add_argument("--min-area", type=float, default=None)
    ap.add_argument("--min-contrast", type=float, default=None)
    args = ap.parse_args()

    p = Params()
    if args.min_area:
        p.min_area = args.min_area
    if args.min_contrast:
        p.min_contrast = args.min_contrast
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)

    for f in sorted(x for x in Path(args.raw).rglob("*") if x.suffix.lower() in EXTS):
        img = cv2.imdecode(np.fromfile(str(f), np.uint8), cv2.IMREAD_COLOR)
        boxes, meta = detect(img, p)
        vis = img.copy()
        for x1, y1, x2, y2, s in boxes:
            cv2.circle(vis, (int((x1 + x2) / 2), int((y1 + y2) / 2)), 7, (0, 0, 255) if s >= 1 else (255, 0, 0), 1)
        cv2.imencode(".jpg", vis)[1].tofile(str(out / f"{f.parent.name}_{f.stem}.jpg"))
        print(f"{f.parent.name}/{f.name}: {len(boxes)} counted  (strong {meta['strong']}, weak round {meta['weak_round']})")


if __name__ == "__main__":
    main()
