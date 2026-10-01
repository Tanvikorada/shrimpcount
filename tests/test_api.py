import io
import json
import sys
from pathlib import Path

import cv2
import numpy as np
from fastapi.testclient import TestClient

sys.path.append(str(Path(__file__).resolve().parents[1]))
sys.path.append(str(Path(__file__).resolve().parent))
from api.main import app  # noqa: E402
from test_classical import tray  # noqa: E402

client = TestClient(app)


def jpeg(img):
    ok, buf = cv2.imencode(".jpg", img)
    assert ok
    return ("t.jpg", io.BytesIO(buf.tobytes()), "image/jpeg")


def test_health_lists_classical_engine():
    r = client.get("/health").json()
    assert r["status"] == "ok" and "classical" in r["engines"]


def test_count_uses_classical_when_no_model():
    r = client.post("/count", files={"file": jpeg(tray(50))})
    assert r.status_code == 200
    body = r.json()
    assert body["engine"] == "classical"
    assert abs(body["count"] - 50) <= 4
    assert len(body["detections"]) == body["count"]


def test_forcing_onnx_without_model_is_503():
    assert client.post("/count?engine=onnx", files={"file": jpeg(tray(5))}).status_code == 503


def test_bad_image_and_bad_roi():
    assert client.post("/count", files={"file": ("a.jpg", io.BytesIO(b"nope"), "image/jpeg")}).status_code == 400
    assert client.post("/count?roi=2,2,2", files={"file": jpeg(tray(5))}).status_code == 400
    assert client.post("/count?roi=abc", files={"file": jpeg(tray(5))}).status_code == 400


def test_roi_limits_the_count():
    img = tray(120, seed=9)
    full = client.post("/count", files={"file": jpeg(img)}).json()["count"]
    inside = client.post("/count?roi=0.5,0.5,0.25", files={"file": jpeg(img)}).json()["count"]
    assert 0 < inside < full


def test_count_accepts_a_larva_size_and_reports_it():
    r = client.post("/count?size=large", files={"file": jpeg(tray(50))})
    assert r.status_code == 200
    assert r.json()["larva_size"] == "large"
    assert client.post("/count", files={"file": jpeg(tray(50))}).json()["larva_size"] == "small"   # the default


def test_an_unknown_larva_size_is_refused():
    assert client.post("/count?size=huge", files={"file": jpeg(tray(50))}).status_code == 422


def test_tray_fit_starts_from_the_operators_own_outline():
    """A prior sent by the app (its saved outline, or its last fit) should seed the fit, not the generic preset - on
    a photo with no clear tray edge, fit_tray falls back to returning that prior unchanged (see test_classical.py)."""
    from api.main import PRESET_TRAY_NORM
    flat = np.full((1280, 1280, 3), 200, np.uint8)
    own = [[0.2, 0.1], [0.8, 0.1], [0.95, 0.2], [0.95, 0.8], [0.8, 0.9], [0.2, 0.9], [0.05, 0.8], [0.05, 0.2]]
    body = client.post(f"/count?prior={json.dumps(own)}", files={"file": jpeg(flat)}).json()
    assert all(abs(a[0] - b[0]) < 0.02 and abs(a[1] - b[1]) < 0.02 for a, b in zip(body["tray_fit"], own))
    assert any(abs(a[0] - b[0]) > 0.02 or abs(a[1] - b[1]) > 0.02 for a, b in zip(body["tray_fit"], PRESET_TRAY_NORM))


def test_a_malformed_prior_falls_back_to_the_preset_instead_of_failing():
    r = client.post("/count?prior=not-json", files={"file": jpeg(tray(5))})
    assert r.status_code == 200
    assert r.json()["tray_fit"] is not None
