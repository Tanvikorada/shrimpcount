"""Run the trained model over the TEST split and write counts.csv for evaluate_counts.py.

Manual counts come from data/manifest.csv (manual_count_a). Uses sliced inference.
Usage: python eval/predict_counts.py --weights runs/larva/weights/best.pt
Needs ultralytics. Run on Colab or wherever the weights are.
"""
import argparse
import csv
import sys
from pathlib import Path

import cv2
import numpy as np

sys.path.append(str(Path(__file__).resolve().parents[1] / "training"))
from tiling import sliced_detect  # noqa: E402


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--weights", required=True)
    ap.add_argument("--raw", default="data/raw")
    ap.add_argument("--manifest", default="data/manifest.csv")
    ap.add_argument("--splits", default="data/splits.csv")
    ap.add_argument("--split", default="test")
    ap.add_argument("--out", default="eval/out/counts.csv")
    ap.add_argument("--tile", type=int, default=640)
    ap.add_argument("--conf", type=float, default=0.25)
    args = ap.parse_args()

    from ultralytics import YOLO
    model = YOLO(args.weights)

    def detector(tile):
        r = model.predict(tile, imgsz=args.tile, conf=0.01, verbose=False)[0]
        return np.hstack([r.boxes.xyxy.cpu().numpy(), r.boxes.conf.cpu().numpy()[:, None]])

    manual = {r["image_file"]: r for r in csv.DictReader(open(args.manifest, encoding="utf-8"))}
    rows = []
    for r in csv.DictReader(open(args.splits, encoding="utf-8")):
        if r["split"] != args.split or not manual[r["image_file"]]["manual_count_a"]:
            continue
        img = cv2.imread(str(Path(args.raw) / r["image_file"]))
        n = len(sliced_detect(img, detector, tile=args.tile, conf=args.conf))
        rows.append([r["image_file"], manual[r["image_file"]]["manual_count_a"], n])

    Path(args.out).parent.mkdir(parents=True, exist_ok=True)
    with open(args.out, "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["image_file", "manual_count", "predicted_count"])
        w.writerows(rows)
    print(f"{len(rows)} images -> {args.out}. Next: python eval/evaluate_counts.py {args.out}")


if __name__ == "__main__":
    main()
