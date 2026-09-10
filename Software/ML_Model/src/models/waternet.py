"""
WaterNet-K210 : a tiny water-segmentation CNN that fits the Kendryte K210 KPU.

WHAT IT DOES
------------
Input : one camera frame, 128x128 RGB
Output: a 32x32 "water map" - for each cell, how confident we are that it is water (0..1)

It does NOT decide "flood / no flood". It only finds the water. Everything
physical (level, coverage, turbidity, debris) is plain arithmetic on this map,
and the flood decision is made later from how those numbers CHANGE over time.

WHY THE ARCHITECTURE LOOKS LIKE THIS  (K210 KPU hardware limits)
---------------------------------------------------------------
The KPU is fixed-function silicon, not a general processor. It accepts only:
  * Conv2D with 1x1 or 3x3 kernels        (no 5x5, no 7x7, no dilation)
  * DepthwiseConv2D with 3x3 kernels only
  * MaxPool / AvgPool 2x2 stride 2, or 4x4 stride 4
  * Add (residual), Concat (channels), BatchNorm, ReLU / ReLU6
  * ~2 MB of on-chip memory for the largest activation
Anything else silently falls back to the slow RISC-V cores, or fails to
convert at all.

Two deliberate safety choices:
  1. Downsampling uses DepthwiseConv(stride 1) + MaxPool2x2, NOT
     DepthwiseConv(stride 2). Stride-2 depthwise is a known K210 weak spot.
  2. Single output tensor. Multi-output models are less reliable through the
     older nncase compiler, and we don't need a second head: lens-obstruction
     is detected analytically (image sharpness) and turbidity/debris are
     computed from the mask.
"""

import tensorflow as tf
from tensorflow.keras import layers as L

# BatchNorm keeps a running estimate of each layer's mean/variance, used at
# inference time. Keras defaults to momentum=0.99, which needs thousands of
# steps to converge. On a short run those estimates stay near their starting
# values and, stacked 16 layers deep, the error compounds until every output
# collapses to ~0.5 - the model appears totally broken while actually being
# fine.
#
# This matters more here than in normal training: BatchNorm is FOLDED INTO the
# convolution weights when we export to .kmodel, so bad running estimates are
# baked permanently into the file we flash onto the board.
BN_MOMENTUM = 0.9


# --------------------------------------------------------------------------
# KPU-legal building blocks. Nothing here may use an op the KPU cannot run.
# --------------------------------------------------------------------------

def _conv_bn(x, filters, kernel=3, stride=1, name=""):
    """Plain convolution + batch-norm + ReLU6. Kernel MUST be 1 or 3."""
    assert kernel in (1, 3), f"KPU supports only 1x1 and 3x3 convolutions, got {kernel}"
    x = L.Conv2D(filters, kernel, strides=stride, padding="same",
                 use_bias=False, name=f"{name}_conv")(x)
    x = L.BatchNormalization(momentum=BN_MOMENTUM, name=f"{name}_bn")(x)
    return L.ReLU(max_value=6.0, name=f"{name}_relu")(x)


def _sep_block(x, filters, downsample=False, name=""):
    """
    Depthwise-separable block: the workhorse of MobileNet.

    A 3x3 depthwise conv (one filter per channel - cheap) followed by a 1x1
    pointwise conv (mixes channels). Gives most of the power of a full 3x3
    conv at a fraction of the cost, which is what makes the model tiny.

    Downsampling is done by MaxPool AFTER the block, never by stride-2
    depthwise - see module docstring.
    """
    x = L.DepthwiseConv2D(3, strides=1, padding="same", use_bias=False,
                          name=f"{name}_dw")(x)
    x = L.BatchNormalization(momentum=BN_MOMENTUM, name=f"{name}_dwbn")(x)
    x = L.ReLU(max_value=6.0, name=f"{name}_dwrelu")(x)

    x = L.Conv2D(filters, 1, padding="same", use_bias=False, name=f"{name}_pw")(x)
    x = L.BatchNormalization(momentum=BN_MOMENTUM, name=f"{name}_pwbn")(x)
    x = L.ReLU(max_value=6.0, name=f"{name}_pwrelu")(x)

    if downsample:
        x = L.MaxPooling2D(2, strides=2, padding="same", name=f"{name}_pool")(x)
    return x


def _residual(x, filters, name=""):
    """Same-shape block with a skip connection, so gradients flow further."""
    y = _sep_block(x, filters, downsample=False, name=name)
    return L.Add(name=f"{name}_add")([x, y])


# --------------------------------------------------------------------------
# The model
# --------------------------------------------------------------------------

def build_waternet(input_size=128, width=1.0, use_decoder=True, name="waternet"):
    """
    Build WaterNet.

    input_size  : square input resolution (128 is the sweet spot for K210)
    width       : channel multiplier. 1.0 ~= 95k parameters ~= 95 KB on flash.
    use_decoder : True  -> 32x32 output mask (stride 4)  - sharper waterline
                  False -> 16x16 output mask (stride 8)  - maximum compatibility

    Returns a Keras model. Output is a sigmoid map in [0, 1].
    """
    def ch(n):
        # keep channel counts a multiple of 8 - the KPU processes in groups
        return max(8, int(round(n * width / 8)) * 8)

    inp = L.Input(shape=(input_size, input_size, 3), name="image")

    # NOTE ON INPUT SCALING - this bit is easy to get wrong and silently
    # breaks the model on-chip:
    #   * During TRAINING we feed float pixels already scaled to 0..1.
    #   * The nncase compiler also normalises its calibration images to 0..1.
    #   * On the K210 the camera hands over raw uint8 0..255, and the compiled
    #     kmodel maps that to 0..1 itself using the calibration it recorded.
    # So there must be NO rescaling layer here. Adding one divides by 255 a
    # second time and the deployed model sees near-zero pixels.
    x = inp

    # ---- Encoder: progressively smaller, progressively more channels -------
    x = _conv_bn(x, ch(24), kernel=3, stride=2, name="stem")      # 64x64
    x = _sep_block(x, ch(48), name="b1")                          # 64x64
    x = _sep_block(x, ch(64), downsample=True, name="b2")         # 32x32
    skip = _residual(x, ch(64), name="b3")                        # 32x32  <-- kept for decoder
    x = _sep_block(skip, ch(128), downsample=True, name="b4")     # 16x16
    x = _residual(x, ch(128), name="b5")                          # 16x16
    x = _sep_block(x, ch(160), name="b6")                         # 16x16  deepest features

    # ---- Decoder: recover spatial detail so the waterline is sharp ---------
    if use_decoder:
        # Nearest-neighbour upsample: no learned weights, cheap, KPU-friendly.
        x = L.UpSampling2D(2, interpolation="nearest", name="up")(x)   # 32x32
        # Re-join the earlier, higher-resolution features. The deep layers know
        # "this region is water"; the shallow ones know exactly where the edge is.
        x = L.Concatenate(name="fuse")([x, skip])                      # 32x32
        x = _conv_bn(x, ch(96), kernel=1, name="dec1")
        x = _sep_block(x, ch(48), name="dec2")

    # ---- Output: one channel, sigmoid -> "how sure is this cell water?" ----
    x = L.Conv2D(1, 1, padding="same", name="logits")(x)
    out = L.Activation("sigmoid", name="water")(x)

    return tf.keras.Model(inp, out, name=name)


if __name__ == "__main__":
    m = build_waternet()
    m.summary()
    print(f"\nOutput shape : {m.output_shape}")
    print(f"Parameters   : {m.count_params():,}")
    print(f"Approx size  : {m.count_params()/1024:.0f} KB once quantised to 8-bit")
