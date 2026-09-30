"""Assign whole batches to train/val/test (~70/15/15 by image count). Never splits a batch.

Writes data/splits.csv (image_file, batch_id, split). Deterministic for a given --seed.
Needs at least 3 batches. With fewer, it refuses, because a split within one batch would leak.

Usage: python tools/split_by_batch.py [--manifest data/manifest.csv] [--seed 0]
"""
import argparse
import csv
import random
from collections import defaultdict
from pathlib import Path


def assign(batch_sizes: dict, seed: int, ratios=(0.70, 0.15, 0.15)) -> dict:
    if len(batch_sizes) < 3:
        raise SystemExit(f"Need >= 3 batches for a leak-free split, found {len(batch_sizes)}.")
    total = sum(batch_sizes.values())
    targets = dict(zip(("train", "val", "test"), (total * r for r in ratios)))
    batches = list(batch_sizes)
    random.Random(seed).shuffle(batches)
    batches.sort(key=lambda b: -batch_sizes[b])  # place big batches first
    filled = dict.fromkeys(targets, 0)
    out = {}
    # guarantee each split gets at least one batch, smallest deficits first
    for split, b in zip(("test", "val", "train"), batches[:3]):
        out[b] = split
        filled[split] += batch_sizes[b]
    for b in batches[3:]:
        split = max(targets, key=lambda s: targets[s] - filled[s])
        out[b] = split
        filled[split] += batch_sizes[b]
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--manifest", default="data/manifest.csv")
    ap.add_argument("--out", default="data/splits.csv")
    ap.add_argument("--seed", type=int, default=0)
    args = ap.parse_args()

    with open(args.manifest, newline="", encoding="utf-8") as f:
        rows = list(csv.DictReader(f))
    sizes = defaultdict(int)
    for r in rows:
        sizes[r["batch_id"]] += 1
    mapping = assign(sizes, args.seed)

    with open(args.out, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["image_file", "batch_id", "split"])
        for r in rows:
            w.writerow([r["image_file"], r["batch_id"], mapping[r["batch_id"]]])

    per = defaultdict(int)
    for r in rows:
        per[mapping[r["batch_id"]]] += 1
    print({s: per[s] for s in ("train", "val", "test")}, "batches:", dict(mapping))


if __name__ == "__main__":
    main()
