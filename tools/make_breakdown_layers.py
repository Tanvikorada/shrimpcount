"""Build the landing page's "From photo to number" layers from a REAL tray photo and the REAL counter.

    python tools/make_breakdown_layers.py data/raw/B02/31.jpg landing/media/layers

Every layer comes from the counter itself (api/classical.py), run with the app's settings:
  1_photo    the photo as captured (unchanged)
  2_outline  the tray the counter fits; everything outside it is ignored
  3_heat     what the counter sees: darkness against the local background
  4_spots    the head spots it keeps, one per larva
  5_marked   every counted larva ringed on the original photo (amber = estimated, e.g. stacked larvae)
Also writes tray-marks.json (normalized marks) next to the layers' parent folder.
"""
import json, sys
from pathlib import Path

import cv2
import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "api"))
from classical import SIZE_PROFILES, Params, detect, fit_tray, refine_tray_by_marks  # noqa: E402

src, out = Path(sys.argv[1]), Path(sys.argv[2])
out.mkdir(parents=True, exist_ok=True)
img = cv2.imread(str(src))
h, w = img.shape[:2]

# the count, exactly as the app gets it: detect, fit the tray, keep what falls inside the tray
p = Params(**SIZE_PROFILES["small"])
boxes, meta = detect(img, p)
cx, cy = (boxes[:, 0] + boxes[:, 2]) / 2, (boxes[:, 1] + boxes[:, 3]) / 2
norm = refine_tray_by_marks(fit_tray(img)[0], np.c_[cx, cy], w, h)
poly = np.array([(x * (w - 1), y * (h - 1)) for x, y in norm], np.float32)
inside = np.array([cv2.pointPolygonTest(poly, (float(x), float(y)), False) >= 0 for x, y in zip(cx, cy)])
cx, cy, conf = cx[inside], cy[inside], boxes[inside, 4]
print(f"{src}: {len(cx)} larvae inside the tray ({int((~inside).sum())} marks outside ignored)")

AQUA = (198, 214, 63)            # BGR of the site accent #3FD6C6
WARM = (54, 90, 255)             # BGR of the count marks #FF5A36
AMBER = (71, 181, 255)
S = 3                            # draw at 3x, then scale down, for smooth lines
big = lambda im: cv2.resize(im, (w * S, h * S), interpolation=cv2.INTER_CUBIC)
small = lambda im: cv2.resize(im, (w, h), interpolation=cv2.INTER_AREA)
P = np.round(poly * S).astype(np.int32)

# 1 the photo
cv2.imwrite(str(out / "1_photo.jpg"), img, [cv2.IMWRITE_JPEG_QUALITY, 92])

# 2 the tray the counter found: outside dimmed, outline in the accent colour
mask = np.zeros((h, w), np.uint8); cv2.fillPoly(mask, [np.round(poly).astype(np.int32)], 255)
dim = (img * 0.28).astype(np.uint8)
o = np.where(mask[..., None] > 0, img, dim)
o = big(o); cv2.polylines(o, [P], True, AQUA, 3 * S, cv2.LINE_AA)
cv2.imwrite(str(out / "2_outline.jpg"), small(o), [cv2.IMWRITE_JPEG_QUALITY, 90])

# 3 what the counter sees: darkness against the local background, as a glow
gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY).astype(np.float32)
k = p.bg_kernel * 2 + 1 if p.bg_kernel % 2 == 0 else p.bg_kernel
kk = int(round(k * w / p.work_width)) | 1
bg = cv2.GaussianBlur(cv2.morphologyEx(gray, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (kk, kk))), (0, 0), 15 * w / p.work_width)
dark = np.clip(bg - gray, 0, None); dark = np.clip(dark / np.percentile(dark[mask > 0], 99.5), 0, 1) ** 0.8
heat = np.zeros((h, w, 3), np.float32)
heat[..., 0] = dark * 1.0; heat[..., 1] = dark * 0.72; heat[..., 2] = dark * 0.25          # BGR: blue-teal glow
heat += (np.clip((dark - 0.7) / 0.3, 0, 1) ** 2)[..., None] * np.array([0.55, 0.75, 1.0])  # hottest spots warm
heat *= (0.25 + 0.75 * (mask > 0))[..., None]
cv2.imwrite(str(out / "3_heat.jpg"), (np.clip(heat, 0, 1) * 255).astype(np.uint8), [cv2.IMWRITE_JPEG_QUALITY, 90])

# 4 the head spots it keeps
sp = np.zeros((h * S, w * S, 3), np.uint8); sp[:] = (22, 16, 11)
cv2.polylines(sp, [P], True, (90, 96, 100), 2 * S, cv2.LINE_AA)
for x, y, c in zip(cx, cy, conf):
    cv2.circle(sp, (int(x * S), int(y * S)), int(3.2 * S), WARM if c >= 0.9 else AMBER, -1, cv2.LINE_AA)
cv2.imwrite(str(out / "4_spots.jpg"), small(sp), [cv2.IMWRITE_JPEG_QUALITY, 90])

# 5 every counted larva ringed on the original photo
mk = big(img); halo = mk.copy()
r = int(9 * S)
for x, y, c in zip(cx, cy, conf):
    cv2.circle(halo, (int(x * S), int(y * S)), r, (0, 0, 0), int(2.6 * S), cv2.LINE_AA)
mk = cv2.addWeighted(halo, 0.3, mk, 0.7, 0)
for x, y, c in zip(cx, cy, conf):
    cv2.circle(mk, (int(x * S), int(y * S)), r, WARM if c >= 0.9 else AMBER, int(1.5 * S), cv2.LINE_AA)
cv2.imwrite(str(out / "5_marked.jpg"), small(mk), [cv2.IMWRITE_JPEG_QUALITY, 92])

json.dump({"w": w, "h": h, "count": int(len(cx)), "source": src.name, "tray": [[round(x, 4), round(y, 4)] for x, y in norm],
           "marks": [[round(float(x) / w, 4), round(float(y) / h, 4), round(float(c), 2)] for x, y, c in zip(cx, cy, conf)]},
          open(out.parent / "tray-marks.json", "w"))
print("layers written to", out)
