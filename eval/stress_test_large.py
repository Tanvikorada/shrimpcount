"""Stress test with KNOWN counts for larger larvae (for example PL14), built from real photos of them.

Single whole animals are cut out of the photos (an animal with two eye dots, a head spot and a gut spot stays ONE animal, which
is the point) and pasted with their real translucency at chosen densities onto the empty tray background. The true count is then
known, so each counter setting can be scored on how many marks it puts per animal.

SYNTHETIC: it shows which settings double-mark or merge animals. It is not an accuracy figure for the product.
Usage: python eval/stress_test_large.py [--photos "data/raw/B02/*.jpg"] [--counts 800,1800,2500] [--seeds 2]
"""
import argparse
import glob
import sys
from pathlib import Path

import cv2
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
sys.path.append(str(ROOT / "api"))
from classical import Params, detect, preset_tray  # noqa: E402

PATCH = 101


def load(f):
    return cv2.imdecode(np.fromfile(str(f), np.uint8), cv2.IMREAD_COLOR)


def background(img):
    k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (61, 61))
    return cv2.GaussianBlur(cv2.morphologyEx(img, cv2.MORPH_CLOSE, k), (0, 0), 20).astype(np.float32)


def harvest(files, group_dist=18, alone_dist=34, max_span=36, max_marks=4):
    """Whole single animals: marks within group_dist of each other form one animal; keep small groups far from any other mark."""
    yy, xx = np.mgrid[-(PATCH // 2):PATCH // 2 + 1, -(PATCH // 2):PATCH // 2 + 1]
    disc = np.clip(1.0 - (np.hypot(xx, yy) - 30) / 8, 0, 1).astype(np.float32)
    out = []
    for f in files:
        img = load(f)
        bg = background(img)
        t = np.clip(img.astype(np.float32) / np.maximum(bg, 1), 0, 1)
        boxes, _ = detect(img, Params(tray="fit"))            # fine setting: it finds every spot of an animal
        c = np.c_[(boxes[:, 0] + boxes[:, 2]) / 2, (boxes[:, 1] + boxes[:, 3]) / 2]
        d = np.hypot(c[:, None, 0] - c[None, :, 0], c[:, None, 1] - c[None, :, 1])
        seen = np.zeros(len(c), bool)
        h, w = img.shape[:2]
        for i in range(len(c)):
            if seen[i]:
                continue
            grp = [i]; seen[i] = True; k = 0
            while k < len(grp):                                # connected marks within group_dist
                for j in np.nonzero((d[grp[k]] < group_dist) & ~seen)[0]:
                    seen[j] = True; grp.append(j)
                k += 1
            pts = c[grp]
            span = np.hypot(*(pts.max(0) - pts.min(0)))
            others = np.delete(np.arange(len(c)), grp)
            if len(grp) > max_marks or span > max_span or (len(others) and d[np.ix_(grp, others)].min() < alone_dist):
                continue
            x, y = pts.mean(0).astype(int)
            if not (PATCH < x < w - PATCH and PATCH < y < h - PATCH):
                continue
            p = t[y - PATCH // 2:y + PATCH // 2 + 1, x - PATCH // 2:x + PATCH // 2 + 1]
            out.append((1.0 - (1.0 - p) * disc[..., None], len(grp)))
    return out


def compose(bg, patches, n, rng):
    h, w = bg.shape[:2]
    canvas = bg.copy()
    poly = np.array(preset_tray(w, h), np.float32)
    inner = np.zeros((h, w), np.uint8)
    cv2.fillPoly(inner, [poly.astype(np.int32)], 1)
    inner = cv2.erode(inner, np.ones((101, 101), np.uint8))
    m0 = PATCH // 2 + 2
    inner[:m0] = 0; inner[-m0:] = 0; inner[:, :m0] = 0; inner[:, -m0:] = 0
    ys, xs = np.nonzero(inner)
    for _ in range(n):
        p = patches[rng.integers(len(patches))][0]
        m = cv2.getRotationMatrix2D((PATCH / 2, PATCH / 2), rng.uniform(0, 360), 1.0)
        p = cv2.warpAffine(p, m, (PATCH, PATCH), flags=cv2.INTER_LINEAR, borderValue=(1, 1, 1))
        k = rng.integers(len(xs))
        y0, x0 = int(ys[k]) - PATCH // 2, int(xs[k]) - PATCH // 2
        canvas[y0:y0 + PATCH, x0:x0 + PATCH] *= p
    return np.clip(canvas, 0, 255).astype(np.uint8)


PROFILES = {
    "current (fine)": {},
    "s2.2 win9": dict(sigma_small=2.2, sigma_large=6, peak_window=9, dog_thr=8, dog_thr_weak=5),
    "win13": dict(peak_window=13),
    "win15": dict(peak_window=15),
    "s2.2 win13": dict(sigma_small=2.2, sigma_large=6, peak_window=13, dog_thr=8, dog_thr_weak=5),
    "s2.2 win15": dict(sigma_small=2.2, sigma_large=6, peak_window=15, dog_thr=8, dog_thr_weak=5),
    "s3.0 win15": dict(sigma_small=3.0, sigma_large=8, peak_window=15, dog_thr=6, dog_thr_weak=4),
}


def main():
    global PATCH
    ap = argparse.ArgumentParser()
    ap.add_argument("--photos", default="data/raw/B02/*.jpg")
    ap.add_argument("--counts", default="800,1800,2500")
    ap.add_argument("--seeds", type=int, default=2)
    ap.add_argument("--use", type=int, default=12, help="how many photos to cut animals from")
    a = ap.parse_args()
    files = sorted(glob.glob(str(ROOT / a.photos)))
    cut, test = files[:a.use], files[a.use:] or files[:a.use]
    patches = harvest(cut)
    multi = np.mean([m > 1 for _, m in patches]) if patches else 0
    print(f"{len(patches)} whole single animals cut out of {len(cut)} photos ({multi * 100:.0f}% carry several dark spots)\n")
    bg = background(load(test[0]))
    counts = [int(x) for x in a.counts.split(",")]
    print("marks per true animal, by tray density (true count in brackets). 1.00 = right; above 1 = double-marking; below = merging\n")
    print("setting".ljust(16) + "".join(f"{n:>12d}" for n in counts))
    imgs = {n: [cv2.imdecode(cv2.imencode(".jpg", compose(bg, patches, n, np.random.default_rng(s)), [cv2.IMWRITE_JPEG_QUALITY, 85])[1], 1) for s in range(a.seeds)] for n in counts}
    for name, kw in PROFILES.items():
        row = []
        for n in counts:
            found = np.mean([len(detect(i, Params(tray="preset", **kw))[0]) for i in imgs[n]])
            row.append(found / n)
        print(name.ljust(16) + "".join(f"{r:12.2f}" for r in row), flush=True)


if __name__ == "__main__":
    main()
