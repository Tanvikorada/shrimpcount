"""Test bench for three candidate fixes to the classical counter, each tested against real ground truth before any of
them is adopted:
  1. a roundness (blob) band applied to STRONG marks too, not just weak ones - rejects debris/tile-texture spots that
     slipped past the darkness threshold with an erratic (very line-like or very round) shape real larvae rarely have.
  2. a head/tail merge pass: two marks a plausible larva-body-length apart, joined by continuous dark mass between them
     (not a gap), are one animal counted twice, not two animals.
  3. a smaller glare margin: the current code drops every mark within 10px of ANY saturated pixel, which throws away
     real larvae sitting just outside true glare, not only the ones actually washed out.

Run: python eval/shape_merge_glare.py
"""
import sys
import glob
from pathlib import Path

import cv2
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
sys.path.append(str(ROOT / "api"))
from classical import Params, detect, SIZE_PROFILES, size_for_stage  # noqa: E402

TRUTH = {"B02": 1800, "B03": 1797, "B05": 1750}
STAGE = {"B02": "PL14", "B03": "PL12", "B05": "PL9"}


def real_trays(extra=None):
    print("--- real trays (against a known count) ---")
    print("batch".ljust(6), "config".ljust(16), "mean", "  err%")
    for batch, truth in TRUTH.items():
        size = size_for_stage(STAGE[batch])
        files = sorted(f for f in glob.glob(str(ROOT / "data/raw" / batch / "*")) if f.lower().endswith((".jpg", ".jpeg", ".png", ".webp")))
        for name, kw in [("current", {}), *(extra or [])]:
            prof = dict(SIZE_PROFILES[size]); prof.update(kw)
            ns = []
            for f in files:
                img = cv2.imdecode(np.fromfile(f, np.uint8), cv2.IMREAD_COLOR)
                ns.append(len(detect(img, Params(tray="fit", **prof))[0]))
            ns = np.array(ns)
            print(batch.ljust(6), name.ljust(16), f"{ns.mean():7.1f}", f"{100*(ns.mean()-truth)/truth:+6.2f}%")


def known_count_synthetic(extra=None):
    print("\n--- known-count synthetic (small profile; the only real overlap ground truth) ---")
    sys.path.append(str(ROOT / "eval"))
    import stress_test as st
    bg = st.background(st.load(st.SOURCES[0]))
    patches = st.harvest()
    counts = [800, 1700, 3000, 5000]
    seeds = 2
    imgs = {}
    for n in counts:
        ims = [st.compose(bg, patches, n, np.random.default_rng(s)) for s in range(seeds)]
        imgs[n] = [cv2.imdecode(cv2.imencode(".jpg", im, [cv2.IMWRITE_JPEG_QUALITY, 85])[1], 1) for im in ims]
    print("config".ljust(16), *[f"{n:>8d}" for n in counts])
    for name, kw in [("current", {}), *(extra or [])]:
        prof = dict(SIZE_PROFILES["small"]); prof.update(kw)
        row = []
        for n in counts:
            errs = [(len(detect(im, Params(tray="preset", **prof))[0]) - n) / n * 100 for im in imgs[n]]
            row.append(f"{np.mean(errs):+6.1f}%")
        print(name.ljust(16), *[r.rjust(8) for r in row], flush=True)


def one_mark_per_animal(extra=None):
    """Cut whole single small larvae out of a real 'small' photo (same technique as stress_test_large.py's PL14
    harvest), paste them at known densities, and measure marks found per true animal. 1.00 = correct."""
    print("\n--- marks per true animal, small larvae (B05, cut from real photos) ---")
    sys.path.append(str(ROOT / "eval"))
    import stress_test_large as stl
    files = sorted(f for f in glob.glob(str(ROOT / "data/raw/B05/*")) if f.lower().endswith((".jpg", ".jpeg", ".png", ".webp")))
    cut, test = files[:1], files[1:] or files[:1]
    old_patch = stl.PATCH
    stl.PATCH = 55  # a small larva's own patch, not PL14's
    patches = stl.harvest(cut)
    bg = stl.background(stl.load(test[0]))
    counts = [800, 1700, 2500]
    seeds = 2
    imgs = {n: [cv2.imdecode(cv2.imencode(".jpg", stl.compose(bg, patches, n, np.random.default_rng(s)), [cv2.IMWRITE_JPEG_QUALITY, 85])[1], 1) for s in range(seeds)] for n in counts}
    print(f"{len(patches)} whole single small larvae cut out")
    print("config".ljust(16), *[f"{n:>8d}" for n in counts])
    for name, kw in [("current", {}), *(extra or [])]:
        prof = dict(SIZE_PROFILES["small"]); prof.update(kw)
        row = []
        for n in counts:
            found = np.mean([len(detect(i, Params(tray="preset", **prof))[0]) for i in imgs[n]])
            row.append(f"{found/n:.2f}")
        print(name.ljust(16), *[r.rjust(8) for r in row], flush=True)
    stl.PATCH = old_patch


if __name__ == "__main__":
    real_trays()
    known_count_synthetic()
    one_mark_per_animal()
