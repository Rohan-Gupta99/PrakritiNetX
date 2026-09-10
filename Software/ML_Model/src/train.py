"""
Train WaterNet to find water in a river photo.

    python src/train.py --data datasets/raw --epochs 40

What it optimises
-----------------
A combination of two losses:

  * Binary cross-entropy  - "is each cell water?", judged cell by cell
  * Dice loss             - judges the OVERLAP of the whole predicted region
                            against the truth

Dice is included because the two classes are unbalanced: in a typical frame
most cells are bank, sky and rock, and only some are water. A model optimising
cross-entropy alone can score well by leaning toward "not water" everywhere.
Dice cares about the shape of the water region, so it resists that.

What we actually watch
----------------------
IoU (intersection over union) on held-out validation images. Accuracy is a
misleading number here for the same class-imbalance reason - a model that
never predicts water can still look 80% "accurate".
"""

import argparse, os, sys, time
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "src"))


def dice_bce_loss(y_true, y_pred):
    import tensorflow as tf
    y_true = tf.cast(y_true, tf.float32)
    bce = tf.keras.losses.binary_crossentropy(y_true, y_pred)
    bce = tf.reduce_mean(bce)
    num = 2.0 * tf.reduce_sum(y_true * y_pred) + 1.0
    den = tf.reduce_sum(y_true) + tf.reduce_sum(y_pred) + 1.0
    return bce + (1.0 - num / den)


def iou_metric(y_true, y_pred):
    import tensorflow as tf
    t = tf.cast(y_true > 0.5, tf.float32)
    p = tf.cast(y_pred > 0.5, tf.float32)
    inter = tf.reduce_sum(t * p)
    union = tf.reduce_sum(t) + tf.reduce_sum(p) - inter
    return inter / (union + 1e-6)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", default="datasets/raw", help="folder containing the dataset(s)")
    ap.add_argument("--epochs", type=int, default=40)
    ap.add_argument("--batch", type=int, default=16)
    ap.add_argument("--steps", type=int, default=120, help="batches per epoch")
    ap.add_argument("--size", type=int, default=128)
    ap.add_argument("--width", type=float, default=1.0)
    ap.add_argument("--lr", type=float, default=2e-3)
    ap.add_argument("--val-frac", type=float, default=0.15)
    ap.add_argument("--out", default="runs")
    ap.add_argument("--no-decoder", action="store_true")
    args = ap.parse_args()

    os.environ.setdefault("TF_CPP_MIN_LOG_LEVEL", "3")
    import tensorflow as tf
    from data.dataset import find_pairs, RiverDataset
    from models.waternet import build_waternet

    out_dir = ROOT / args.out
    out_dir.mkdir(parents=True, exist_ok=True)

    # ---- data -------------------------------------------------------------
    print(f"[1/4] Scanning {args.data} for image/mask pairs ...")
    pairs = find_pairs(ROOT / args.data if not Path(args.data).is_absolute() else args.data)
    if not pairs:
        print("\n  No image/mask pairs found.\n"
              "  Unzip a segmentation dataset under datasets/raw/ - any layout with an\n"
              "  images/ folder beside a masks/ (or labels/) folder will be picked up.\n"
              "  Recommended: RIWA - kaggle.com/datasets/franzwagner/river-water-segmentation-dataset")
        return 1
    print(f"      found {len(pairs)} pairs")

    rng = np.random.default_rng(0)
    idx = rng.permutation(len(pairs))
    n_val = max(1, int(len(pairs) * args.val_frac))
    val_pairs = [pairs[i] for i in idx[:n_val]]
    trn_pairs = [pairs[i] for i in idx[n_val:]]

    stride = 8 if args.no_decoder else 4
    print(f"[2/4] Decoding images ...")
    print(f"   train:", end=" ")
    train_ds = RiverDataset(trn_pairs, args.size, stride, augment=True, seed=1)
    print(f"   val  :", end=" ")
    val_ds = RiverDataset(val_pairs, args.size, stride, augment=False, seed=2)

    # Validation set is fixed so the number means the same thing every epoch.
    Xv, Yv = val_ds.batch(min(len(val_ds), 96))

    # ---- model ------------------------------------------------------------
    print("[3/4] Building model ...")
    model = build_waternet(args.size, args.width, use_decoder=not args.no_decoder)
    print(f"      {model.count_params():,} parameters, output {model.output_shape[1:]}")

    steps = args.steps
    sched = tf.keras.optimizers.schedules.CosineDecay(args.lr, args.epochs * steps, alpha=0.02)
    model.compile(optimizer=tf.keras.optimizers.Adam(sched),
                  loss=dice_bce_loss, metrics=[iou_metric])

    ckpt = out_dir / "waternet_best.h5"
    cbs = [
        tf.keras.callbacks.ModelCheckpoint(str(ckpt), monitor="val_iou_metric",
                                           mode="max", save_best_only=True,
                                           save_weights_only=True, verbose=0),
        tf.keras.callbacks.EarlyStopping(monitor="val_iou_metric", mode="max",
                                         patience=12, restore_best_weights=True, verbose=1),
    ]

    # ---- train ------------------------------------------------------------
    print(f"[4/4] Training {args.epochs} epochs x {steps} steps (batch {args.batch}) ...")
    t0 = time.time()
    hist = model.fit(train_ds.generator(args.batch),
                     steps_per_epoch=steps, epochs=args.epochs,
                     validation_data=(Xv, Yv), callbacks=cbs, verbose=2)
    mins = (time.time() - t0) / 60

    best = max(hist.history["val_iou_metric"])
    print(f"\nDone in {mins:.1f} min.  Best validation IoU: {best:.3f}")
    print(f"Weights: {ckpt}")
    print(f"\nNext:  python src/export_kmodel.py --weights {ckpt} --calib <folder-of-real-frames>")
    return 0


if __name__ == "__main__":
    sys.exit(main())
