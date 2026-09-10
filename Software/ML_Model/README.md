# WaterNet — on-node river vision for PrakritiNetX

A tiny water-segmentation CNN that runs on the **Kendryte K210** KPU and turns a
camera frame into physical measurements of the river.

> **It does not decide "flood / no flood".** It finds the water. Level,
> coverage, turbidity, turbulence and debris are then plain arithmetic on that
> water map, and the flood decision comes from how those numbers *change over
> time* — compared against this river's own learned normal, and correlated
> across nodes at the hub.
>
> This is deliberate. A single frame cannot show that a flood is coming, and a
> "flood/no-flood" image classifier learns the appearance of its training sites
> and collapses on a new camera angle. Measuring instead of classifying also
> means **we never need a photograph of a real flood** — which is fortunate,
> because we will not capture one.

---

## Status

| Stage | State |
|---|---|
| KPU-legal architecture | done — 90,401 params |
| Keras → TFLite → `.kmodel` toolchain | **working end to end** |
| Augmentation, incl. synthetic water-rise | done |
| Training pipeline | working (verified on synthetic data) |
| Trained on real river photos | **blocked — needs RIWA, see below** |
| On-board MaixPy firmware | written, **not yet run on hardware** |

Current build output:

```
build/waternet.kmodel      104 KB
  INPUT   1 x 3 x 128 x 128   uint8, straight from the camera
  OUTPUT  1 x 1 x 32  x 32    water confidence, 0..1
  Working memory   1.75 MB    (K210 has ~6 MB usable — this is the ceiling
                               on how much bigger the model can get)
```

---

## The one thing needed to finish

Download **RIWA** (River Water Segmentation Dataset, ~1,100 labelled river
photos) and unzip it anywhere under `datasets/raw/`:

<https://www.kaggle.com/datasets/franzwagner/river-water-segmentation-dataset>

The loader auto-discovers any layout with an `images/` folder beside a
`masks/` or `labels/` folder, so no rearranging is needed. Then:

```bash
.venv/Scripts/python.exe src/train.py --data datasets/raw --epochs 60
.venv/Scripts/python.exe src/export_kmodel.py --weights runs/waternet_best.h5 --calib <real-frames>
```

Useful additions if you have time: **ATLANTIS** (water bodies, ~5k images) and
**FloodNet** (flooded scenes — teaches what muddy, debris-laden water looks
like). More variety across different rivers beats more photos of one river.

---

## Why the architecture looks like this

The KPU is fixed-function silicon, not a general accelerator. It accepts only:

- Conv2D with **1×1 or 3×3** kernels — no 5×5, no 7×7, no dilation
- DepthwiseConv2D **3×3** only
- Pool 2×2/s2 or 4×4/s4 — `GlobalAveragePooling` is **not** a KPU op
- `Add`, `Concat`(channels), BatchNorm, ReLU/ReLU6
- ~2 MB for the largest activation

Two deliberate safety choices:

1. **Downsampling uses MaxPool, not stride-2 depthwise convolution.** Stride-2
   depthwise is a known K210 weak spot.
2. **Single output tensor.** Multi-output models are less reliable through the
   older `nncase`. No second head is needed anyway — lens obstruction is
   detected from image sharpness, and turbidity/debris come from the mask.

---

## Two bugs already caught, worth knowing about

**1. Double-scaling the input.** `ncc` normalises its calibration images to
0–1 itself. An extra `Rescaling(1/255)` layer inside the model divides by 255 a
second time, so the deployed model sees near-black pixels. There must be no
rescaling layer in the graph.

**2. BatchNorm running statistics — this one is nasty.** Keras defaults to
`momentum=0.99`, which needs thousands of steps to converge. On a short run the
estimates stay near their starting values and, stacked 16 layers deep, the
error compounds until every output collapses to ~0.5.

It presents as *"the model doesn't work"* while the model is actually fine:

```
inference mode (moving stats):  range 0.519..0.562   IoU 0.405   broken
training  mode (batch stats) :  range 0.001..1.000   IoU 0.862   fine
```

This matters more here than in ordinary training, because **BatchNorm is folded
into the convolution weights during `.kmodel` export.** Bad statistics get baked
permanently into the file you flash — it loads fine and predicts nothing.

Fixed by setting `BN_MOMENTUM = 0.9`. `export_kmodel.py` now also refuses to
export quietly: it checks the output spread and warns if the model is producing
near-constant values.

---

## Manufacturing floods we never photographed

`raise_water()` in `src/data/augment.py` takes a calm-river photo, pushes the
waterline up the bank, fills the newly-flooded strip with real water texture
mirrored from below the old line, and returns the exactly-known new mask.

Measured: **40% → 68% water coverage from a single photograph.**

That produces correctly-labelled training images at water levels that have
never occurred — precisely the regime we must detect. Stepping it upward frame
by frame also turns one real photo into a convincing rising-river sequence for
the demo.

---

## Layout

```
src/models/waternet.py      the model — every KPU restriction encoded here
src/data/augment.py         augmentation + synthetic water rise
src/data/dataset.py         auto-discovering image/mask loader
src/train.py                training (Dice + BCE loss, IoU metric)
src/export_kmodel.py        Keras -> TFLite -> ncc -> .kmodel, with a sanity check
tools/ncc/ncc.exe           nncase v0.2 compiler (kmodel v4, the format MaixPy loads)
tools/make_synthetic_dataset.py   pipeline smoke-test data, not real training data
firmware_ref/maixpy_node.py on-board firmware: burst capture, inference, features, packet
```

**Note on `nncase`:** the `nncase` package on PyPI (v2.x) targets the **K230**,
not the K210. The K210 needs the older `ncc` v0.2, vendored in `tools/ncc/`,
which produces kmodel **v4** — the format MaixPy actually loads.

---

## Environment

TensorFlow does not support Python 3.14, so training runs in a separate
Python 3.11 environment at `.venv/` (created with `uv`). The `ncc` compiler is
a standalone binary and needs no Python at all.

---

## Not yet done

- Trained on real river imagery (needs RIWA)
- `maixpy_node.py` run on actual hardware — points needing on-device checks are
  marked `# VERIFY`
- Site calibration: two known-height marks in frame, measured with a tape at
  installation. Without it, levels are relative rather than in metres.
- Surface velocity from the burst (gives discharge in m³/s — the quantity the
  Central Water Commission actually forecasts on)
