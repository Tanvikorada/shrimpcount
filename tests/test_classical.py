"""Code-path tests for the classical counter using drawn test images.

These check that the algorithm runs and behaves sensibly on a controlled picture. They say NOTHING about accuracy on
real hatchery photos. Real accuracy comes only from eval/evaluate_counts.py on the held-out split.
"""
import sys
from pathlib import Path

import cv2
import numpy as np

sys.path.append(str(Path(__file__).resolve().parents[1] / "api"))
from classical import Params, detect  # noqa: E402


def tray(n, size=1280, seed=0, gap=None, shading=False):
    """Light tray with n larva-like marks: a small dark round head with a faint thin tail, spaced apart.

    Head size scales with the image so it is ~3 px radius at the counter's working width (1280).
    """
    rng = np.random.default_rng(seed)
    r = max(2, round(3 * size / 1280))
    gap = gap or 14 * r
    img = np.full((size, size, 3), 235, np.uint8)
    if shading:
        yy, xx = np.mgrid[0:size, 0:size]
        img = (img - (xx / size * 40)[..., None]).astype(np.uint8)
    placed = []
    margin = 6 * r
    while len(placed) < n:
        x, y = rng.integers(margin, size - margin, 2)
        if all((x - a) ** 2 + (y - b) ** 2 > gap ** 2 for a, b in placed):
            placed.append((x, y))
            ang = rng.uniform(0, 6.283)
            tail = (int(x + 9 * r * np.cos(ang)), int(y + 9 * r * np.sin(ang)))
            cv2.line(img, (int(x), int(y)), tail, (218, 214, 208), 1)          # faint, translucent tail
            cv2.circle(img, (int(x), int(y)), r, (60, 60, 60), -1)             # the head
    return img


def test_empty_tray_counts_zero():
    boxes, meta = detect(np.full((800, 800, 3), 235, np.uint8))
    assert len(boxes) == 0


def test_counts_separated_larvae_closely():
    for n in (20, 80, 200):
        boxes, _ = detect(tray(n))
        assert abs(len(boxes) - n) <= max(2, 0.05 * n), (n, len(boxes))


def test_uneven_lighting_is_handled():
    boxes, _ = detect(tray(80, shading=True))
    assert abs(len(boxes) - 80) <= 6


def test_touching_pair_is_split_in_two():
    """Larva heads in real photos are ~6 px spots. Two touching spots must count as two, not one."""
    img = np.full((1280, 1280, 3), 200, np.uint8)
    rng = np.random.default_rng(1)
    for _ in range(60):  # background of separate single heads so the 'typical' size is known
        x, y = rng.integers(40, 1240, 2)
        if not (500 < x < 780 and 500 < y < 780):
            cv2.circle(img, (int(x), int(y)), 3, (60, 60, 60), -1)
    cv2.circle(img, (636, 640), 3, (60, 60, 60), -1)
    cv2.circle(img, (643, 640), 3, (60, 60, 60), -1)
    boxes, _ = detect(img)
    cx = (boxes[:, 0] + boxes[:, 2]) / 2
    cy = (boxes[:, 1] + boxes[:, 3]) / 2
    near = ((cx - 640) ** 2 + (cy - 640) ** 2) < 20 ** 2
    assert near.sum() == 2, near.sum()


def test_roi_excludes_outside():
    img = tray(100, seed=3)
    inside, _ = detect(img, Params(roi=(0.5, 0.5, 0.25)))
    full, _ = detect(img)
    assert 0 < len(inside) < len(full)


def test_boxes_are_in_original_pixel_coordinates():
    big = tray(30, size=3200, seed=5)
    boxes, _ = detect(big)
    assert boxes[:, [0, 2]].max() <= 3200 and boxes[:, [1, 3]].max() <= 3200
    assert boxes[:, 2].max() > 1800  # not left in the downscaled frame


def test_tray_outline_excludes_marks_on_the_wall():
    """Spots outside the tray outline (wall, corner tags) are not counted; spots inside are."""
    img = np.full((1280, 1280, 3), 200, np.uint8)
    for (x, y) in [(300, 300), (500, 600), (800, 900)]:          # in the water
        cv2.circle(img, (x, y), 3, (60, 90, 120), -1)
    for (x, y) in [(20, 20), (1260, 1260)]:                      # on a corner tag
        cv2.circle(img, (x, y), 3, (60, 90, 120), -1)
    everything, _ = detect(img, Params())
    inside_only, meta = detect(img, Params(tray="preset"))
    assert len(everything) == 5
    assert len(inside_only) == 3
    assert meta["outside_tray"] == 2


def test_flash_reflection_is_not_counted():
    img = np.full((1280, 1280, 3), 200, np.uint8)
    cv2.circle(img, (640, 640), 14, (255, 255, 255), -1)         # saturated flash
    cv2.circle(img, (640, 640), 3, (60, 90, 120), -1)            # dark speck inside it
    cv2.circle(img, (300, 300), 3, (60, 90, 120), -1)            # a real spot elsewhere
    boxes, meta = detect(img, Params())
    assert len(boxes) == 1


def _head(img, x, y, dark, radius=3):
    """Darken a small round head; drawing twice at the same spot models two stacked larvae (transparent bodies)."""
    m = np.zeros(img.shape[:2], np.float32)
    cv2.circle(m, (x, y), int(round(radius)), 1.0, -1)
    m = cv2.GaussianBlur(m, (0, 0), 1.0)
    img[:] = np.clip(img.astype(np.float32) * (1 - dark * m)[..., None], 0, 255).astype(np.uint8)


def test_clump_of_larvae_is_counted_more_than_once():
    rng = np.random.default_rng(3)
    img = np.full((1280, 1280, 3), 200, np.uint8)
    pts = [(int(x), int(y)) for x, y in rng.integers(100, 1180, size=(40, 2))]
    for x, y in pts:
        _head(img, x, y, 0.45)
    alone, _ = detect(img, Params())
    assert 38 <= len(alone) <= 40                       # singles: one mark each, nothing extra invented

    x, y = 640, 640
    while min(np.hypot(x - a, y - b) for a, b in pts) < 60:
        x += 37
    for dx, dy in [(0, 0), (3, 0), (0, 3)]:              # a clump of three heads a few pixels apart: one merged peak
        _head(img, x + dx, y + dy, 0.45)
    clump, meta = detect(img, Params())
    assert meta["hidden_estimated"] >= 1
    assert len(alone) + 2 <= len(clump) <= len(alone) + 4   # counted as about three, not one
    # Known limit: two larvae stacked on exactly the same spot darken the image only about 1.5x (transparent bodies), so
    # the counter cannot tell them from one. Only a trained model, or a second photo, can.


def test_fit_tray_finds_a_shifted_tray_floor():
    """The tray floor is drawn lower and narrower than the standard octagon; the fit should move onto it."""
    from classical import PRESET_TRAY_NORM, fit_tray
    img = np.full((1280, 1280, 3), (200, 230, 240), np.uint8)              # light wall
    truth = np.array([(0.15, 0.16), (0.86, 0.16), (1.0, 0.27), (1.0, 0.75), (0.85, 0.88), (0.16, 0.88), (0.0, 0.75), (0.0, 0.27)])
    cv2.fillPoly(img, [(truth * 1279).astype(np.int32)], (170, 185, 205))   # darker water
    poly, notes = fit_tray(img)
    top_prior = PRESET_TRAY_NORM[0][1]
    top_fit = min(p[1] for p in poly)
    assert abs(top_fit - 0.16) < 0.03 < abs(top_prior - 0.16)               # moved to the true top edge, not the prior
    bottom_fit = max(p[1] for p in poly)
    assert abs(bottom_fit - 0.88) < 0.03
    assert "moved" in " ".join(notes)


def test_fit_tray_keeps_the_prior_when_there_is_no_edge():
    from classical import PRESET_TRAY_NORM, fit_tray
    flat = np.full((1280, 1280, 3), 200, np.uint8)
    poly, notes = fit_tray(flat)
    assert all(abs(a[0] - b[0]) < 0.02 and abs(a[1] - b[1]) < 0.02 for a, b in zip(poly, PRESET_TRAY_NORM))


def _pl14_animal(img, x, y):
    """A larger larva: two small eye dots at the head and one continuous dark body behind them (about 30 px long)."""
    m = np.zeros(img.shape[:2], np.float32)
    cv2.circle(m, (x - 3, y), 1, 1.0, -1)
    cv2.circle(m, (x + 3, y), 1, 1.0, -1)
    body = np.zeros_like(m)
    cv2.ellipse(body, (x, y + 10), (4, 9), 0, 0, 360, 0.55, -1)
    m = cv2.GaussianBlur(np.maximum(m, body), (0, 0), 1.2)
    img[:] = np.clip(img.astype(np.float32) * (1 - 0.45 * m)[..., None], 0, 255).astype(np.uint8)


def test_large_larvae_get_one_mark_each_with_the_large_setting():
    from classical import SIZE_PROFILES, size_for_stage
    rng = np.random.default_rng(5)
    img = np.full((1280, 1280, 3), 200, np.uint8)
    n = 60
    for x, y in rng.integers(100, 1150, size=(n, 2)):
        _pl14_animal(img, int(x), int(y))
    small, _ = detect(img, Params())
    large, _ = detect(img, Params(**SIZE_PROFILES["large"]))
    assert len(small) > 1.5 * n                      # the fine setting marks each animal several times
    assert 0.8 * n <= len(large) <= 1.3 * n          # the large setting is close to one mark per animal
    assert size_for_stage("PL14") == "large" and size_for_stage("PL 13") == "large"
    assert size_for_stage("PL10") == "small" and size_for_stage("") == "small" and size_for_stage(None) == "small"


def test_refine_tray_by_marks_follows_the_larvae():
    """Marks stop at a wall on the left, but run right to the photo edge on top: the sides must follow that."""
    from classical import PRESET_TRAY_NORM, refine_tray_by_marks
    rng = np.random.default_rng(0)
    pts = np.c_[rng.uniform(140, 1180, 4000), rng.uniform(0, 1280, 4000)]          # nothing left of x=140, everything to the top edge
    norm = refine_tray_by_marks(PRESET_TRAY_NORM, pts, 1280, 1280)
    assert norm[0][1] < 0.0 and norm[1][1] < 0.0                                     # top side moved out to the photo edge
    assert abs(norm[6][0] - 140 / 1279) < 0.03 and abs(norm[7][0] - 140 / 1279) < 0.03  # left side sits at the wall


def test_refine_tray_by_marks_needs_a_full_tray_and_ignores_gaps():
    from classical import PRESET_TRAY_NORM, refine_tray_by_marks
    few = np.random.default_rng(1).uniform(100, 1180, (50, 2))
    assert refine_tray_by_marks(PRESET_TRAY_NORM, few, 1280, 1280) == PRESET_TRAY_NORM
    rng = np.random.default_rng(2)
    pts = np.c_[rng.uniform(0, 1280, 5000), rng.uniform(100, 1180, 5000)]
    pts = pts[~((pts[:, 0] > 950) & (pts[:, 0] < 1010))]                              # an empty gap inside the water, larvae beyond it
    norm = refine_tray_by_marks(PRESET_TRAY_NORM, pts, 1280, 1280)
    assert norm[2][0] > 0.98                                                          # right side stays at the photo edge, not at the gap


def test_dist_nms_separates_two_close_but_distinct_spots():
    """Two dark spots diagonally inside one grid peak_window square must not always collapse to one mark with dist_nms,
    while two spots truly on top of each other still collapse. work_width is pinned to the canvas size: detect() otherwise
    upscales a small test image to its usual 1280 px working width, and the cubic-interpolation ringing that creates around
    a hard-edged synthetic circle makes spurious peaks under EITHER method - not a real photo's problem, a tiny-canvas one."""
    from classical import Params, detect
    img = np.full((200, 200, 3), 210, np.uint8)
    cv2.circle(img, (100, 100), 4, (60, 60, 60), -1)
    cv2.circle(img, (107, 107), 4, (60, 60, 60), -1)          # ~10px apart: two real, separate larvae
    boxes_grid, _ = detect(img, Params(tray=None, peak_window=9, work_width=200))
    boxes_dist, _ = detect(img, Params(tray=None, peak_window=9, dist_nms=True, min_gap=3.0, work_width=200))
    assert len(boxes_dist) >= len(boxes_grid)
    assert len(boxes_dist) == 2

    img2 = np.full((200, 200, 3), 210, np.uint8)
    cv2.circle(img2, (100, 100), 4, (60, 60, 60), -1)          # one spot: must stay one mark either way
    assert len(detect(img2, Params(tray=None, peak_window=9, work_width=200))[0]) == 1
    assert len(detect(img2, Params(tray=None, peak_window=9, dist_nms=True, min_gap=3.0, work_width=200))[0]) == 1


def test_dist_nms_does_not_explode_on_a_flat_dark_patch():
    """A solid dark blob much bigger than one larva (debris, a shadow, a thick mark) must not multiply into dozens of
    marks just because every pixel in it ties for 'local max' under the small candidate window dist_nms starts from."""
    from classical import Params, detect
    img = np.full((200, 200, 3), 210, np.uint8)
    cv2.rectangle(img, (60, 60), (140, 140), (60, 60, 60), -1)   # a big flat dark patch: one blob, not one-larva-sized
    boxes, _ = detect(img, Params(tray=None, dist_nms=True, min_gap=3.0, work_width=200))
    assert len(boxes) <= 8   # a DoG filter responds to the patch's corners, not its flat interior - a handful of marks is fine, dozens is the bug


def test_merge_body_pairs_merges_isolated_pair_but_not_a_crowd():
    from classical import _merge_body_pairs
    dark = np.zeros((100, 100), np.float32)
    dog = np.zeros((100, 100), np.float32)
    # a bright (dark-mass) bridge between two isolated marks 15px apart: one animal's own body
    cv2.line(dark, (20, 20), (35, 20), 20, 3)
    dog[20, 20] = 10; dog[35, 20] = 9
    xs = np.array([20, 35]); ys = np.array([20, 20])
    drop = _merge_body_pairs(dark, dog, xs, ys, lo=6, hi=20, bridge_frac=0.35, lonely_factor=1.3)
    assert drop.sum() == 1                                # the weaker of the two is merged away

    # the same pair, but with a third mark nearby: no longer "lonely", so it must not merge
    xs2 = np.array([20, 35, 27])
    ys2 = np.array([20, 20, 40])
    dog2 = dog.copy(); dog2[40, 27] = 8
    drop2 = _merge_body_pairs(dark, dog2, xs2, ys2, lo=6, hi=20, bridge_frac=0.35, lonely_factor=1.3)
    assert drop2.sum() == 0


def test_strong_shape_gate_rejects_extreme_roundness():
    # NOT enabled by default: tested on real photos and found to remove more true larvae than false marks (see
    # data/reference/NOTES.md) - this only locks in what the gate itself does, in isolation.
    from classical import Params, detect
    perfect_circle = np.full((200, 200, 3), 210, np.uint8)
    cv2.circle(perfect_circle, (100, 100), 4, (40, 40, 40), -1)    # blob close to 1.0: exactly what the gate rejects
    on, _ = detect(perfect_circle, Params(tray=None, work_width=200, strong_shape=True))
    off, _ = detect(perfect_circle, Params(tray=None, work_width=200))
    assert len(off) == 1 and len(on) == 0
