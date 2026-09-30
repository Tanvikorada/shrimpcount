import sys
from pathlib import Path

import numpy as np

sys.path.append(str(Path(__file__).resolve().parents[1] / "training"))
from tiling import nms, sliced_detect, tile_coords  # noqa: E402


def test_tiles_cover_image():
    h, w = 1500, 2100
    cover = np.zeros((h, w), bool)
    for x0, y0, x1, y1 in tile_coords(h, w, 640, 0.2):
        cover[y0:y1, x0:x1] = True
    assert cover.all()


def test_small_image_single_tile():
    assert tile_coords(300, 400, 640) == [(0, 0, 400, 300)]


def test_nms_removes_duplicates():
    b = np.array([[0, 0, 10, 10, .9], [1, 1, 11, 11, .8], [100, 100, 110, 110, .7]], np.float32)
    assert len(nms(b)) == 2


def test_no_double_count_across_tile_overlap():
    """A single object sitting in the overlap zone of several tiles must count once."""
    img = np.zeros((1000, 1400, 3), np.uint8)
    obj = (500, 500, 520, 520)  # global coords

    def detector(tile):
        # Not called with offset info, so emulate via the tile's content marker.
        ys, xs = np.nonzero(tile[:, :, 0])
        if len(xs) == 0:
            return np.zeros((0, 5))
        return np.array([[xs.min(), ys.min(), xs.max() + 1, ys.max() + 1, .9]])

    img[obj[1]:obj[3], obj[0]:obj[2], 0] = 255
    assert len(sliced_detect(img, detector, tile=640, overlap=0.3)) == 1
