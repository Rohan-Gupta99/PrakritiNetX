"""
Augmentation for river-water segmentation.

Why this file matters more than usual
-------------------------------------
Public river datasets are small (RIWA is ~1,100 images). A camera bolted to a
hillside for years will see conditions no dataset contains: monsoon downpour,
dawn fog, glare off the water, a raindrop sitting on the lens, night IR.

Augmentation is how a small dataset covers those. Every transform here
corresponds to something that will physically happen to the deployed camera.

The last one - synthetic water rise - is the important one: it manufactures
labelled images of the river at water levels we have never photographed, which
is how we get flood-condition training data without waiting for a flood.
"""

import numpy as np


# ---------------------------------------------------------------------------
# Photometric: same scene, different light. Mask is unchanged.
# ---------------------------------------------------------------------------

def jitter_light(img, rng, strength=1.0):
    """Brightness, contrast, saturation and colour-cast wobble.

    This is the single most valuable augmentation here. The camera sees the
    same river under dawn, noon, dusk and storm light, and a model that has
    only seen noon will fail at dawn.
    """
    img = img * rng.uniform(1 - 0.45 * strength, 1 + 0.45 * strength)
    mean = img.mean()
    img = (img - mean) * rng.uniform(1 - 0.4 * strength, 1 + 0.4 * strength) + mean
    grey = img.mean(axis=2, keepdims=True)
    img = grey + (img - grey) * rng.uniform(1 - 0.5 * strength, 1 + 0.5 * strength)
    img = img * rng.uniform(1 - 0.12 * strength, 1 + 0.12 * strength, size=(1, 1, 3))
    return np.clip(img, 0, 1)


def add_haze(img, rng, strength=1.0):
    """Fog / mist / valley haze - washes out contrast, common at dawn."""
    a = rng.uniform(0.15, 0.6) * strength
    sky = rng.uniform(0.6, 0.95)
    # heavier haze toward the top of the frame, as real distance haze behaves
    grad = np.linspace(1.0, 0.35, img.shape[0])[:, None, None]
    return np.clip(img * (1 - a * grad) + sky * a * grad, 0, 1)


def add_noise(img, rng, strength=1.0):
    """Sensor noise - severe on a cheap OV2640 at dusk and at high gain."""
    sigma = rng.uniform(0.005, 0.05) * strength
    return np.clip(img + rng.normal(0, sigma, img.shape), 0, 1)


def blur(img, rng, strength=1.0):
    """Defocus, condensation or a dirty lens. Cheap smoothing, repeated."""
    k = int(rng.integers(1, 1 + max(1, int(3 * strength))))
    for _ in range(k):
        p = np.pad(img, ((1, 1), (1, 1), (0, 0)), mode="edge")
        img = (p[:-2, 1:-1] + p[2:, 1:-1] + p[1:-1, :-2] + p[1:-1, 2:] + 4 * img) / 8.0
    return img


def add_rain(img, rng, strength=1.0):
    """Rain streaks - present in exactly the conditions we care about."""
    h, w, _ = img.shape
    layer = np.zeros((h, w), np.float32)
    n = int(rng.integers(30, 200) * strength)
    slant = rng.uniform(-0.35, 0.35)
    for _ in range(n):
        x0, y0 = int(rng.integers(0, w)), int(rng.integers(0, h))
        ln = int(rng.integers(6, 22))
        for t in range(ln):
            y, x = y0 + t, int(x0 + t * slant)
            if 0 <= y < h and 0 <= x < w:
                layer[y, x] = rng.uniform(0.3, 0.8)
    return np.clip(img + layer[..., None] * 0.6, 0, 1)


def add_lens_droplet(img, rng):
    """A water drop stuck on the lens: a local blurred, brightened blob.

    Included deliberately so the model does not confuse an obstruction with
    water. Field cameras get these constantly.
    """
    h, w, _ = img.shape
    cy, cx = int(rng.integers(0, h)), int(rng.integers(0, w))
    r = int(rng.integers(max(4, h // 14), max(6, h // 5)))
    yy, xx = np.ogrid[:h, :w]
    m = (((yy - cy) ** 2 + (xx - cx) ** 2) <= r * r).astype(np.float32)[..., None]
    soft = blur(img.copy(), rng, strength=3.0)
    return np.clip(img * (1 - m) + (soft * 0.85 + 0.15) * m, 0, 1)


def to_night_ir(img, rng):
    """
    Approximate a night frame under infra-red illumination.

    Colour disappears (IR is monochrome), contrast drops, noise rises, and the
    scene is lit from the camera so nearer things are brighter.

    IMPORTANT: at night, turbidity cannot be measured - there is no colour.
    The firmware must flag night frames so the hub never compares a night
    turbidity reading against a daytime baseline.
    """
    grey = img.mean(axis=2, keepdims=True).repeat(3, axis=2)
    h = img.shape[0]
    falloff = np.linspace(0.55, 1.15, h)[:, None, None]   # bottom (near) brighter
    grey = np.clip(grey * falloff * rng.uniform(0.5, 0.9), 0, 1)
    return np.clip(grey + rng.normal(0, 0.045, grey.shape), 0, 1)


# ---------------------------------------------------------------------------
# Geometric: image and mask must move together.
# ---------------------------------------------------------------------------

def _resize(a, out_hw):
    """Nearest-neighbour resize. Keeps masks crisp and needs no extra library."""
    oh, ow = out_hw
    yi = np.linspace(0, a.shape[0] - 1, oh).astype(np.int32)
    xi = np.linspace(0, a.shape[1] - 1, ow).astype(np.int32)
    return a[yi][:, xi]


def random_crop_resize(img, mask, out_hw, rng, min_scale=0.6):
    """Random zoom + crop. Simulates slight camera shift and adds scale variety."""
    h, w, _ = img.shape
    s = rng.uniform(min_scale, 1.0)
    ch, cw = max(8, int(h * s)), max(8, int(w * s))
    y = int(rng.integers(0, h - ch + 1))
    x = int(rng.integers(0, w - cw + 1))
    img_c = _resize(img[y:y + ch, x:x + cw], out_hw)
    mask_c = _resize(mask[y:y + ch, x:x + cw, None], out_hw)[..., 0]
    return img_c, mask_c


# ---------------------------------------------------------------------------
# THE IMPORTANT ONE: manufacture a flood we never photographed.
# ---------------------------------------------------------------------------

def raise_water(img, mask, rng, max_frac=0.35):
    """
    Push the waterline UP the bank, and return the matching new mask.

    We will never photograph our own river in flood during this project. But a
    flood, visually, is mostly "the same water, higher up the bank". So:

      1. find the top edge of the water in each column
      2. move that edge up by k pixels
      3. fill the newly-flooded strip with water texture mirrored from just
         below the old waterline, so it keeps the real colour and ripple
      4. blend the seam so there is no hard splice line
      5. return the new mask, which is exactly known

    Result: correctly-labelled training images of the river at water levels
    that have never occurred, which is precisely the regime we must detect.

    It also drives the DEMO - stepping k upward frame by frame turns a single
    real photograph into a convincing rising-river sequence.
    """
    h, w, _ = img.shape
    water = mask > 0.5
    if water.sum() < h * w * 0.02:          # too little water to extrapolate from
        return img, mask

    k = int(rng.uniform(0.05, max_frac) * h)
    if k < 1:
        return img, mask

    out_i, out_m = img.copy(), mask.copy()
    for x in range(w):
        col = np.flatnonzero(water[:, x])
        if col.size == 0:
            continue
        top = int(col.min())                  # current waterline in this column
        new_top = max(0, top - k)
        if new_top >= top:
            continue
        strip = top - new_top
        # sample real water from just below the current line, mirrored upward
        src = out_i[top:top + strip, x]
        if src.shape[0] < strip:              # not enough water below - tile it
            reps = int(np.ceil(strip / max(1, src.shape[0])))
            src = np.tile(src, (reps, 1))[:strip]
        out_i[new_top:top, x] = src[::-1]
        out_m[new_top:top, x] = 1.0

    # soften the new seam so the model cannot learn to spot a splice artifact
    out_i = np.clip(out_i * 0.88 + blur(out_i, rng, strength=1.0) * 0.12, 0, 1)
    return out_i, out_m


# ---------------------------------------------------------------------------
# The pipeline actually used during training
# ---------------------------------------------------------------------------

def augment(img, mask, out_hw, rng, night_prob=0.15, rise_prob=0.35):
    """Apply a random, realistic combination. img/mask are float32 in 0..1."""
    if rng.random() < rise_prob:
        img, mask = raise_water(img, mask, rng)

    img, mask = random_crop_resize(img, mask, out_hw, rng)

    if rng.random() < 0.5:                                  # mirror left-right
        img, mask = img[:, ::-1].copy(), mask[:, ::-1].copy()

    if rng.random() < night_prob:
        img = to_night_ir(img, rng)
    else:
        img = jitter_light(img, rng)
        if rng.random() < 0.25:
            img = add_haze(img, rng)
        if rng.random() < 0.20:
            img = add_rain(img, rng)

    if rng.random() < 0.30:
        img = blur(img, rng, strength=1.0)
    if rng.random() < 0.10:
        img = add_lens_droplet(img, rng)
    if rng.random() < 0.50:
        img = add_noise(img, rng)

    return img.astype(np.float32), (mask > 0.5).astype(np.float32)
