# ShrimpCount AI

YOLO-based shrimp postlarvae (PL) counting from a photo of a standardized sample tray. Built with a pilot hatchery in Andhra Pradesh.

**Scope:** counts a *sample* photographed on a fixed rig and saves a traceable record (photo + count + timestamp). It does not count an entire tank.

## Status
- Phase 0: data collection protocol (current, gating step)
- No dataset, no model, no code yet. Nothing is trained until real hatchery images exist.

## Phases
0. Capture protocol + manifest (`docs/capture-protocol.md`, `data/manifest.csv`)
1. Labeling + baseline model
2. Evaluation + failure analysis (decision gate)
3. Inference API + PWA (v0.1)
4. Pilot day at hatchery

## Rules
- Only report accuracy from the evaluation script on the held-out split.
- No synthetic data as a substitute for real hatchery images.
- Split by batch, never by random image.
- Free tiers only.
- No new product until v0.1 is in the partner's hands.

## Layout
```
data/       manifest.csv, splits (raw images NOT in git)
notebooks/  Colab training + evaluation
training/   train.py, tiling utils, config
eval/       evaluate_counts.py, plots
api/        FastAPI + ONNX inference
web/        React + Vite + Tailwind PWA
docs/       capture protocol, labeling guide, pilot results
```

## Status (2026-09-20)
**Blocked only on real images.** Everything that does not need them is built.

Built and tested (15 Python tests, 8 JS tests, production build, browser-checked with throwaway data):
- Counting API (`api/`): a classical, no-training counter works today; the YOLO/ONNX path is wired but has never seen a trained model. `POST /count?engine=auto|classical|onnx`.
- Data tools (`tools/`), evaluation (`eval/`), training scripts and Colab notebook (`training/`, `notebooks/`).
- Web app (`web/`): home dashboard with "needs attention", guided camera capture with live light/glare/level checks, tap-to-correct review, batches with a consistency chart, production log, PL quality checks, disease-test records, PL orders with payments, delivery certificate and invoice, traceability record, water quality, inventory, tasks, growth projection, price log, calculators, offline queue with AI check, backup and restore.
- Design comps: https://claude.ai/artifact/W7GdHsSnWQdjQSLbV6ar5Z

**Not validated on real data (expect fixes on first contact):** the classical counter's accuracy, `training/train.py`, `eval/predict_counts.py`, the ONNX output decoding in `api/main.py`, the live capture-check thresholds, and the app against a real model. The 60-marks-counted-as-60 result on a drawn test tray says nothing about real accuracy.

**Not built:** cloud sync (records live in one browser; use Settings > Backup), QR verification on certificates, Telugu/Hindi UI, on-device (offline) model.


## First real photos (2026-09-20): what we know
- 6 photos of one tray type (top-down, rectangular tray, warm light, flash reflection, ~1280x1280, ~90 KB each, so heavily compressed).
- The classical counter now finds larva head spots (`api/classical.py`). First version overcounted about 2x (it counted JPEG noise and faint tails); the current one reads 1,644-1,846 on the six photos (mean ~1,720).
- The pilot hatchery reports most trays are around 1,850. That is a rough ballpark, not a verified count, so it was used only as a sanity check and NOT to tune the counter. Against it the counter reads about 7% low, which is a hypothesis to test, not a measured error.
- Still no manual counts, so no accuracy is claimed. Needed: exact manual counts on several photos (two counters on some), plus original (uncompressed) files.

## Live test deployment (Vercel, free tier, 2026-09-20)
- Website + app (one site, 2026-09-26): https://shrimpcount-ai.vercel.app, with the app at /app/ (installable PWA). The old https://shrimpcount-app.vercel.app now only redirects there.
- Counting API: https://shrimpcount-api.vercel.app (`/health`, `POST /count`), classical engine only, no model, no data stored
- Test build only. Records live in each phone's browser (Settings > Backup). The API is open (CORS `*`) and unauthenticated.
- Redeploy the API: `python scripts/prepare_api_deploy.py`, then `cd deploy/api && npx vercel deploy --prod --yes`
- Redeploy the app: build it into the website (see `landing/README.md`, v5), then `cd landing && npx vercel deploy --prod --yes`. Do NOT deploy from `web/`: that folder is still linked to the old project and would replace the redirect.
- Phone photos are shrunk (only the copy sent for counting) to fit Vercel's 4.5 MB request limit; originals are kept.
- Local `.vercel/` and `.env.local` files are created by the CLI and must not be shared.


## When images arrive
1. Copy into `data/raw/<batch_id>/` (originals, unedited).
2. `python tools/check_images.py` (flags blur / glare / odd sizes / duplicates)
3. `python tools/make_manifest.py`, then fill `pl_stage` and `manual_count_a` (and `_b` on 30+ images) in `data/manifest.csv`.
4. Try the app first: it counts with the classical engine. Compare against manual counts with `eval/evaluate_counts.py` and tune `api/classical.py` `Params`.
5. Label per `docs/labeling-guide.md` (Roboflow/CVAT, YOLO export into `data/labels/`), `python tools/split_by_batch.py` (needs >= 3 batches), then train with `notebooks/train_colab.ipynb`.
6. Compare the classical and trained engines on the same held-out split. Only that number may be quoted.

## Run locally
```
python -m venv .venv
.venv/Scripts/pip install numpy pillow opencv-python-headless pandas matplotlib pytest fastapi python-multipart httpx onnxruntime "uvicorn[standard]"
.venv/Scripts/python -m uvicorn api.main:app --port 8000     # counting API
cd web && npm install && npm run dev                          # app (set VITE_API_URL if the API is elsewhere)
.venv/Scripts/python -m pytest tests && node --test web/src/lib/calc.test.mjs web/src/lib/growth.test.mjs web/src/lib/stats.test.mjs
```
Design notes and competitor research: `docs/feature-parity.md`, `docs/competitor-reference.md`.
