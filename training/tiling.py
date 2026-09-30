"""Sliced (tiled) inference for tiny objects. Shared by evaluation and the API.

Tiles the image with overlap, runs a detector on each tile, shifts boxes back to full-image
coordinates, and merges duplicates from overlap zones with NMS.
The detector is any callable: tile (H,W,3 uint8 BGR) -> array of [x1,y1,x2,y2,score] in tile coords.
"""
import numpy as np


def tile_coords(h: int, w: int, tile: int = 640, overlap: float = 0.2):
    step = max(1, int(tile * (1 - overlap)))
    ys = list(range(0, max(h - tile, 0) + 1, step)) or [0]
    xs = list(range(0, max(w - tile, 0) + 1, step)) or [0]
    if ys[-1] + tile < h:
        ys.append(h - tile)
    if xs[-1] + tile < w:
        xs.append(w - tile)
    return [(x, y, min(x + tile, w), min(y + tile, h)) for y in ys for x in xs]


def nms(boxes: np.ndarray, iou_thr: float = 0.5) -> np.ndarray:
    if len(boxes) == 0:
        return boxes
    x1, y1, x2, y2, s = boxes.T
    areas = (x2 - x1) * (y2 - y1)
    order = s.argsort()[::-1]
    keep = []
    while order.size:
        i = order[0]
        keep.append(i)
        xx1 = np.maximum(x1[i], x1[order[1:]])
        yy1 = np.maximum(y1[i], y1[order[1:]])
        xx2 = np.minimum(x2[i], x2[order[1:]])
        yy2 = np.minimum(y2[i], y2[order[1:]])
        inter = np.clip(xx2 - xx1, 0, None) * np.clip(yy2 - yy1, 0, None)
        iou = inter / (areas[i] + areas[order[1:]] - inter + 1e-9)
        order = order[1:][iou <= iou_thr]
    return boxes[keep]


def sliced_detect(image: np.ndarray, detector, tile: int = 640, overlap: float = 0.2,
                  conf: float = 0.25, iou_thr: float = 0.5) -> np.ndarray:
    h, w = image.shape[:2]
    all_boxes = []
    for x0, y0, x1, y1 in tile_coords(h, w, tile, overlap):
        det = np.asarray(detector(image[y0:y1, x0:x1]), dtype=np.float32).reshape(-1, 5)
        det = det[det[:, 4] >= conf]
        if len(det):
            det[:, [0, 2]] += x0
            det[:, [1, 3]] += y0
            all_boxes.append(det)
    if not all_boxes:
        return np.zeros((0, 5), np.float32)
    return nms(np.concatenate(all_boxes), iou_thr)
