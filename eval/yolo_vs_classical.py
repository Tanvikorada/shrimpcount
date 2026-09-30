"""Compare a trained YOLO tile detector with the classical counter on a HELD-OUT tray with a hand count.

Rule fixed before running: the YOLO is used only if, on the held-out tray, its mean count is closer to the hand count than the
classical counter's AND its spread between photos is no worse. One tray is weak evidence; say so when quoting.

Usage: python eval/yolo_vs_classical.py runs/larva/weights/best.pt --batch B02 --hand 1800 --size large
"""
import argparse
import glob
import sys
from pathlib import Path

import cv2
import numpy as np
from ultralytics import YOLO

ROOT = Path(__file__).resolve().parents[1]
sys.path.append(str(ROOT / "api"))
from classical import SIZE_PROFILES, Params, detect, fit_tray, refine_tray_by_marks  # noqa: E402

TILE, STRIDE = 320, 256


def yolo_points(model, img, conf):
    h, w = img.shape[:2]
    xs = list(range(0, max(1, w - TILE + 1), STRIDE)) + [w - TILE]
    ys = list(range(0, max(1, h - TILE + 1), STRIDE)) + [h - TILE]
    tiles, origin = [], []
    for y0 in ys:
        for x0 in xs:
            tiles.append(img[y0:y0 + TILE, x0:x0 + TILE]); origin.append((x0, y0))
    boxes, scores = [], []
    for i in range(0, len(tiles), 16):
        for r, (x0, y0) in zip(model.predict(tiles[i:i + 16], imgsz=TILE, conf=conf, iou=0.5, max_det=800, verbose=False), origin[i:i + 16]):
            for b, s in zip(r.boxes.xyxy.cpu().numpy(), r.boxes.conf.cpu().numpy()):
                boxes.append([b[0] + x0, b[1] + y0, b[2] - b[0], b[3] - b[1]]); scores.append(float(s))
    if not boxes:
        return np.zeros((0, 2))
    keep = cv2.dnn.NMSBoxes(boxes, scores, conf, 0.3)                    # tiles overlap: drop the twin of a larva seen twice
    b = np.array(boxes)[np.array(keep).reshape(-1)]
    return np.c_[b[:, 0] + b[:, 2] / 2, b[:, 1] + b[:, 3] / 2]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("weights")
    ap.add_argument("--batch", required=True)
    ap.add_argument("--hand", type=float, required=True)
    ap.add_argument("--size", default="small")
    ap.add_argument("--conf", type=float, default=0.25)
    a = ap.parse_args()
    model = YOLO(a.weights)
    files = sorted(f for f in glob.glob(str(ROOT / "data" / "raw" / a.batch / "*")) if f.lower().endswith((".jpg", ".jpeg", ".png", ".webp")))
    cls_n, yol_n = [], []
    for f in files:
        img = cv2.imdecode(np.fromfile(f, np.uint8), cv2.IMREAD_COLOR)
        h, w = img.shape[:2]
        cls_n.append(len(detect(img, Params(tray="fit", **SIZE_PROFILES[a.size]))[0]))
        c = yolo_points(model, img, a.conf)
        norm = refine_tray_by_marks(fit_tray(img)[0], c, w, h)
        poly = np.array([(x * (w - 1), y * (h - 1)) for x, y in norm], np.float32).reshape(-1, 1, 2)
        inside = [cv2.pointPolygonTest(poly, (float(p[0]), float(p[1])), False) >= 0 for p in c]
        yol_n.append(int(sum(inside)))
        print(Path(f).name[:14].ljust(14), "classical", cls_n[-1], " yolo", yol_n[-1], flush=True)
    for name, v in (("classical", cls_n), ("yolo", yol_n)):
        v = np.array(v, float)
        print(f"{name:9s} mean {v.mean():7.1f}  error vs hand {100 * (v.mean() - a.hand) / a.hand:+5.1f}%  spread {100 * v.std() / v.mean():.1f}%  n={len(v)}")


if __name__ == "__main__":
    main()
