"""Assemble a self-contained folder for deploying the counting API to a serverless host (Vercel).

Copies only what the classical engine needs. The ONNX runtime and model are left out: they are too large for
serverless and are not needed until a model is trained.
Usage: python scripts/prepare_api_deploy.py   ->  deploy/api/
"""
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "deploy" / "api"

OUT.mkdir(parents=True, exist_ok=True)   # never wipe the folder: it also holds the Vercel link (.vercel/)

shutil.copy(ROOT / "api" / "main.py", OUT / "main.py")
shutil.copy(ROOT / "api" / "classical.py", OUT / "classical.py")
shutil.copy(ROOT / "training" / "tiling.py", OUT / "tiling.py")

(OUT / "requirements.txt").write_text("fastapi\npython-multipart\nnumpy\nopencv-python-headless\n", encoding="utf-8")
(OUT / "vercel.json").write_text('{\n  "functions": { "main.py": { "maxDuration": 30 } }\n}\n', encoding="utf-8")
print("wrote", OUT, sorted(p.name for p in OUT.iterdir()))
