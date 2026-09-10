"""
Generate a small synthetic river dataset.

This is NOT training data for the real model - synthetic scenes are far too
simple and a model trained only on these will not work on a real river.

It exists for two honest reasons:
  1. to prove the training pipeline runs end to end before real data arrives
  2. to give a reproducible smoke test that needs no download

Real training must use RIWA or an equivalent set of photographed rivers.

    python tools/make_synthetic_dataset.py --n 120
"""

import argparse
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent


def make_scene(rng, h=240, w=320):
    """A crude river scene: sky, far bank, water, with an irregular waterline."""
    img = np.zeros((h, w, 3), np.float32)

    # waterline wanders across the frame
    base = rng.integers(int(h * 0.35), int(h * 0.75))
    x = np.arange(w)
    line = (base
            + np.sin(x / rng.uniform(25, 90) + rng.uniform(0, 6)) * rng.uniform(2, 12)
            + np.sin(x / rng.uniform(8, 20) + rng.uniform(0, 6)) * rng.uniform(1, 4))
    line = np.clip(line, 4, h - 5).astype(int)

    sky = rng.uniform([0.45, 0.5, 0.55], [0.95, 0.95, 1.0])
    bank = rng.uniform([0.20, 0.22, 0.12], [0.55, 0.50, 0.35])
    water = rng.uniform([0.10, 0.15, 0.15], [0.45, 0.45, 0.50])

    yy = np.arange(h)[:, None]
    is_water = yy >= line[None, :]

    img[:] = np.where(is_water[..., None], water, bank)
    horizon = max(2, int(base * rng.uniform(0.25, 0.6)))
    img[:horizon] = sky

    # texture: ripples on water, roughness on the bank
    img += rng.normal(0, 0.035, img.shape)
    # shape (h,1,1) so it broadcasts across width and colour channels
    ripple = (np.sin(yy / rng.uniform(1.5, 4.0) + rng.uniform(0, 6)) * 0.03)[..., None]
    img += np.where(is_water[..., None], ripple, 0.0)

    return np.clip(img, 0, 1), is_water.astype(np.float32)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--n", type=int, default=120)
    ap.add_argument("--out", default="datasets/raw/_synthetic")
    args = ap.parse_args()

    out = ROOT / args.out
    (out / "images").mkdir(parents=True, exist_ok=True)
    (out / "masks").mkdir(parents=True, exist_ok=True)

    rng = np.random.default_rng(42)
    for i in range(args.n):
        img, msk = make_scene(rng)
        Image.fromarray((img * 255).astype(np.uint8)).save(out / "images" / f"s{i:04d}.jpg", quality=92)
        Image.fromarray((msk * 255).astype(np.uint8)).save(out / "masks" / f"s{i:04d}.png")

    print(f"wrote {args.n} synthetic pairs to {out}")
    print("NOTE: pipeline smoke-test data only - real accuracy needs real river photos.")


if __name__ == "__main__":
    main()
