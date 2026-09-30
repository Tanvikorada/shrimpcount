"""Train YOLO on the larva dataset. Run on Colab/Kaggle GPU (pip install ultralytics).

Tiny objects: train at high imgsz on the full frames, or pre-tile the images. Start with imgsz=1280.
Usage: python training/train.py --data data/yolo/data.yaml [--model yolo11n.pt] [--imgsz 1280]
Not yet run on real data. Tune hyperparameters after the first baseline.
"""
import argparse

from ultralytics import YOLO


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", required=True)
    ap.add_argument("--model", default="yolo11n.pt")
    ap.add_argument("--imgsz", type=int, default=1280)
    ap.add_argument("--epochs", type=int, default=100)
    ap.add_argument("--batch", type=int, default=8)
    ap.add_argument("--project", default="runs")
    args = ap.parse_args()

    model = YOLO(args.model)
    model.train(data=args.data, imgsz=args.imgsz, epochs=args.epochs, batch=args.batch,
                project=args.project, name="larva", patience=25,
                mosaic=0.5, flipud=0.5, fliplr=0.5, degrees=90,   # tray images have no natural 'up'
                hsv_h=0.0, hsv_s=0.2, hsv_v=0.3, max_det=3000)
    metrics = model.val(split="val")
    print("val mAP50:", metrics.box.map50)
    model.export(format="onnx", imgsz=args.imgsz, simplify=True)


if __name__ == "__main__":
    main()
