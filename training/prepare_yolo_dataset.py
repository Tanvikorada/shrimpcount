"""Build an Ultralytics dataset folder from labeled images using data/splits.csv (split by batch).

Expects YOLO-format labels at <labels_dir>/<image stem>.txt (export from Roboflow/CVAT as 'YOLO').
Copies images+labels into <out>/{images,labels}/{train,val,test} and writes <out>/data.yaml.
Test images are copied too but never used by train.py. Only run evaluation on them at the end.

Usage: python training/prepare_yolo_dataset.py --raw data/raw --labels data/labels --out data/yolo
"""
import argparse
import csv
import shutil
from pathlib import Path


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--raw", default="data/raw")
    ap.add_argument("--labels", default="data/labels")
    ap.add_argument("--splits", default="data/splits.csv")
    ap.add_argument("--out", default="data/yolo")
    args = ap.parse_args()

    raw, labels, out = Path(args.raw), Path(args.labels), Path(args.out)
    missing = 0
    with open(args.splits, newline="", encoding="utf-8") as f:
        for r in csv.DictReader(f):
            src = raw / r["image_file"]
            lab = labels / (src.stem + ".txt")
            if not lab.exists():
                missing += 1
                continue
            for kind, path in (("images", src), ("labels", lab)):
                dst = out / kind / r["split"]
                dst.mkdir(parents=True, exist_ok=True)
                shutil.copy2(path, dst / path.name)
    (out / "data.yaml").write_text(
        f"path: {out.resolve().as_posix()}\ntrain: images/train\nval: images/val\ntest: images/test\n"
        "names:\n  0: larva\n", encoding="utf-8")
    print(f"Dataset written to {out}. Images skipped for missing labels: {missing}")


if __name__ == "__main__":
    main()
