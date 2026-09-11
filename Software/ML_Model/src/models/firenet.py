"""
FireNet-K210 : a tiny fire and smoke segmentation CNN for the Kendryte K210 KPU.

WHAT IT DOES
------------
Input : one camera frame, 128x128 RGB
Output: a 32x32 "fire map" - for each cell, how confident we are that it is fire/smoke (0..1)

This runs on specialized "Fire Nodes" installed on high ridges or towers.
It outputs a segmentation mask rather than a simple classification so that the
firmware can evaluate the SIZE and SHAPE of the fire, helping to filter out
false positives like the sun or streetlamps.

KPU HARDWARE CONSTRAINTS
------------------------
* Conv2D with 1x1 or 3x3 kernels
* DepthwiseConv2D with 3x3 kernels only
* MaxPool 2x2 stride 2
* Add, Concat, BatchNorm, ReLU / ReLU6
* ~6 MB absolute max working memory (activations)
"""

import tensorflow as tf
from tensorflow.keras import layers as L

# Locked momentum to prevent running stats from failing during short training runs.
# This is critical because BatchNorm is folded into KPU weights on export.
BN_MOMENTUM = 0.9

def _conv_bn(x, filters, kernel=3, stride=1, name=""):
    assert kernel in (1, 3), f"KPU supports only 1x1 and 3x3, got {kernel}"
    x = L.Conv2D(filters, kernel, strides=stride, padding="same",
                 use_bias=False, name=f"{name}_conv")(x)
    x = L.BatchNormalization(momentum=BN_MOMENTUM, name=f"{name}_bn")(x)
    return L.ReLU(max_value=6.0, name=f"{name}_relu")(x)

def _sep_block(x, filters, downsample=False, name=""):
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
    y = _sep_block(x, filters, downsample=False, name=name)
    return L.Add(name=f"{name}_add")([x, y])

def build_firenet(input_size=128, width=1.5, name="firenet"):
    """
    Build FireNet.
    
    width: channel multiplier. 1.5 makes the model "thicker" than waternet 
           to handle complex textures like smoke and fire vs sunset skies.
    """
    def ch(n):
        return max(8, int(round(n * width / 8)) * 8)

    inp = L.Input(shape=(input_size, input_size, 3), name="image")
    x = inp

    # ---- Encoder -------
    x = _conv_bn(x, ch(24), kernel=3, stride=2, name="stem")      # 64x64
    x = _sep_block(x, ch(48), name="b1")                          # 64x64
    x = _sep_block(x, ch(64), downsample=True, name="b2")         # 32x32
    skip = _residual(x, ch(64), name="b3")                        # 32x32  <-- skip connection
    
    x = _sep_block(skip, ch(128), downsample=True, name="b4")     # 16x16
    x = _residual(x, ch(128), name="b5")                          # 16x16
    x = _sep_block(x, ch(160), name="b6")                         # 16x16

    # ---- Decoder -------
    # Nearest-neighbour upsample is KPU friendly.
    x = L.UpSampling2D(2, interpolation="nearest", name="up")(x)   # 32x32
    x = L.Concatenate(name="fuse")([x, skip])                      # 32x32
    
    x = _conv_bn(x, ch(96), kernel=1, name="dec1")
    x = _sep_block(x, ch(48), name="dec2")

    # ---- Output -------
    x = L.Conv2D(1, 1, padding="same", name="logits")(x)
    out = L.Activation("sigmoid", name="fire_prob")(x)

    return tf.keras.Model(inp, out, name=name)

if __name__ == "__main__":
    m = build_firenet()
    m.summary()
    print(f"\nOutput shape : {m.output_shape}")
    print(f"Parameters   : {m.count_params():,}")
    print(f"Approx size  : {m.count_params()/1024:.0f} KB once quantised to 8-bit")
