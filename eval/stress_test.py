"""Stress test of the counter with KNOWN counts, built from the hatchery's own photos.

Real, isolated larvae are cut out of the photos and pasted (with their real translucency, at random rotation) onto the
tray's own empty-water background, at chosen densities. Overlap is then controlled and the true count is known.

THIS IS A SYNTHETIC TEST. It finds where the counter breaks (dense overlap, near the flash). It is NOT an accuracy
figure for the product: only manual counts of real trays can give that. Never quote these numbers as accuracy.

Usage: python eval/stress_test.py [--counts 800,1700,3000,5000] [--seeds 3]
"""
import argparse
import sys
from pathlib import Path

import cv2
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
sys.path.append(str(ROOT / "api"))
from classical import Params, detect, preset_tray  # noqa: E402

PATCH = 65
def _sources():
    files = sorted((ROOT / "data" / "raw" / "B01").glob("*"))[1:13]          # skip the first photo: different framing
    return [str(f.relative_to(ROOT)) for f in files]


SOURCES = _sources()


def load(f):
    return cv2.imdecode(np.fromfile(str(ROOT / f), np.uint8), cv2.IMREAD_COLOR)


def background(img):
    k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (41, 41))
    return cv2.GaussianBlur(cv2.morphologyEx(img, cv2.MORPH_CLOSE, k), (0, 0), 15).astype(np.float32)


def harvest():
    """Transmittance patches (1 = clear water) of isolated larvae, from real photos."""
    out = []
    yy, xx = np.mgrid[-(PATCH // 2):PATCH // 2 + 1, -(PATCH // 2):PATCH // 2 + 1]
    disc = np.clip(1.0 - (np.hypot(xx, yy) - 18) / 8, 0, 1).astype(np.float32)
    for f in SOURCES:
        img = load(f)
        bg = background(img)
        t = np.clip(img.astype(np.float32) / np.maximum(bg, 1), 0, 1)
        boxes, _ = detect(img, Params(tray="preset"))
        c = np.c_[(boxes[:, 0] + boxes[:, 2]) / 2, (boxes[:, 1] + boxes[:, 3]) / 2]
        h, w = img.shape[:2]
        for i, (x, y) in enumerate(c):
            d = np.hypot(c[:, 0] - x, c[:, 1] - y)
            d[i] = 1e9
            if d.min() < 40 or not (PATCH < x < w - PATCH and PATCH < y < h - PATCH):
                continue
            x, y = int(x), int(y)
            p = t[y - PATCH // 2:y + PATCH // 2 + 1, x - PATCH // 2:x + PATCH // 2 + 1]
            out.append(1.0 - (1.0 - p) * disc[..., None])
    return out


def compose(bg, patches, n, rng, glare_xy=None):
    h, w = bg.shape[:2]
    canvas = bg.copy()
    poly = np.array(preset_tray(w, h), np.float32)
    inner = np.zeros((h, w), np.uint8)
    cv2.fillPoly(inner, [poly.astype(np.int32)], 1)
    inner = cv2.erode(inner, np.ones((81, 81), np.uint8))
    m0 = PATCH // 2 + 2
    inner[:m0] = 0; inner[-m0:] = 0; inner[:, :m0] = 0; inner[:, -m0:] = 0
    ys, xs = np.nonzero(inner)
    for _ in range(n):
        p = patches[rng.integers(len(patches))]
        ang = rng.uniform(0, 360)
        m = cv2.getRotationMatrix2D((PATCH / 2, PATCH / 2), ang, 1.0)
        p = cv2.warpAffine(p, m, (PATCH, PATCH), flags=cv2.INTER_LINEAR, borderValue=(1, 1, 1))
        k = rng.integers(len(xs))
        x, y = int(xs[k]), int(ys[k])
        y0, x0 = y - PATCH // 2, x - PATCH // 2
        canvas[y0:y0 + PATCH, x0:x0 + PATCH] *= p
    return np.clip(canvas, 0, 255).astype(np.uint8)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--counts", default="800,1700,3000,5000")
    ap.add_argument("--seeds", type=int, default=3)
    ap.add_argument("--save", default="")
    ap.add_argument("--cluster-ratio", type=float, default=2.4, help="0 turns the hidden-larvae estimate off")
    a = ap.parse_args()

    patches = harvest()
    print(f"{len(patches)} isolated real larvae harvested from {len(SOURCES)} photos\n")
    # empty-water background: the tray of the first source with its larvae removed by the closing above
    bg = background(load(SOURCES[0]))
    print("true   found   error%   (mean of seeds)   NOTE: synthetic, not an accuracy figure")
    for n in [int(x) for x in a.counts.split(",")]:
        errs, found = [], []
        for s in range(a.seeds):
            rng = np.random.default_rng(s)
            img = compose(bg, patches, n, rng)
            ok, enc = cv2.imencode(".jpg", img, [cv2.IMWRITE_JPEG_QUALITY, 85])
            img = cv2.imdecode(enc, cv2.IMREAD_COLOR)
            if a.save and s == 0:
                cv2.imencode(".png", img)[1].tofile(f"{a.save}_{n}.png")
            boxes, _ = detect(img, Params(tray="preset", cluster_ratio=a.cluster_ratio))
            found.append(len(boxes))
            errs.append((len(boxes) - n) / n * 100)
        print(f"{n:5d}  {np.mean(found):6.0f}  {np.mean(errs):+6.1f}   spread {min(errs):+.1f}..{max(errs):+.1f}")


if __name__ == "__main__":
    main()
