"""Make a one-page demo image: the counter's marks on three of the hatchery's own photos.

The sheet says plainly that this is a pilot and that accuracy has not been measured. Do not edit that line out.
Usage: python tools/make_demo_sheet.py [photo1 photo2 photo3] [--out eval/out/demo_sheet.png]
"""
import argparse
import sys
from pathlib import Path

import cv2
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
sys.path.append(str(ROOT / "api"))
from classical import Params, detect  # noqa: E402

DEFAULT = ["data/raw/B01/2.jpg", "data/raw/B01/3.jpg", "data/raw/B01/4.jpg"]
INK, TEAL, MUTED = (49, 43, 13), (92, 79, 11), (105, 98, 79)      # BGR of #0d2b31, #0b4f5c, #4f6266


def put(img, text, org, scale, color, thick=1):
    cv2.putText(img, text, org, cv2.FONT_HERSHEY_SIMPLEX, scale, color, thick, cv2.LINE_AA)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("photos", nargs="*", default=DEFAULT)
    ap.add_argument("--out", default="eval/out/demo_sheet.png")
    a = ap.parse_args()

    panel = 620
    tiles, counts = [], []
    for f in a.photos:
        img = cv2.imdecode(np.fromfile(str(ROOT / f), np.uint8), cv2.IMREAD_COLOR)
        boxes, _ = detect(img, Params())
        h, w = img.shape[:2]
        vis = cv2.resize(img, (panel, int(round(h * panel / w))), interpolation=cv2.INTER_AREA)
        k = panel / w
        for x1, y1, x2, y2, s in boxes:
            cv2.circle(vis, (int((x1 + x2) / 2 * k), int((y1 + y2) / 2 * k)), 3, (40, 40, 235), -1)
        tiles.append(vis)
        counts.append(len(boxes))

    gap, pad, head, foot = 16, 28, 150, 120
    th = max(t.shape[0] for t in tiles)
    W = pad * 2 + panel * len(tiles) + gap * (len(tiles) - 1)
    H = head + th + 70 + foot
    sheet = np.full((H, W, 3), (234, 243, 246), np.uint8)               # sand
    put(sheet, "ShrimpCount", (pad, 60), 1.5, TEAL, 3)
    put(sheet, "Counting shrimp postlarvae from a tray photo: pilot hatchery photos", (pad, 100), 0.7, INK, 1)
    put(sheet, "Each red dot is a larva head the counter found.", (pad, 130), 0.6, MUTED, 1)
    x = pad
    for t, c in zip(tiles, counts):
        sheet[head:head + t.shape[0], x:x + panel] = t
        put(sheet, f"Counted: {c:,}", (x, head + th + 45), 1.0, INK, 2)
        x += panel + gap
    put(sheet, "PILOT. Accuracy has not yet been measured against manual counts, and no accuracy figure is claimed.",
        (pad, H - 70), 0.68, (20, 60, 150), 2)
    put(sheet, "Counts are from a baseline counter on compressed WhatsApp copies of the photos.", (pad, H - 36), 0.6, MUTED, 1)
    out = ROOT / a.out
    out.parent.mkdir(parents=True, exist_ok=True)
    cv2.imencode(".png", sheet)[1].tofile(str(out))
    print("wrote", out, counts)


if __name__ == "__main__":
    main()
