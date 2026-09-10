"""
Loads river photo + water-mask pairs and feeds them to training.

Layout it understands
---------------------
Most public segmentation datasets (RIWA included) look like one of these:

    root/train/images/a.jpg   root/train/masks/a.png
    root/images/a.jpg         root/labels/a.png
    root/train/img/a.jpg      root/train/gt/a.png

This loader walks the folder, finds any directory of images that has a
sibling directory of masks, and pairs them up by filename. So you can just
unzip a dataset anywhere under datasets/raw/ and point at it - no need to
rearrange folders by hand.

A mask is any image where bright pixels mean water. Anything above half
brightness counts as water, which handles both 0/1 and 0/255 conventions.
"""

from pathlib import Path
import numpy as np
from PIL import Image

IMG_DIRS = {"images", "image", "img", "imgs", "photos", "jpegimages"}
MASK_DIRS = {"masks", "mask", "labels", "label", "gt", "groundtruth",
             "annotations", "segmentation", "segmentationclass", "targets"}
EXTS = {".jpg", ".jpeg", ".png", ".bmp", ".tif", ".tiff", ".webp"}


def find_pairs(root):
    """Walk `root` and return [(image_path, mask_path), ...]."""
    root = Path(root)
    pairs = []
    for img_dir in root.rglob("*"):
        if not img_dir.is_dir() or img_dir.name.lower() not in IMG_DIRS:
            continue
        # look for a mask directory beside it
        mask_dir = next((d for d in img_dir.parent.iterdir()
                         if d.is_dir() and d.name.lower() in MASK_DIRS), None)
        if mask_dir is None:
            continue
        # index masks by filename stem so extensions may differ (.jpg vs .png)
        by_stem = {p.stem: p for p in mask_dir.iterdir()
                   if p.suffix.lower() in EXTS}
        for ip in sorted(img_dir.iterdir()):
            if ip.suffix.lower() in EXTS and ip.stem in by_stem:
                pairs.append((ip, by_stem[ip.stem]))
    return pairs


def load_pair(img_path, mask_path, max_side=384):
    """Read one pair as float32 arrays in 0..1. Mask comes back binary."""
    img = Image.open(img_path).convert("RGB")
    msk = Image.open(mask_path).convert("L")

    if msk.size != img.size:                       # some datasets store them differently
        msk = msk.resize(img.size, Image.NEAREST)

    # Downscale big source photos once, up front. Training crops to 128 anyway,
    # and full-resolution decoding is the slowest part of the whole pipeline.
    if max(img.size) > max_side:
        s = max_side / max(img.size)
        wh = (max(8, int(img.width * s)), max(8, int(img.height * s)))
        img = img.resize(wh, Image.BILINEAR)
        msk = msk.resize(wh, Image.NEAREST)

    a = np.asarray(img, np.float32) / 255.0
    m = (np.asarray(msk, np.float32) / 255.0 > 0.5).astype(np.float32)
    return a, m


class RiverDataset:
    """Holds decoded pairs in memory and yields augmented training batches."""

    def __init__(self, pairs, size=128, out_stride=4, augment=True, seed=0, verbose=True):
        from data.augment import augment as aug_fn
        self._aug_fn = aug_fn
        self.size = size
        self.out = size // out_stride          # model predicts a smaller grid
        self.augment = augment
        self.rng = np.random.default_rng(seed)

        self.items = []
        skipped = 0
        for ip, mp in pairs:
            try:
                self.items.append(load_pair(ip, mp))
            except Exception:
                skipped += 1
        if verbose:
            extra = f", {skipped} unreadable" if skipped else ""
            print(f"      loaded {len(self.items)} pairs{extra}")
        if not self.items:
            raise RuntimeError("no usable image/mask pairs found")

    def __len__(self):
        return len(self.items)

    def _downscale_mask(self, m):
        """
        Shrink a full-size mask to the model's output grid.

        Uses the AVERAGE over each cell, not nearest-neighbour, so a cell that
        is half water becomes 0.5. That soft edge is what later lets us
        interpolate the waterline to better precision than the grid itself.
        """
        o = self.out
        h, w = m.shape
        ys = np.linspace(0, h, o + 1).astype(int)
        xs = np.linspace(0, w, o + 1).astype(int)
        out = np.empty((o, o), np.float32)
        for i in range(o):
            for j in range(o):
                blk = m[ys[i]:max(ys[i] + 1, ys[i + 1]), xs[j]:max(xs[j] + 1, xs[j + 1])]
                out[i, j] = blk.mean() if blk.size else 0.0
        return out

    def batch(self, n):
        """One training batch: (images NHWC float 0..1, masks NHW1 float 0..1)."""
        X = np.empty((n, self.size, self.size, 3), np.float32)
        Y = np.empty((n, self.out, self.out, 1), np.float32)
        for k in range(n):
            img, msk = self.items[int(self.rng.integers(0, len(self.items)))]
            if self.augment:
                img, msk = self._aug_fn(img, msk, (self.size, self.size), self.rng)
            else:
                from data.augment import _resize
                img = _resize(img, (self.size, self.size))
                msk = _resize(msk[..., None], (self.size, self.size))[..., 0]
            X[k] = img
            Y[k, ..., 0] = self._downscale_mask(msk)
        return X, Y

    def generator(self, batch_size):
        while True:
            yield self.batch(batch_size)
