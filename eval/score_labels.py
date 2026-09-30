"""Score the counter against corrected marks exported from the app ("Export corrected marks" in More).

The person's corrections are the truth: marks they kept plus marks they added are real larvae; marks they removed are wrong.
For each photo this re-runs the CURRENT counter on the stored photo and reports
  found / missed  (recall against the corrected marks)   wrong  (marks with no larva)   count error vs the corrected total.
A mark matches a truth mark when it is within MATCH pixels of it (in the stored photo, at most 1600 wide).

Usage: python eval/score_labels.py path/to/shrimpcount-marks-DATE.zip [--size auto|small|large]
Writes eval/out/label_scores.csv. This is measured on the photos in the file only: state how many trays that was.
"""
import argparse
import csv
import json
import sys
import zipfile
from pathlib import Path

import cv2
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
sys.path.append(str(ROOT / "api"))
from classical import SIZE_PROFILES, Params, detect, size_for_stage  # noqa: E402

MATCH = 9.0


def score_one(img, label, size):
    truth = np.array([[m["x"], m["y"]] for m in label["marks"] if m["status"] in ("kept", "added")], float).reshape(-1, 2)
    boxes, _ = detect(img, Params(tray="fit", **SIZE_PROFILES[size]))
    mine = np.c_[(boxes[:, 0] + boxes[:, 2]) / 2, (boxes[:, 1] + boxes[:, 3]) / 2] if len(boxes) else np.zeros((0, 2))
    # only what would be counted: inside the water outline the person saw
    if len(label["outline"]) > 2 and len(mine):
        poly = np.array(label["outline"], np.float32).reshape(-1, 1, 2)
        mine = np.array([p for p in mine if cv2.pointPolygonTest(poly, (float(p[0]), float(p[1])), False) >= 0]).reshape(-1, 2)
    used = np.zeros(len(truth), bool)
    hit = 0
    for p in mine:                                   # greedy nearest match, each truth mark used once
        if not len(truth):
            break
        d = np.hypot(truth[:, 0] - p[0], truth[:, 1] - p[1])
        d[used] = 1e9
        j = int(d.argmin())
        if d[j] <= MATCH:
            used[j] = True; hit += 1
    return dict(truth=len(truth), counted=len(mine), matched=hit, missed=len(truth) - hit, wrong=len(mine) - hit)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("zip")
    ap.add_argument("--size", default="auto", choices=["auto", "small", "large"])
    a = ap.parse_args()
    rows = []
    with zipfile.ZipFile(a.zip) as z:
        for name in sorted(n for n in z.namelist() if n.startswith("labels/") and n.endswith(".json")):
            label = json.loads(z.read(name))
            img = cv2.imdecode(np.frombuffer(z.read(label["photo"]), np.uint8), cv2.IMREAD_COLOR)
            size = a.size if a.size != "auto" else size_for_stage(label.get("pl_stage") or "")
            r = score_one(img, label, size)
            r.update(id=label["id"][:8], batch=label.get("batch", ""), pl=label.get("pl_stage", ""), size=size, app_saved=label.get("final_count"), hand=label.get("hand_count"))
            rows.append(r)
            print(f"{r['id']} {r['batch']:>8} {r['pl']:>5} {size:>5}  truth {r['truth']:5d}  counted {r['counted']:5d}  missed {r['missed']:4d}  wrong {r['wrong']:4d}  error {100 * (r['counted'] - r['truth']) / max(1, r['truth']):+6.1f}%")
    if not rows:
        print("no labelled photos in that file"); return
    out = ROOT / "eval" / "out"; out.mkdir(exist_ok=True)
    with open(out / "label_scores.csv", "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0])); w.writeheader(); w.writerows(rows)
    T = sum(r["truth"] for r in rows); C = sum(r["counted"] for r in rows)
    M = sum(r["matched"] for r in rows)
    err = [abs(r["counted"] - r["truth"]) / max(1, r["truth"]) * 100 for r in rows]
    print(f"\n{len(rows)} photos: recall {100 * M / max(1, T):.1f}%  precision {100 * M / max(1, C):.1f}%  total count error {100 * (C - T) / max(1, T):+.1f}%  mean per-photo error {np.mean(err):.1f}%")
    print("Truth = what the person accepted, so it inherits any marks they did not bother to fix. Report how many trays this covers.")


if __name__ == "__main__":
    main()
