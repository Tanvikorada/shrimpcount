import io
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
