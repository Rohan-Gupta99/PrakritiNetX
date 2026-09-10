"""
PrakritiNetX vision node - MaixPy firmware for the Kendryte K210.

  ####################################################################
  #  NOT YET RUN ON HARDWARE. Written against the MaixPy API but      #
  #  untested on a real board - expect small fixes on first flash.    #
  #  Every spot needing on-device verification is marked  # VERIFY    #
  ####################################################################

WHAT THIS DOES, ONCE PER WAKE CYCLE (every ~15 minutes)
-------------------------------------------------------
  1. wake, start the camera
  2. take a BURST of 5 frames about half a second apart
  3. run waternet.kmodel on each -> a 32x32 map of "is this water?"
  4. turn those maps into physical numbers:
        water level, coverage, turbidity, turbulence, debris, lens health
  5. send one compact binary packet to the ESP32 over UART
  6. power down

It deliberately makes NO flood decision. It measures; the ESP32 compares
against this river's learned normal, and the hub correlates across nodes.

FLASHING
--------
  waternet.kmodel  ->  flash offset 0x300000
  this file        ->  /sd/main.py  (or boot.py in internal flash)
"""

import sensor, image, time, gc
from machine import UART
from fpioa_manager import fm
import KPU as kpu

# ---------------------------------------------------------------------------
# Site configuration - SET THESE AT INSTALLATION, per node
# ---------------------------------------------------------------------------

NODE_ID = 1

MODEL_ADDR = 0x300000       # where waternet.kmodel sits in SPI flash
IN_SIZE    = 128            # model input  (128 x 128)
OUT_SIZE   = 32             # model output (32 x 32 grid)

# The river channel inside the frame, in output-grid cells (col0, row0, col1, row1).
# The camera never moves, so this is fixed once with a tape measure and a photo.
# Everything outside it (sky, road, trees) is ignored entirely.
ROI = (4, 10, 28, 32)

# Calibration: two points on a gauge board / bridge pier whose real heights are
# known. Converts a grid row into metres.            # VERIFY on the real site
CAL_ROW_A,  CAL_HEIGHT_A = 28, 0.00     # low mark: grid row 28 == 0.00 m
CAL_ROW_B,  CAL_HEIGHT_B = 12, 3.50     # high mark: grid row 12 == 3.50 m

# A patch of something in frame whose true colour NEVER changes - concrete, a
# boulder, a painted board. Used to cancel out sunlight so that turbidity means
# "how muddy" rather than "what time of day is it".  (col0,row0,col1,row1)
REF_PATCH = (2, 2, 8, 7)

BURST_N     = 5             # frames per wake cycle
BURST_MS    = 500           # gap between them
WATER_THRESH = 0.5          # confidence above which a cell counts as water


# ---------------------------------------------------------------------------
# Setup
# ---------------------------------------------------------------------------

def init_camera():
    sensor.reset()
    sensor.set_pixformat(sensor.RGB565)
    sensor.set_framesize(sensor.QVGA)          # 320x240
    sensor.set_vflip(False)                    # VERIFY against real mounting
    sensor.set_hmirror(False)
    sensor.skip_frames(time=800)               # let exposure settle
    sensor.set_auto_gain(False)                # VERIFY: locking gain/whitebalance
    sensor.set_auto_whitebal(False)            #   is ESSENTIAL - see note below
    return True

# WHY GAIN AND WHITE-BALANCE MUST BE LOCKED
# -----------------------------------------
# With auto white-balance on, the camera "corrects" the colour of muddy water
# back toward grey - it actively erases the exact signal we are trying to
# measure. Auto-gain does the same to brightness. Lock both, so that a colour
# change between two frames means the RIVER changed, not the camera.


def init_uart():
    fm.register(10, fm.fpioa.UART1_TX, force=True)   # VERIFY pins on your board
    fm.register(11, fm.fpioa.UART1_RX, force=True)
    return UART(UART.UART1, 115200, timeout=1000, read_buf_len=256)


# ---------------------------------------------------------------------------
# Inference
# ---------------------------------------------------------------------------

def run_model(task):
    """Capture one frame and return (32x32 water confidences 0..1, the frame)."""
    img = sensor.snapshot()
    small = img.resize(IN_SIZE, IN_SIZE)
    small.pix_to_ai()
    fmap = kpu.forward(task, small)
    return fmap[:], img          # fmap[:] is a flat list of OUT_SIZE*OUT_SIZE floats


def cell(grid, col, row):
    return grid[row * OUT_SIZE + col]


# ---------------------------------------------------------------------------
# Turning the water map into physical numbers
# ---------------------------------------------------------------------------

def water_coverage(grid):
    """Fraction of the river channel currently covered by water (0..1)."""
    c0, r0, c1, r1 = ROI
    wet = total = 0
    for r in range(r0, r1):
        for c in range(c0, c1):
            total += 1
            if cell(grid, c, r) > WATER_THRESH:
                wet += 1
    return wet / float(total or 1)


def water_line_row(grid):
    """
    Find the top edge of the water, to better precision than the 32x32 grid.

    For each column we walk DOWN from the top of the channel until confidence
    crosses 0.5. Because the model outputs a smooth confidence rather than a
    hard yes/no, we can interpolate between the cell above and the cell below
    to locate the edge to roughly a quarter of a cell.

    We then take the MEDIAN across columns, not the mean: a single log or a
    glint of sun can throw one column badly, and the median ignores it.
    """
    c0, r0, c1, r1 = ROI
    rows = []
    for c in range(c0, c1):
        prev = cell(grid, c, r0)
        for r in range(r0 + 1, r1):
            cur = cell(grid, c, r)
            if prev <= WATER_THRESH < cur:              # dry above, wet below
                span = cur - prev
                frac = (WATER_THRESH - prev) / span if span > 1e-6 else 0.5
                rows.append((r - 1) + frac)
                break
            prev = cur
    if not rows:
        return None
    rows.sort()
    return rows[len(rows) // 2]


def row_to_metres(row):
    """Convert a grid row into a real water level using the two calibration marks."""
    if row is None:
        return None
    dr = CAL_ROW_B - CAL_ROW_A
    if dr == 0:
        return None
    t = (row - CAL_ROW_A) / float(dr)
    return CAL_HEIGHT_A + t * (CAL_HEIGHT_B - CAL_HEIGHT_A)


def turbidity(img, grid):
    """
    How muddy the water looks, normalised against a fixed reference patch.

    Raw colour is useless on its own: muddy water at noon and clear water at
    dusk read almost identically. Dividing the water's colour by the colour of
    something whose true colour cannot change cancels the sunlight out.

    Returns 0..255, where higher means browner/more sediment-laden.
    """
    sx = img.width() // OUT_SIZE
    sy = img.height() // OUT_SIZE

    def patch_rgb(c0, r0, c1, r1, water_only):
        rs = gs = bs = n = 0
        for r in range(r0, r1):
            for c in range(c0, c1):
                if water_only and cell(grid, c, r) <= WATER_THRESH:
                    continue
                px = img.get_pixel(c * sx + sx // 2, r * sy + sy // 2)
                rs += px[0]; gs += px[1]; bs += px[2]; n += 1
        if n == 0:
            return None
        return (rs / n, gs / n, bs / n)

    w = patch_rgb(ROI[0], ROI[1], ROI[2], ROI[3], True)
    ref = patch_rgb(REF_PATCH[0], REF_PATCH[1], REF_PATCH[2], REF_PATCH[3], False)
    if w is None or ref is None:
        return None

    # illumination-cancelled colour
    nr = w[0] / max(ref[0], 1.0)
    nb = w[2] / max(ref[2], 1.0)
    # sediment shifts water toward red/brown and away from blue
    ratio = nr / max(nb, 0.05)
    return max(0, min(255, int((ratio - 0.6) * 160)))


def turbulence(grids):
    """
    Surface agitation: how much each water cell flickered across the burst.

    A calm pool barely changes between frames. Fast, broken, white water
    changes a lot. This is why we take a burst - it is not computable from a
    single frame.
    """
    if len(grids) < 2:
        return None
    c0, r0, c1, r1 = ROI
    total = 0.0
    n = 0
    for r in range(r0, r1):
        for c in range(c0, c1):
            vals = [cell(g, c, r) for g in grids]
            m = sum(vals) / len(vals)
            if m <= WATER_THRESH:
                continue
            var = sum((v - m) ** 2 for v in vals) / len(vals)
            total += var
            n += 1
    if n == 0:
        return 0
    return max(0, min(255, int((total / n) * 2000)))


def debris_count(grid):
    """
    Count non-water patches that are SURROUNDED by water.

    Floating debris is, by definition, something that is not water sitting in
    the middle of water. Since we already have the water map this is free, and
    it needs no debris training data at all.

    Rocks near the bank are excluded because they touch the edge of the water
    region rather than being enclosed by it.
    """
    c0, r0, c1, r1 = ROI
    found = 0
    for r in range(r0 + 1, r1 - 1):
        for c in range(c0 + 1, c1 - 1):
            if cell(grid, c, r) > WATER_THRESH:
                continue
            neigh = (cell(grid, c - 1, r), cell(grid, c + 1, r),
                     cell(grid, c, r - 1), cell(grid, c, r + 1))
            if sum(1 for v in neigh if v > WATER_THRESH) >= 3:
                found += 1
    return min(15, found)


def lens_ok(img):
    """
    Is the lens clear?

    A muddy, fogged, iced or spider-webbed lens makes every reading above
    meaningless - and does so silently, which is the dangerous part. Sharp
    images have strong local contrast; an obstructed one is smooth mush.

    Turning a silent failure into a reported one is more valuable than trying
    to prevent it.
    """
    stat = img.get_statistics()
    return stat.stdev() > 8          # VERIFY threshold against real site images


# ---------------------------------------------------------------------------
# Packet: what we hand to the ESP32
# ---------------------------------------------------------------------------

def build_packet(level_cm, coverage, turb, turbu, debris, ok, night):
    """
    18 bytes, fixed layout. Compact because LoRa airtime costs power.

      0     node id
      1-2   water level, cm above datum
      3     coverage percent
      4     turbidity 0-255
      5     turbulence 0-255
      6     debris count (low nibble) + flags (high nibble)
      7     status flags
      8-16  reserved for ESP32 to fill in (rates of change, battery, time)
      17    checksum
    """
    p = bytearray(18)
    p[0] = NODE_ID & 0xFF
    lv = 0xFFFF if level_cm is None else max(0, min(65534, int(level_cm)))
    p[1] = (lv >> 8) & 0xFF
    p[2] = lv & 0xFF
    p[3] = int(coverage * 100) & 0xFF
    p[4] = 0xFF if turb is None else turb & 0xFF        # 0xFF = not measurable
    p[5] = 0xFF if turbu is None else turbu & 0xFF
    p[6] = debris & 0x0F
    p[7] = (0x01 if ok else 0) | (0x02 if night else 0)
    c = 0
    for b in p[:17]:
        c ^= b
    p[17] = c
    return p


# ---------------------------------------------------------------------------
# Main cycle
# ---------------------------------------------------------------------------

def main():
    init_camera()
    uart = init_uart()

    task = kpu.load(MODEL_ADDR)
    try:
        grids = []
        last_img = None
        for i in range(BURST_N):
            g, img = run_model(task)
            grids.append(g)
            last_img = img
            if i < BURST_N - 1:
                time.sleep_ms(BURST_MS)

        # Use the median frame for still measurements so one glitched frame
        # (a bird, a splash, an exposure hiccup) cannot dominate the reading.
        mid = grids[len(grids) // 2]

        ok = lens_ok(last_img)
        night = last_img.get_statistics().mean() < 40    # VERIFY threshold

        cov = water_coverage(mid)
        row = water_line_row(mid)
        lvl_m = row_to_metres(row)
        lvl_cm = None if lvl_m is None else lvl_m * 100.0

        # Turbidity comes from colour, and IR night frames have none.
        turb = turbidity(last_img, mid) if (ok and not night) else None
        turbu = turbulence(grids)
        deb = debris_count(mid)

        pkt = build_packet(lvl_cm, cov, turb, turbu, deb, ok, night)
        uart.write(pkt)

        print("level={} cm  coverage={:.0f}%  turbidity={}  turbulence={}  debris={}  lens_ok={}".format(
            "?" if lvl_cm is None else int(lvl_cm), cov * 100, turb, turbu, deb, ok))

    finally:
        # Always free the model, even on error - the K210 has little RAM and a
        # leak here bricks the next wake cycle.
        kpu.deinit(task)
        gc.collect()


if __name__ == "__main__":
    main()
