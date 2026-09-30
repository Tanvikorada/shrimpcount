"""Train the YOLO tile detector on ALL photos, using the real counts we have, and test it leave-one-tray-out.

We have no mark-level truth, only tray totals (B02 1800, B03 1797, B05 1750). So labels are the classical counter's marks,
CALIBRATED to each photo's real total: if the counter is below the real count, the strongest sub-threshold candidates are added
until the total matches; if above, the weakest marks are dropped. Photos with no real count (B01, B04) keep the plain marks.
This uses every count we have, but the added marks are still guesses about WHERE the missed larvae are.

Fair test: for each counted tray T, train on everything except T, then count T. The default confidence is used (no tuning on T).
Usage: .venv-train/Scripts/python.exe training/count_calibrated.py [--epochs 20]
"""
import argparse
import glob
import json
import shutil
import sys
from pathlib import Path

import cv2
import numpy as np
from ultralytics import YOLO

ROOT = Path(__file__).resolve().parents[1]
sys.path.append(str(ROOT / "api"))
sys.path.append(str(ROOT / "eval"))
sys.path.append(str(ROOT / "training"))
from classical import SIZE_PROFILES, Params, detect  # noqa: E402
from pseudo_dataset import tiles  # noqa: E402
import yolo_vs_classical as yv  # noqa: E402

# batch -> (larva size profile, real count of the tray or None)
TRAYS = {"B01": ("small", None), "B02": ("large", 1800), "B03": ("small", 1797), "B04": ("small", None), "B05": ("small", 1750)}
TIERS = [dict(dog_thr=8, dog_thr_weak=4), dict(dog_thr=7, dog_thr_weak=3.5), dict(dog_thr=6, dog_thr_weak=3), dict(dog_thr=5, dog_thr_weak=2.5)]


def centres(b):
    return np.c_[(b[:, 0] + b[:, 2]) / 2, (b[:, 1] + b[:, 3]) / 2] if len(b) else np.zeros((0, 2))


def calibrated_marks(img, size, real):
    base_boxes, _ = detect(img, Params(tray="fit", **SIZE_PROFILES[size]))
    base = centres(base_boxes)
    if real is None:
        return base, len(base), len(base)
    if len(base) > real:                                                     # drop the weakest (weak-round, then hidden) first
        order = np.argsort(-base_boxes[:, 4], kind="stable")                # strongest first
        return base[order[:real]], len(base), real
    marks = list(base)
    for tier in TIERS:                                                       # add the strongest sub-threshold candidates first
        if len(marks) >= real:
            break
        prof = dict(SIZE_PROFILES[size]); prof.update(tier)
        cand = centres(detect(img, Params(tray="fit", **prof))[0])
        cur = np.array(marks)
        d = np.hypot(cand[:, None, 0] - cur[None, :, 0], cand[:, None, 1] - cur[None, :, 1]).min(1)
        extra = cand[d > 6]
        need = real - len(marks)
        if len(extra) > need:
            extra = extra[np.random.default_rng(0).permutation(len(extra))[:need]]
        marks += list(extra)
    return np.array(marks), len(base), len(marks)


def build(train_batches, out, log):
    if out.exists():
        shutil.rmtree(out)
    for s in ("train", "val"):
        (out / "images" / s).mkdir(parents=True); (out / "labels" / s).mkdir(parents=True)
    rng = np.random.default_rng(0)
    total = 0
    for b in train_batches:
        size, real = TRAYS[b]
        files = sorted(f for f in glob.glob(str(ROOT / "data" / "raw" / b / "*")) if f.lower().endswith((".jpg", ".jpeg", ".png", ".webp")))
        for i, f in enumerate(files):
            img = cv2.imdecode(np.fromfile(f, np.uint8), cv2.IMREAD_COLOR)
            key = (b, f)
            if key not in CACHE:
                CACHE[key] = calibrated_marks(img, size, real)
            m, was, now = CACHE[key]
            log(f"   label {b} {Path(f).name[:12]:12s} counter {was} -> labels {now}")
            total += tiles(img, m, f"{b}_{i}", out / "images" / ("val" if i % 6 == 5 else "train"), out / "labels" / ("val" if i % 6 == 5 else "train"), rng=rng)
    (out / "data.yaml").write_text(f"path: {out.as_posix()}\ntrain: images/train\nval: images/val\nnames:\n  0: larva\n")
    return total


CACHE = {}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--epochs", type=int, default=20)
    a = ap.parse_args()
    logf = open(ROOT / "eval" / "out" / "count_calibrated.log", "a", encoding="utf-8")

    def log(s):
        print(s, flush=True); logf.write(s + "\n"); logf.flush()

    results = {}
    folds = [b for b in TRAYS if TRAYS[b][1] is not None] + ["ALL"]
    for fold in folds:
        train_b = [b for b in TRAYS if b != fold]
        log(f"=== fold: hold out {fold}; train on {train_b}")
        out = ROOT / "data" / f"yolo_cal_{fold}"
        n = build(train_b, out, lambda s: None)
        log(f"   tiles: {n}")
        model = YOLO("yolo11n.pt")
        model.train(data=str(out / "data.yaml"), imgsz=320, epochs=a.epochs, batch=32, workers=4, device="cpu", project=str(ROOT / "runs" / "cal"), name=fold,
                    exist_ok=True, patience=10, mosaic=0.5, flipud=0.5, fliplr=0.5, degrees=90, hsv_h=0.0, hsv_s=0.2, hsv_v=0.3, max_det=800, plots=False, verbose=False)
        best = YOLO(str(Path(model.trainer.best)))
        if fold == "ALL":
            log(f"   final model (trained on everything, cannot be tested fairly): {model.trainer.best}")
            continue
        size, real = TRAYS[fold]
        files = sorted(f for f in glob.glob(str(ROOT / "data" / "raw" / fold / "*")) if f.lower().endswith((".jpg", ".jpeg", ".png", ".webp")))
        cls_n, yol_n = [], []
        for f in files:
            img = cv2.imdecode(np.fromfile(f, np.uint8), cv2.IMREAD_COLOR)
            h, w = img.shape[:2]
            cls_n.append(len(detect(img, Params(tray="fit", **SIZE_PROFILES[size]))[0]))
            c = yv.yolo_points(best, img, 0.25)
            from classical import fit_tray, refine_tray_by_marks
            poly = np.array([(x * (w - 1), y * (h - 1)) for x, y in refine_tray_by_marks(fit_tray(img)[0], c, w, h)], np.float32).reshape(-1, 1, 2)
            yol_n.append(int(sum(cv2.pointPolygonTest(poly, (float(p[0]), float(p[1])), False) >= 0 for p in c)))
        r = dict(real=real, classical_mean=float(np.mean(cls_n)), yolo_mean=float(np.mean(yol_n)), n=len(files),
                 classical_err=100 * (np.mean(cls_n) - real) / real, yolo_err=100 * (np.mean(yol_n) - real) / real,
                 classical_cv=100 * float(np.std(cls_n) / np.mean(cls_n)), yolo_cv=100 * float(np.std(yol_n) / np.mean(yol_n)))
        results[fold] = r
        log(f"   RESULT {fold}: real {real}  classical {r['classical_mean']:.0f} ({r['classical_err']:+.1f}%, cv {r['classical_cv']:.1f}%)  "
            f"yolo {r['yolo_mean']:.0f} ({r['yolo_err']:+.1f}%, cv {r['yolo_cv']:.1f}%)  n={len(files)}")
    (ROOT / "eval" / "out" / "count_calibrated.json").write_text(json.dumps(results, indent=1))
    log("DONE")


if __name__ == "__main__":
    main()
