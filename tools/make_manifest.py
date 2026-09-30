"""Scan data/raw/<batch_id>/* and add any new images to data/manifest.csv.

Existing rows (and any counts you typed in) are never overwritten. New columns are added to old manifests.
Skips folders starting with "_" (for example _duplicates) so moved files do not come back.

Columns:
  sample_id      photos of the SAME tray share a sample_id (e.g. B01-T1). Leave blank if unknown.
  pl_stage       the hatchery's own statement only. Never guess it.
  manual_count_a / _b   careful manual counts (two counters on some).
  reference_count   the the reference app result for that photo or tray, if known.
Usage: python tools/make_manifest.py [--raw data/raw] [--manifest data/manifest.csv]
"""
import argparse
import csv
from pathlib import Path

COLUMNS = ["image_file", "batch_id", "sample_id", "pl_stage", "manual_count_a", "manual_count_b", "reference_count", "notes"]
EXTS = {".jpg", ".jpeg", ".png", ".webp", ".heic", ".tif", ".tiff"}


def read_manifest(path: Path):
    if not path.exists():
        return []
    with path.open(newline="", encoding="utf-8") as f:
        return [{c: r.get(c, "") for c in COLUMNS} for r in csv.DictReader(f)]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--raw", default="data/raw")
    ap.add_argument("--manifest", default="data/manifest.csv")
    args = ap.parse_args()

    raw, mpath = Path(args.raw), Path(args.manifest)
    rows = [r for r in read_manifest(mpath) if not r["image_file"].startswith("EXAMPLE_")]
    known = {r["image_file"] for r in rows}

    added = 0
    for p in sorted(raw.rglob("*")):
        rel_parts = p.relative_to(raw).parts
        if p.suffix.lower() not in EXTS or any(part.startswith("_") for part in rel_parts):
            continue
        rel = p.relative_to(raw).as_posix()
        if rel in known:
            continue
        batch = rel_parts[0] if len(rel_parts) > 1 else "UNKNOWN"
        rows.append({**{c: "" for c in COLUMNS}, "image_file": rel, "batch_id": batch})
        added += 1

    mpath.parent.mkdir(parents=True, exist_ok=True)
    with mpath.open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=COLUMNS)
        w.writeheader()
        w.writerows(rows)

    print(f"{len(rows)} rows ({added} new). Missing manual_count_a: {sum(1 for r in rows if not r['manual_count_a'])}. "
          f"Missing reference_count: {sum(1 for r in rows if not r['reference_count'])}. Missing sample_id: {sum(1 for r in rows if not r['sample_id'])}.")


if __name__ == "__main__":
    main()
