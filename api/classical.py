"""Classical (no training) larva counter.

Built on the first real hatchery photos (top-down tray, 1280x1280, warm light, translucent larvae). In those photos
each larva is a small dark orange-brown spot (head and gut, about 5-7 px) with a very faint, translucent tail. Tails are
unreliable, so the counter finds the round spots and ignores the streaks:

  1. work at a fixed width so spot size is constant (1280 px);
  2. estimate the local background (morphological closing + blur) and measure how much darker each pixel is;
  3. difference-of-Gaussians tuned to the spot size, then local maxima (one per larva, so touching larvae are separate);
  4. keep a maximum if it is strong, or if it is weaker but round (the Hessian of the darkness map has two similar
     curvatures), which admits faint heads without admitting tails, which are thin ridges.

Returns boxes as [x1,y1,x2,y2,score] in the original image's pixel coordinates, the same format the ONNX path uses.
Score is 1.0 for a strong spot and 0.7 for a weaker round one.

STATUS: tuned by eye on 6 photos plus one rough ballpark (trays of about 1,850) that is not a verified count. There are
NO manual counts yet, so NO ACCURACY IS CLAIMED. Measure it with eval/evaluate_counts.py against manual counts before
quoting any number. Known weak points: a few false spots on tray walls, corner labels and the flash reflection; very
dense clumps and faint larvae are likely under-counted (the counter reads low, not high, on the first photos).
"""
import re
from dataclasses import dataclass, asdict

import cv2
import numpy as np


@dataclass
class Params:
    work_width: int = 1280        # image is resized to this width first, so the values below are in these pixels
    dog_thr: float = 10.0         # a spot at least this strong (gray levels) always counts
    dog_thr_weak: float = 6.0     # a weaker spot counts only if it is also round
    blob_min: float = 0.4         # roundness needed for a weak spot (0 = a line, 1 = a perfect round blob)
    sigma_small: float = 1.5      # DoG scales, tuned to a ~6 px spot
    sigma_large: float = 4.0
    bg_kernel: int = 41           # background estimate size (must be larger than a larva)
    peak_window: int = 5          # two spots closer than about this are one larva (5 recovered more overlapped heads than 7)
    dist_nms: bool = False        # find peaks with a small window, then merge only spots CLOSER than min_gap (circular, not a square
                                   # window): resolves two larvae that sit inside one peak_window square but are not truly on top
                                   # of each other. Off by default until proven on the known-count synthetic test.
    roi: tuple = None             # optional (cx, cy, r) as fractions of the image: only count inside this circle
    cluster_ratio: float = 2.4    # a spot with this many times the dark mass of a typical single larva hides another (0 = off)
    min_gap: float = None          # circular suppression radius for dist_nms; defaults to peak_window
    glare_grow: int = 10          # spots within this many px of a saturated (flash) pixel are ignored
    merge_body: bool = False      # merge a head+tail pair of one animal into one mark (see _merge_body_pairs); off
                                   # until proven, like dist_nms
    merge_lo: float = 6.0         # only pairs this close together ..
    merge_hi: float = 36.0        # .. to this far apart are even considered (measured head-tail range: 7.6-34.7 px)
    merge_bridge: float = 0.35    # the line between them must stay at least this fraction as dark as the weaker mark
    merge_lonely: float = 1.3     # neither mark may have any OTHER mark closer than merge_lonely x merge_hi away
    strong_shape: bool = False    # also gate STRONG marks by roundness, not only weak ones (see detect()); off until proven
    strong_blob_lo: float = 0.15  # a strong mark this line-like (near 0) is more likely a scratch or a tile-grout edge
    strong_blob_hi: float = 0.9   # a strong mark this perfectly round is more likely debris or a glare-edge artifact
    tray: object = None           # None = whole photo; "preset" = the octagon above; or a list of (x, y) corners
                                  # in ORIGINAL pixels (the operator's own outline): only spots inside are kept.
                                  # "fit" = the standard octagon slid onto the real tray edges (see fit_tray)


# Larger larvae (about PL13 and up) carry several dark spots each (two eyes, a head spot, a gut spot), so the fine settings above
# mark one animal two or three times. "large" looks at a coarser scale. Measured on a real PL14 tray (18 photos): the fine setting
# read 19.5% above that tray's reference count with 8.7% spread between photos, "large" read +1.3% with 2.8% spread. CAUTION: the
# setting was chosen after seeing that tray's reference count, so a second, different PL14 tray is needed to confirm it, and
# stages between PL10 and PL14 have not been seen at all.
SIZE_PROFILES = {
    # dist_nms: measured on the known-count synthetic test to recover more of the undercount at high density (e.g. -5.9% ->
    # -4.4% at 5,000 in one tray) without hurting light trays, and on real photos it improved B03 (-5.0% -> -3.7% vs 1797)
    # and B05 (-13.7% -> -13.0% vs 1750). NOT used for "large": on the real PL14 tray it made both the error and the
    # spread worse (+0.5% -> +3.3%, cv 2.6% -> 3.6%), because it changes how a large larva's own several dark spots chain
    # together. See data/reference/NOTES.md, 2026-09-23.
    "small": dict(dist_nms=True, min_gap=3.0),
    "large": dict(sigma_small=2.2, sigma_large=6.0, peak_window=9, dog_thr=8.0, dog_thr_weak=5.0),
}


def size_for_stage(stage) -> str:
    """The larva size to start from, given the PL stage the hatchery wrote down (for example "PL14"). Blank or unclear = small."""
    m = re.search(r"\d+", str(stage or ""))
    return "large" if m and int(m.group()) >= 13 else "small"


def _odd(n: int) -> int:
    n = max(3, int(n))
    return n if n % 2 else n + 1


# Octagonal tray floor of the tray in the first hatchery photos, as fractions of the photo. It is a STARTING POINT: framing
# differs between cameras and boxes, so the app lets the operator drag the corners once and saves that as a tray profile.
# Automatic detection of the tray floor was tried three ways (edge rays, flood fill, colour) and none was reliable
# across framings, and two versions cut off real larvae, so the outline is set by a person instead.
PRESET_TRAY_NORM = [(0.13, 0.09), (0.88, 0.09), (1.0, 0.20), (1.0, 0.80), (0.87, 0.92), (0.14, 0.92), (0.0, 0.80), (0.0, 0.20)]


def fit_tray(image_bgr: np.ndarray, prior=None, width: int = 320, band: float = 0.11):
    """Fit the tray floor: start from the standard octagon and slide each edge onto the real tray edge.

    Only a narrow band around each prior edge is searched, and each edge moves in parallel, so it cannot wander off the way
    the fully automatic attempts did. An edge that is not a clear, straight edge keeps the prior; edges on the photo border
    (the water runs off the photo) are not moved. Returns (polygon as fractions of the photo, one note per edge).
    On the 20 photos of one tray type it followed the tray floor on all of them; other trays need checking.
    """
    prior = prior or PRESET_TRAY_NORM
    h0, w0 = image_bgr.shape[:2]
    s = width / float(w0)
    sm = cv2.resize(image_bgr, (width, max(1, int(round(h0 * s)))), interpolation=cv2.INTER_AREA)
    lab = cv2.cvtColor(sm, cv2.COLOR_BGR2LAB)
    m = np.stack([cv2.medianBlur(lab[..., i], 7) for i in range(3)], -1).astype(np.float32)
    m = cv2.GaussianBlur(m, (0, 0), 2.0)
    g8 = cv2.cvtColor(sm, cv2.COLOR_BGR2GRAY)
    specks = (cv2.medianBlur(g8, 11).astype(np.int16) - g8.astype(np.int16)) > 5      # small dark marks: larvae (a wall strip has none)
    gx = np.stack([cv2.Sobel(m[..., i], cv2.CV_32F, 1, 0) for i in range(3)], -1)
    gy = np.stack([cv2.Sobel(m[..., i], cv2.CV_32F, 0, 1) for i in range(3)], -1)
    h, w = m.shape[:2]
    P = np.array([(x * (w - 1), y * (h - 1)) for x, y in prior], np.float32)
    n = len(P)
    lines, notes = [], []
    for i in range(n):
        a, b = P[i], P[(i + 1) % n]
        d = b - a
        L = float(np.hypot(*d))
        d = d / L
        nrm = np.array([-d[1], d[0]], np.float32)
        on_border = (a[0] < 2 and b[0] < 2) or (a[0] > w - 3 and b[0] > w - 3) or (a[1] < 2 and b[1] < 2) or (a[1] > h - 3 and b[1] > h - 3)
        if on_border:
            # The water usually runs off the photo here. But when the tray is framed with a wall strip beside it, there is a clear
            # wall edge a little way in: look for it inward only, and only trust a strong, straight one.
            if float(np.dot(nrm, P.mean(0) - a)) < 0:
                nrm = -nrm
            offs = np.arange(0, 0.2 * width + 1, 1.0)
        else:
            offs = np.arange(-band * width, band * width + 1, 1.0)
        best, strength = [], []
        for t in np.linspace(0.15, 0.85, 30):
            p = a + d * L * t
            xs = (p[0] + nrm[0] * offs).round().astype(int)
            ys = (p[1] + nrm[1] * offs).round().astype(int)
            ok = (xs >= 0) & (xs < w) & (ys >= 0) & (ys < h)
            if ok.sum() < 10:
                continue
            g = gx[ys[ok], xs[ok]] * nrm[0] + gy[ys[ok], xs[ok]] * nrm[1]
            mag = np.sqrt((g ** 2).sum(-1))
            k = int(np.argmax(mag))
            best.append(offs[ok][k]); strength.append(mag[k])
        if len(best) < 8:
            lines.append((a, d)); notes.append("few"); continue
        off = float(np.median(best))
        spread = float(np.median(np.abs(np.array(best) - off)))
        if on_border:
            ok_wall = spread <= 0.025 * width and np.median(strength) >= 14 and off >= 0.03 * width and abs(d[0]) < 0.2   # a side edge only
            if ok_wall:
                # a wall strip holds no larvae; if the strip outside the edge is about as speckled as the water beside it, it is water
                x_edge = int(round(a[0] + nrm[0] * off))
                y0, y1 = int(0.2 * h), int(0.8 * h)
                lo, hi = (0, x_edge) if a[0] < w / 2 else (x_edge, w)
                wid = max(1, hi - lo)
                inner = (x_edge, min(w, x_edge + wid)) if a[0] < w / 2 else (max(0, x_edge - wid), x_edge)
                strip = float(specks[y0:y1, lo:hi].mean()) if hi > lo else 0.0
                water = float(specks[y0:y1, inner[0]:inner[1]].mean()) if inner[1] > inner[0] else 0.0
                ok_wall = water > 0 and strip < 0.35 * water
            if not ok_wall:
                lines.append((a, d)); notes.append("border"); continue     # no clear, larva-free wall strip: the water runs off the photo
        elif spread > 0.04 * width or np.median(strength) < 8:
            lines.append((a, d)); notes.append("weak"); continue
        lines.append((a + nrm * off, d)); notes.append(f"moved {off:+.1f}")
    V = []
    for i in range(n):
        (p1, d1), (p2, d2) = lines[i - 1], lines[i]
        A = np.array([d1, -d2]).T
        if abs(np.linalg.det(A)) < 1e-3:
            V.append(P[i]); continue
        t = np.linalg.solve(A, p2 - p1)
        V.append(p1 + d1 * t[0])
    V = np.array(V)
    V[:, 0] = np.clip(V[:, 0], 0, w - 1)
    V[:, 1] = np.clip(V[:, 1], 0, h - 1)
    poly = [(float(x / (w - 1)), float(y / (h - 1))) for x, y in V]
    area = 0.5 * abs(sum(poly[i][0] * poly[(i + 1) % n][1] - poly[(i + 1) % n][0] * poly[i][1] for i in range(n)))
    if not 0.35 < area < 1.0:                       # implausible: use the prior
        return list(prior), ["prior"] * n
    return poly, notes


def refine_tray_by_marks(norm, centers, w0: int, h0: int, band: float = 0.0125, keep: float = 0.4):
    """Set the four straight tray sides from where the larvae actually are.

    A photo either shows the tray wall (larvae stop there) or the water runs off the photo edge (larvae go right to it). The
    edge fit cannot always tell which; the larvae can. For each side, count marks in thin strips walking from the middle of the
    tray outwards; the side sits just outside the last strip that still holds at least `keep` of the inner density. Marks
    on wall specks and corner tiles are sparse or off to the corners, so only the middle half of each side is used.
    Needs a reasonably full tray (300+ marks); otherwise the fitted outline is returned unchanged. Corners are moved with their sides.
    """
    c = np.asarray(centers, np.float32).reshape(-1, 2)
    if len(c) < 300:
        return norm
    poly = [list(p) for p in norm]
    # (vertex ids, axis, which end of the photo the side faces): top y, right x, bottom y, left x
    sides = [((0, 1), 1, 0), ((2, 3), 0, 1), ((4, 5), 1, 1), ((6, 7), 0, 0)]
    dims = (w0, h0)
    for (a, b_), axis, far in sides:
        n = dims[axis]
        other = 1 - axis
        lo, hi = 0.3 * dims[other], 0.7 * dims[other]
        sel = c[(c[:, other] >= lo) & (c[:, other] <= hi)]
        d = sel[:, axis] if not far else n - sel[:, axis]              # distance from that photo edge, inwards
        step = band * n
        nb = int(0.3 / band)
        prof = np.array([((d >= i * step) & (d < (i + 1) * step)).sum() for i in range(nb)], float)
        ref_lo, ref_hi = int(0.22 / band), int(0.3 / band)
        ref = float(np.median(prof[ref_lo:ref_hi]))
        if ref < 4:
            continue
        # the outermost strip (nearest the photo edge) that, with its inner neighbour, is still about as full as the tray
        dense = prof >= keep * ref
        edge = None
        for i in range(0, ref_hi - 1):
            if dense[i] and dense[i + 1]:
                edge = i * step
                break
        if edge is None:
            continue                                                    # no clear picture: keep the fitted side
        if edge <= 1.5 * step:
            edge = -0.02 * n                                            # larvae reach the photo edge: the water runs off it
        pos = (n - edge) if far else edge
        cur = poly[a][axis] * n if False else poly[a][axis] * (n - 1)
        if abs(pos - cur) < 0.01 * n:
            continue
        v = min(max(pos / (n - 1), -0.02), 1.02)
        poly[a][axis] = v
        poly[b_][axis] = v
    return [tuple(p) for p in poly]


def preset_tray(w: int, h: int):
    return [(x * (w - 1), y * (h - 1)) for x, y in PRESET_TRAY_NORM]


def _split_clusters(dark, xs, ys, ratio, radius=6):
    """A spot whose dark mass is about k times that of a typical isolated larva is taken to be k larvae stacked on
    each other. Returns the original spots plus positions (jittered beside the spot) for the extra, hidden larvae."""
    k = 2 * radius + 1
    yy, xx = np.mgrid[-radius:radius + 1, -radius:radius + 1]
    disc = (np.hypot(xx, yy) <= radius).astype(np.float32)
    mass = cv2.filter2D(dark, -1, disc)[ys, xs]
    pts = np.stack([xs, ys], 1).astype(np.float32)
    d = np.hypot(pts[:, None, 0] - pts[None, :, 0], pts[:, None, 1] - pts[None, :, 1])
    np.fill_diagonal(d, 1e9)
    alone = d.min(1) > 16
    if alone.sum() < 10:
        return xs, ys, np.array([], int), np.array([], int)
    m1 = float(np.median(mass[alone]))
    r = mass / max(m1, 1e-6)
    extra = np.where(r >= ratio, np.clip(np.round(r).astype(int) - 1, 1, 3), 0)
    ex, ey = [], []
    for i in np.nonzero(extra)[0]:
        for j in range(extra[i]):
            a = 2 * np.pi * (j + 0.5) / extra[i] + i
            ex.append(int(round(xs[i] + 4 * np.cos(a)))); ey.append(int(round(ys[i] + 4 * np.sin(a))))
    return xs, ys, np.array(ex, int), np.array(ey, int)


def _merge_body_pairs(dark, dog, xs, ys, lo, hi, bridge_frac=0.35, lonely_factor=1.3):
    """Two marks a plausible larva body-length apart (a faint head dot and a separate tail-tip dot on the SAME animal)
    are one larva counted twice, not two larvae - measured directly: cutting single real larvae out of a photo and
    counting them in isolation, 16 of 36 were marked twice, 7.6 to 35 px apart (see eval/shape_merge_glare.py).

    The test that tells a head+tail pair apart from two DIFFERENT neighbouring larvae: sample the darkness map along
    the straight line between the two marks. One animal's own body keeps that line dark; two separate animals usually
    have a brighter gap of open water between them even when close - EXCEPT in a crowded cluster, where the whole
    neighbourhood is dark and that test alone cannot tell "one body" from "several animals packed together" (measured:
    it fixed isolated pairs cleanly but badly over-merged dense crowds - see data/reference/NOTES.md). So a pair is
    only ever merged when BOTH marks are otherwise lonely: no other mark of either one sits nearer than lonely_factor
    times the farthest merge distance. A pair deep in a crowd never reaches the bridge test at all.

    Vectorized distance test; a Python loop only over the (comparatively few) candidate PAIRS actually in range, each
    doing five array lookups - never a loop over every point against every other point like the bug this file once had."""
    n = len(xs)
    if n < 2:
        return np.zeros(n, bool)
    pts = np.stack([xs, ys], 1).astype(np.float32)
    d = np.hypot(pts[:, None, 0] - pts[None, :, 0], pts[:, None, 1] - pts[None, :, 1])
    np.fill_diagonal(d, 1e9)
    ii, jj = np.nonzero(np.triu((d >= lo) & (d <= hi)))
    drop = np.zeros(n, bool)
    if len(ii) == 0:
        return drop
    lonely_dist = lonely_factor * hi
    dv = dog[ys, xs]
    dkv = dark[ys, xs]
    order = np.argsort(-np.minimum(dv[ii], dv[jj]))       # resolve the most confident pairs first
    t = np.linspace(0.2, 0.8, 5)
    h, w = dark.shape[:2]
    for k in order:
        i, j = int(ii[k]), int(jj[k])
        if drop[i] or drop[j]:
            continue
        # is ANY third mark near this pair at all, not just nearer than the pair itself? A dense, evenly packed
        # cluster can make i and j mutual nearest neighbours while several more marks sit just as close all
        # around - that is still a crowd, not two clean parts of one animal, and must not merge.
        near_i = d[i].copy(); near_i[j] = np.inf
        near_j = d[j].copy(); near_j[i] = np.inf
        if near_i.min() < lonely_dist or near_j.min() < lonely_dist:
            continue
        sx = np.clip((xs[i] + (xs[j] - xs[i]) * t).round().astype(int), 0, w - 1)
        sy = np.clip((ys[i] + (ys[j] - ys[i]) * t).round().astype(int), 0, h - 1)
        if dark[sy, sx].min() >= bridge_frac * min(dkv[i], dkv[j]):
            drop[j if dv[j] < dv[i] else i] = True
    return drop


def _peaks_dist_nms(dog, small_win, min_gap):
    """Local maxima found with a SMALL window (high recall: two close larvae can both survive), then thinned with a
    circular minimum-distance rule instead of a square window. A square dilation window forces anything inside it down
    to one peak even when two real larvae sit at opposite corners; a circular gap of the same radius does not.

    A flat (equal-valued) patch of "dark" - a big debris speck, a shadow, a thick pen mark - ties for local max at every
    pixel in the patch under a small window, which would otherwise multiply into dozens of spurious peaks. Each connected
    group of tied candidate pixels is first collapsed to its single centroid before the distance thinning runs.

    Both steps are done with numpy array ops or a spatial hash grid, never a Python loop over every candidate scanning
    the whole image - a busy tray can have thousands of candidates, and that loop once timed out the live API."""
    small_win = _odd(small_win)
    cand = dog == cv2.dilate(dog, np.ones((small_win, small_win), np.uint8))
    if not cand.any():
        return cand
    n, labels = cv2.connectedComponents(cand.astype(np.uint8))
    ys_c, xs_c = np.nonzero(cand)                            # every candidate pixel, with its component id and value
    lbl_c = labels[ys_c, xs_c]
    val_c = dog[ys_c, xs_c]
    counts = np.maximum(np.bincount(lbl_c, minlength=n), 1)
    sum_x = np.bincount(lbl_c, weights=xs_c.astype(np.float64), minlength=n)
    sum_y = np.bincount(lbl_c, weights=ys_c.astype(np.float64), minlength=n)
    maxval = np.full(n, -np.inf, np.float64)
    np.maximum.at(maxval, lbl_c, val_c)                       # one centroid + peak value per component, all in one pass
    xs = (sum_x[1:] / counts[1:]).astype(np.float32)
    ys = (sum_y[1:] / counts[1:]).astype(np.float32)
    vals = maxval[1:]

    order = np.argsort(-vals)
    xs_o, ys_o = xs[order], ys[order]
    keep = np.zeros(len(order), bool)
    cell = max(1.0, min_gap)                                  # a spatial hash grid: only the ~9 neighbouring cells are
    grid = {}                                                 # checked per point, not every point kept so far
    g2 = min_gap * min_gap
    for i in range(len(order)):
        x, y = float(xs_o[i]), float(ys_o[i])
        gx, gy = int(x // cell), int(y // cell)
        clear = True
        for ddx in (-1, 0, 1):
            if not clear:
                break
            for ddy in (-1, 0, 1):
                for kx2, ky2 in grid.get((gx + ddx, gy + ddy), ()):
                    if (kx2 - x) ** 2 + (ky2 - y) ** 2 < g2:
                        clear = False
                        break
                if not clear:
                    break
        if clear:
            keep[i] = True
            grid.setdefault((gx, gy), []).append((x, y))
    out = np.zeros_like(cand)
    yi = np.clip(np.round(ys_o[keep]).astype(int), 0, cand.shape[0] - 1)
    xi = np.clip(np.round(xs_o[keep]).astype(int), 0, cand.shape[1] - 1)
    out[yi, xi] = True
    return out


def detect(image_bgr: np.ndarray, p: Params = None):
    """Return (boxes Nx5 float32 in original pixel coords, meta dict)."""
    p = p or Params()
    h0, w0 = image_bgr.shape[:2]
    s = p.work_width / float(w0)
    interp = cv2.INTER_AREA if s < 1 else cv2.INTER_CUBIC
    img = cv2.resize(image_bgr, (p.work_width, max(1, int(round(h0 * s)))), interpolation=interp) if s != 1 else image_bgr
    h, w = img.shape[:2]
    inv = 1.0 / s

    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY).astype(np.float32)
    k = _odd(p.bg_kernel)
    bg = cv2.morphologyEx(gray, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (k, k)))
    bg = cv2.GaussianBlur(bg, (0, 0), 15)
    dark = np.clip(bg - gray, 0, None)
    dog = cv2.GaussianBlur(dark, (0, 0), p.sigma_small) - cv2.GaussianBlur(dark, (0, 0), p.sigma_large)

    # roundness of each spot from the curvature of the darkness map (peak-like in both directions = round)
    b = cv2.GaussianBlur(dark, (0, 0), 2.0)
    ixx = cv2.Sobel(b, cv2.CV_32F, 2, 0, ksize=3)
    iyy = cv2.Sobel(b, cv2.CV_32F, 0, 2, ksize=3)
    ixy = cv2.Sobel(b, cv2.CV_32F, 1, 1, ksize=3)
    mean_c = (ixx + iyy) / 2
    diff_c = np.sqrt(((ixx - iyy) / 2) ** 2 + ixy ** 2)
    strongest = -(mean_c - diff_c)
    weakest = -(mean_c + diff_c)
    blob = np.where((strongest > 0) & (weakest > 0), weakest / np.maximum(strongest, 1e-6), 0.0)

    win = _odd(p.peak_window)
    if p.dist_nms:
        peak = _peaks_dist_nms(dog, 3, p.min_gap if p.min_gap else win)
    else:
        peak = dog == cv2.dilate(dog, np.ones((win, win), np.uint8))
    strong = peak & (dog > p.dog_thr)
    weak = peak & (dog > p.dog_thr_weak) & (dog <= p.dog_thr) & (blob > p.blob_min)
    if p.strong_shape:
        # a real larva's small dark head/eye spot is a fairly consistent, moderate roundness; false marks on tile
        # grout, scratches and debris run to extremes (measured on real photos: false marks outside the tray had
        # a far wider, more erratic spread of this same roundness score than real larvae inside it - see
        # eval/shape_merge_glare.py and data/reference/NOTES.md).
        strong &= (blob >= p.strong_blob_lo) & (blob <= p.strong_blob_hi)

    if p.roi:
        cx, cy, r = p.roi
        roi = np.zeros((h, w), np.uint8)
        cv2.circle(roi, (int(cx * w), int(cy * h)), int(r * max(h, w)), 1, -1)
        strong &= roi.astype(bool)
        weak &= roi.astype(bool)

    # the flash reflection: no larva can be read on it, and its dark centre is not a larva
    glare = cv2.dilate((gray >= 250).astype(np.uint8), np.ones((_odd(2 * p.glare_grow + 1),) * 2, np.uint8)).astype(bool)
    glare_dropped = int(((strong | weak) & glare).sum())
    strong &= ~glare
    weak &= ~glare

    if isinstance(p.tray, str) and p.tray == "fit":
        norm, _ = fit_tray(image_bgr)
        pts = np.nonzero(strong | weak)
        norm = refine_tray_by_marks(norm, np.c_[pts[1], pts[0]] * inv, w0, h0)
        poly = np.asarray([(x * (w0 - 1), y * (h0 - 1)) for x, y in norm], np.float32)
    elif isinstance(p.tray, str) and p.tray == "preset":
        poly = np.asarray(preset_tray(w0, h0), np.float32)
    else:
        poly = np.asarray(p.tray, np.float32) if p.tray is not None else None
    if poly is not None:
        tm = np.zeros((h, w), np.uint8)
        cv2.fillPoly(tm, [np.round(poly * s).astype(np.int32)], 1)
        outside = int(((strong | weak) & ~tm.astype(bool)).sum())
        strong &= tm.astype(bool)
        weak &= tm.astype(bool)
    else:
        outside = 0

    ys1, xs1 = np.nonzero(strong)
    ys2, xs2 = np.nonzero(weak)
    merged = 0
    if p.merge_body and len(xs1) + len(xs2) > 1:
        n1 = len(xs1)
        xs_all = np.concatenate([xs1, xs2]); ys_all = np.concatenate([ys1, ys2])
        drop = _merge_body_pairs(dark, dog, xs_all, ys_all, p.merge_lo, p.merge_hi, p.merge_bridge, p.merge_lonely)
        merged = int(drop.sum())
        xs1, ys1 = xs_all[:n1][~drop[:n1]], ys_all[:n1][~drop[:n1]]
        xs2, ys2 = xs_all[n1:][~drop[n1:]], ys_all[n1:][~drop[n1:]]
    hidden = 0
    hx = hy = np.array([], int)
    if p.cluster_ratio > 0 and len(xs1) > 20:
        xs1, ys1, extra_x, extra_y = _split_clusters(dark, xs1, ys1, p.cluster_ratio)
        hidden = len(extra_x)
        hx, hy = extra_x, extra_y
    half = 5.0
    boxes = [[(x - half) * inv, (y - half) * inv, (x + half) * inv, (y + half) * inv, 1.0] for x, y in zip(xs1, ys1)]
    boxes += [[(x - half) * inv, (y - half) * inv, (x + half) * inv, (y + half) * inv, 0.7] for x, y in zip(xs2, ys2)]
    boxes += [[(x - half) * inv, (y - half) * inv, (x + half) * inv, (y + half) * inv, 0.5] for x, y in zip(hx, hy)]   # 0.5 = estimated hidden larva
    meta = {"engine": "classical", "strong": int(len(xs1)), "weak_round": int(len(xs2)), "outside_tray": outside, "hidden_estimated": hidden, "body_merged": merged, "glare_ignored": glare_dropped,
            "glare_fraction": round(float(glare.mean()), 4),
            **{k: v for k, v in asdict(p).items() if k != "tray"}}
    return np.asarray(boxes, np.float32).reshape(-1, 5), meta
