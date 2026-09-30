"""Build a YOLO tile dataset from the classical counter's marks (PSEUDO-labels) or from corrected marks exported by the app.

Pseudo-labels only teach the detector to imitate the classical counter, so they cannot show it is BETTER. They are useful to
test the pipeline and to hold out a hand-counted tray as the honest test. Corrected marks (score_labels zip) are real labels.

Usage: python training/pseudo_dataset.py --train "B01,B03,B04" --out data/yolo_pseudo
"""
import argparse
import glob
import shutil
import sys
from pathlib import Path

import cv2
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
sys.path.append(str(ROOT / "api"))
from classical import SIZE_PROFILES, Params, detect, size_for_stage  # noqa: E402

TILE, STRIDE, BOX = 320, 256, 14
STAGE = {"B01": "PL10", "B02": "PL14", "B03": "PL12", "B04": "PL9"}


def marks_for(img, batch):
    """Classical marks inside the fitted outline (what the app would count)."""
    boxes, _ = detect(img, Params(tray="fit", **SIZE_PROFILES[size_for_stage(STAGE[batch])]))
    return np.c_[(boxes[:, 0] + boxes[:, 2]) / 2, (boxes[:, 1] + boxes[:, 3]) / 2]


def tiles(img, c, prefix, out_img, out_lab, keep_empty=0.1, rng=None):
    h, w = img.shape[:2]
    n = 0
    for y0 in list(range(0, max(1, h - TILE + 1), STRIDE)) + [h - TILE]:
        for x0 in list(range(0, max(1, w - TILE + 1), STRIDE)) + [w - TILE]:
            m = c[(c[:, 0] >= x0) & (c[:, 0] < x0 + TILE) & (c[:, 1] >= y0) & (c[:, 1] < y0 + TILE)]
            if len(m) == 0 and rng.random() > keep_empty:
                continue
            name = f"{prefix}_{x0}_{y0}"
            cv2.imwrite(str(out_img / f"{name}.jpg"), img[y0:y0 + TILE, x0:x0 + TILE], [cv2.IMWRITE_JPEG_QUALITY, 92])
            with open(out_lab / f"{name}.txt", "w") as f:
                for x, y in m:
                    f.write(f"0 {(x - x0) / TILE:.5f} {(y - y0) / TILE:.5f} {BOX / TILE:.5f} {BOX / TILE:.5f}\n")
            n += 1
    return n


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--train", default="B01,B03,B04")
    ap.add_argument("--out", default="data/yolo_pseudo")
    a = ap.parse_args()
    out = ROOT / a.out
    if out.exists():
        shutil.rmtree(out)
    rng = np.random.default_rng(0)
    batches = a.train.split(",")
    total = 0
    for split in ("train", "val"):
        (out / "images" / split).mkdir(parents=True)
        (out / "labels" / split).mkdir(parents=True)
    for b in batches:
        files = sorted(glob.glob(str(ROOT / "data" / "raw" / b / "*")))
        files = [f for f in files if f.lower().endswith((".jpg", ".jpeg", ".png", ".webp"))]
        for i, f in enumerate(files):
            img = cv2.imdecode(np.fromfile(f, np.uint8), cv2.IMREAD_COLOR)
            c = marks_for(img, b)
            split = "val" if i % 6 == 5 else "train"      # a photo-level split: monitoring only, the honest test is a held-out TRAY
            total += tiles(img, c, f"{b}_{i}", out / "images" / split, out / "labels" / split, rng=rng)
        print(b, len(files), "photos")
    (out / "data.yaml").write_text(f"path: {out.as_posix()}\ntrain: images/train\nval: images/val\nnames:\n  0: larva\n")
    print("tiles:", total, "->", out)


if __name__ == "__main__":
    main()
