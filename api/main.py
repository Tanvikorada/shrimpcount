"""ShrimpCount inference API. POST /count with an image -> count, boxes, timing.

Loads an Ultralytics-exported ONNX model (single class 'larva') from MODEL_PATH.
Assumes ONNX output shape (1, 5, N) = [cx, cy, w, h, score] per candidate, tile input imgsz x imgsz.
Not yet tested against a real trained model. Verify output shape after the first export.
"""
import os
import sys
import time
from pathlib import Path

import cv2
import numpy as np
from fastapi import FastAPI, File, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware

sys.path.append(str(Path(__file__).resolve().parents[1] / "training"))
sys.path.append(str(Path(__file__).resolve().parent))
from tiling import sliced_detect  # noqa: E402
from classical import PRESET_TRAY_NORM, SIZE_PROFILES, Params, detect as classical_detect, fit_tray, refine_tray_by_marks  # noqa: E402

MODEL_PATH = os.environ.get("MODEL_PATH", "model/best.onnx")
TILE = int(os.environ.get("TILE", "640"))
CONF = float(os.environ.get("CONF", "0.25"))
MAX_BYTES = 15 * 1024 * 1024

app = FastAPI(title="ShrimpCount API", version="0.1.0")
app.add_middleware(CORSMiddleware, allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
                   allow_methods=["*"], allow_headers=["*"])

_session = None


def get_session():
    global _session
    if _session is None:
        if not Path(MODEL_PATH).exists():
            raise HTTPException(503, f"Model not found at {MODEL_PATH}. Train and export first.")
        import onnxruntime as ort
        _session = ort.InferenceSession(MODEL_PATH, providers=["CPUExecutionProvider"])
    return _session


def onnx_detector(session, size: int):
    name = session.get_inputs()[0].name

    def run(tile: np.ndarray) -> np.ndarray:
        h, w = tile.shape[:2]
        s = size / max(h, w)
        resized = cv2.resize(tile, (int(w * s), int(h * s)))
        canvas = np.full((size, size, 3), 114, np.uint8)
        canvas[:resized.shape[0], :resized.shape[1]] = resized
        blob = canvas[:, :, ::-1].transpose(2, 0, 1)[None].astype(np.float32) / 255.0
        out = session.run(None, {name: blob})[0][0]           # (5, N)
        cx, cy, bw, bh, score = out[:5]
        boxes = np.stack([cx - bw / 2, cy - bh / 2, cx + bw / 2, cy + bh / 2, score], axis=1)
        boxes[:, :4] /= s                                        # back to tile pixels
        return boxes

    return run


@app.get("/health")
def health():
    return {"status": "ok", "model_present": Path(MODEL_PATH).exists(), "engines": ["classical"] + (["onnx"] if Path(MODEL_PATH).exists() else [])}


def parse_roi(roi: str | None):
    if not roi:
        return None
    try:
        cx, cy, r = (float(v) for v in roi.split(","))
    except ValueError:
        raise HTTPException(400, "roi must be 'cx,cy,r' as fractions of the image, e.g. 0.5,0.5,0.45")
    if not (0 <= cx <= 1 and 0 <= cy <= 1 and 0 < r <= 1):
        raise HTTPException(400, "roi values must be between 0 and 1")
    return (cx, cy, r)


@app.post("/count")
async def count(
    file: UploadFile = File(...),
    engine: str = Query("auto", pattern="^(auto|classical|onnx)$"),
    roi: str | None = Query(None, description="Optional circle 'cx,cy,r' (fractions) to count inside, e.g. the tray"),
    min_area: float | None = Query(None, gt=0, description="Classical engine: smallest blob (px^2) treated as a larva"),
    size: str = Query("small", pattern="^(small|large)$", description="Larva size: small (up to about PL12) or large (PL13 and up)"),
):
    data = await file.read()
    if len(data) > MAX_BYTES:
        raise HTTPException(413, "Image too large (max 15 MB).")
    img = cv2.imdecode(np.frombuffer(data, np.uint8), cv2.IMREAD_COLOR)
    if img is None:
        raise HTTPException(400, "Could not read image.")

    model_ready = Path(MODEL_PATH).exists()
    if engine == "onnx" and not model_ready:
        raise HTTPException(503, f"Model not found at {MODEL_PATH}. Train and export first, or use engine=classical.")
    use = "onnx" if (engine == "onnx" or (engine == "auto" and model_ready)) else "classical"

    t0 = time.perf_counter()
    meta = {}
    if use == "onnx":
        boxes = sliced_detect(img, onnx_detector(get_session(), TILE), tile=TILE, conf=CONF)
    else:
        params = Params(roi=parse_roi(roi), **SIZE_PROFILES[size])
        if min_area:
            params.min_area = min_area
        boxes, meta = classical_detect(img, params)
    try:
        norm = fit_tray(img)[0]
        if use == "classical" and len(boxes):
            norm = refine_tray_by_marks(norm, np.c_[(boxes[:, 0] + boxes[:, 2]) / 2, (boxes[:, 1] + boxes[:, 3]) / 2], img.shape[1], img.shape[0])
        tray_fit = [[round(x, 4), round(y, 4)] for x, y in norm]
    except Exception:                                   # never fail a count because the outline could not be fitted
        tray_fit = None
    return {
        "count": int(len(boxes)),
        "engine": use,
        "image_size": {"width": img.shape[1], "height": img.shape[0]},
        "detections": [{"x1": float(b[0]), "y1": float(b[1]), "x2": float(b[2]),
                        "y2": float(b[3]), "confidence": round(float(b[4]), 3)} for b in boxes],
        "processing_ms": round((time.perf_counter() - t0) * 1000),
        "larva_size": size if use == "classical" else None,
        "meta": {k: meta[k] for k in ("strong", "weak_round", "glare_ignored", "glare_fraction", "hidden_estimated") if k in meta},
        # starting outline of the tray floor (fractions of the photo). The app lets the operator adjust it and saves it.
        "tray_preset": PRESET_TRAY_NORM,
        "tray_fit": tray_fit,
    }
