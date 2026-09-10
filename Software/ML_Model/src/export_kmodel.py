"""
Export WaterNet to a .kmodel file that can be flashed onto the K210.

THE PIPELINE
------------
   Keras model  ->  TensorFlow Lite (float32)  ->  ncc  ->  .kmodel (uint8)

The `ncc` compiler (nncase v0.2) does the 8-bit quantisation itself. It needs a
"calibration set": a folder of representative photos. It runs them through the
model, watches the range of numbers at every layer, and picks the 8-bit scale
that loses the least accuracy.

  -> Calibration images should be REAL frames from the deployed camera.
     Random images still produce a valid file, which is all we need to prove
     the toolchain works, but accuracy will only be meaningful once the
     calibration set matches what the camera actually sees.

Usage:
    python src/export_kmodel.py                          # untrained smoke test
    python src/export_kmodel.py --weights runs/best.h5 --calib datasets/calib
"""

import argparse, os, shutil, subprocess, sys, time
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "src"))

NCC = ROOT / "tools" / "ncc" / "ncc.exe"


def make_placeholder_calibration(dst: Path, n: int, size: int):
    """
    Build stand-in calibration images for the smoke test.

    Not random noise - noise has a flat histogram and would give the quantiser
    an unrealistic picture. These are crude river-ish scenes (bright sky on
    top, darker textured water below) so the recorded activation ranges are at
    least in the right ballpark.
    """
    from PIL import Image
    dst.mkdir(parents=True, exist_ok=True)
    rng = np.random.default_rng(0)
    for i in range(n):
        horizon = rng.integers(size // 3, 2 * size // 3)
        img = np.zeros((size, size, 3), np.float32)
        img[:horizon] = rng.uniform(0.45, 0.95, 3) * 255      # sky / bank
        img[horizon:] = rng.uniform(0.15, 0.55, 3) * 255      # water
        img += rng.normal(0, 12, img.shape)                    # texture
        Image.fromarray(np.clip(img, 0, 255).astype(np.uint8)).save(dst / f"calib_{i:03d}.jpg", quality=90)
    return n


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--weights", default=None, help="trained .h5 weights (omit for an untrained smoke test)")
    ap.add_argument("--calib", default=None, help="folder of real calibration images")
    ap.add_argument("--out", default="build", help="output folder")
    ap.add_argument("--size", type=int, default=128)
    ap.add_argument("--width", type=float, default=1.0)
    ap.add_argument("--no-decoder", action="store_true", help="16x16 output instead of 32x32 (max compatibility)")
    args = ap.parse_args()

    os.environ.setdefault("TF_CPP_MIN_LOG_LEVEL", "3")
    import tensorflow as tf
    from models.waternet import build_waternet

    out = ROOT / args.out
    out.mkdir(parents=True, exist_ok=True)

    # ---- 1. Build the model ------------------------------------------------
    print("[1/4] Building model ...")
    model = build_waternet(input_size=args.size, width=args.width,
                           use_decoder=not args.no_decoder)
    if args.weights:
        model.load_weights(args.weights)
        print(f"      loaded weights from {args.weights}")
    else:
        print("      UNTRAINED (smoke test - output will be meaningless, that is expected)")
    print(f"      params={model.count_params():,}  in={model.input_shape[1:]}  out={model.output_shape[1:]}")

    # ---- 2. Keras -> TFLite ------------------------------------------------
    print("[2/4] Converting to TensorFlow Lite ...")
    conv = tf.lite.TFLiteConverter.from_keras_model(model)
    # Keep it float32: nncase does the quantising, not TFLite. Handing ncc an
    # already-quantised file is a common cause of conversion failure.
    tfl = conv.convert()
    tflite_path = out / "waternet.tflite"
    tflite_path.write_bytes(tfl)
    print(f"      {tflite_path.name}  {len(tfl)/1024:.0f} KB")

    # ---- 3. Calibration images --------------------------------------------
    if args.calib:
        calib = Path(args.calib)
        n = len(list(calib.glob("*.jpg")) + list(calib.glob("*.png")))
        print(f"[3/4] Calibration set: {calib}  ({n} real images)")
    else:
        calib = out / "calib_placeholder"
        if calib.exists():
            shutil.rmtree(calib)
        n = make_placeholder_calibration(calib, 32, args.size)
        print(f"[3/4] Calibration set: generated {n} placeholder images")

    # ---- 3b. Sanity check: is the model actually discriminating? -----------
    # BatchNorm is folded into the convolution weights during export, using the
    # running mean/variance estimates. If those never converged, the model
    # outputs a near-constant value everywhere - and the resulting .kmodel is
    # permanently broken. It flashes fine and predicts nothing.
    #
    # Catch it here rather than on a hillside.
    from PIL import Image
    probe = sorted(list(Path(calib).glob("*.jpg")) + list(Path(calib).glob("*.png")))[:16]
    if probe:
        batch = np.stack([
            np.asarray(Image.open(p).convert("RGB").resize((args.size, args.size)),
                       np.float32) / 255.0
            for p in probe])
        pred = model.predict(batch, verbose=0)
        spread = float(pred.max() - pred.min())
        print(f"      sanity check: output range {pred.min():.3f}..{pred.max():.3f} (spread {spread:.3f})")
        if spread < 0.25 and args.weights:
            print("\n  WARNING: the model produces almost the same value everywhere.")
            print("  It cannot distinguish water from anything else, and exporting it")
            print("  will bake that in. Usual cause: BatchNorm running statistics did")
            print("  not converge - train for more epochs before exporting.")
            print("  Continuing anyway, but do not trust this file on hardware.\n")

    # ---- 4. ncc -> .kmodel -------------------------------------------------
    print("[4/4] Compiling to .kmodel for K210 ...")
    kmodel_path = out / "waternet.kmodel"
    cmd = [str(NCC), "compile", str(tflite_path), str(kmodel_path),
           "-i", "tflite", "-t", "k210",
           "--dataset", str(calib),
           "--inference-type", "uint8",
           "--input-type", "uint8"]
    print("      $ " + " ".join(f'"{c}"' if " " in c else c for c in cmd))
    t0 = time.time()
    r = subprocess.run(cmd, capture_output=True, text=True)
    took = time.time() - t0

    tail = (r.stdout or "") + (r.stderr or "")
    for line in tail.strip().splitlines()[-25:]:
        print("      | " + line)

    if r.returncode != 0 or not kmodel_path.exists():
        print(f"\nFAILED (exit {r.returncode}) after {took:.1f}s")
        return 1

    kb = kmodel_path.stat().st_size / 1024
    print(f"\nSUCCESS in {took:.1f}s")
    print(f"  {kmodel_path}")
    print(f"  size {kb:.0f} KB   (K210 has 16 MB flash and 6 MB usable SRAM - plenty of headroom)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
