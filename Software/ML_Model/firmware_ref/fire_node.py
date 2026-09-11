"""
PrakritiNetX Fire Node - MaixPy firmware for the Kendryte K210.

WHAT THIS DOES, ONCE PER WAKE CYCLE (every ~5 minutes)
-------------------------------------------------------
  1. wake, start the camera
  2. take a BURST of 3 frames to check for spreading
  3. run firenet.kmodel on each -> a 32x32 map of "is this fire/smoke?"
  4. turn those maps into physical numbers:
        fire presence, fire size (coverage), fire growth (spreading rate), lens health
  5. send one compact binary packet to the ESP32 over UART
  6. power down

FLASHING
--------
  firenet.kmodel   ->  flash offset 0x300000
  this file        ->  /sd/main.py  (or boot.py in internal flash)
"""

import sensor, image, time, gc
from machine import UART
from fpioa_manager import fm
import KPU as kpu

# ---------------------------------------------------------------------------
# Site configuration - SET THESE AT INSTALLATION, per node
# ---------------------------------------------------------------------------

NODE_ID = 2

MODEL_ADDR = 0x300000       # where firenet.kmodel sits in SPI flash
IN_SIZE    = 128            # model input  (128 x 128)
OUT_SIZE   = 32             # model output (32 x 32 grid)

# The region of interest. For a forest camera looking at the horizon,
# the top 1/4 is likely just open sky. We ignore it to reduce false positives
# from the sun. (col0, row0, col1, row1)
ROI = (0, 8, 32, 32)

BURST_N      = 3            # frames per wake cycle (fewer than water to save power)
BURST_MS     = 1000         # 1 second gap between them to see smoke drift
FIRE_THRESH  = 0.65         # high confidence required to count a cell as burning


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
    # UNLIKE the water node, we DO NOT lock white balance here.
    # Fire and smoke can happen at any time of day, and we want the camera
    # to adapt so the image isn't pitch black at dusk or blown out at noon.
    return True


def init_uart():
    fm.register(10, fm.fpioa.UART1_TX, force=True)   # VERIFY pins on your board
    fm.register(11, fm.fpioa.UART1_RX, force=True)
    return UART(UART.UART1, 115200, timeout=1000, read_buf_len=256)


# ---------------------------------------------------------------------------
# Inference
# ---------------------------------------------------------------------------

def run_model(task):
    img = sensor.snapshot()
    small = img.resize(IN_SIZE, IN_SIZE)
    small.pix_to_ai()
    fmap = kpu.forward(task, small)
    return fmap[:], img


def cell(grid, col, row):
    return grid[row * OUT_SIZE + col]


# ---------------------------------------------------------------------------
# Turning the fire map into physical numbers
# ---------------------------------------------------------------------------

def fire_size_cells(grid):
    """How many grid cells are currently burning/smoking."""
    c0, r0, c1, r1 = ROI
    burning = 0
    for r in range(r0, r1):
        for c in range(c0, c1):
            if cell(grid, c, r) > FIRE_THRESH:
                burning += 1
    return burning


def fire_growth(grids):
    """
    Are there more burning cells in the last frame than the first frame?
    This helps identify spreading fire vs a static false positive (like a bright rock).
    Returns growth in cells (can be negative if smoke is dissipating).
    """
    if len(grids) < 2:
        return 0
    start_size = fire_size_cells(grids[0])
    end_size = fire_size_cells(grids[-1])
    return end_size - start_size


def lens_ok(img):
    """Is the lens clear? (Same as water node)"""
    stat = img.get_statistics()
    return stat.stdev() > 8


# ---------------------------------------------------------------------------
# Packet: what we hand to the ESP32
# ---------------------------------------------------------------------------

def build_packet(is_fire, size_cells, growth, ok, night):
    """
    18 bytes, fixed layout for LoRa.
    
      0     node id
      1     alert flag (1 = FIRE DETECTED)
      2-3   size of fire (number of grid cells)
      4     growth (0-255, where 128 is 0 growth, >128 is growing)
      5     status flags
      6-16  reserved for ESP32
      17    checksum
    """
    p = bytearray(18)
    p[0] = NODE_ID & 0xFF
    p[1] = 1 if is_fire else 0
    
    s = max(0, min(65535, size_cells))
    p[2] = (s >> 8) & 0xFF
    p[3] = s & 0xFF
    
    g_mapped = max(0, min(255, 128 + growth)) # shift so 128 is neutral
    p[4] = g_mapped & 0xFF
    
    p[5] = (0x01 if ok else 0) | (0x02 if night else 0)
    
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

        mid_grid = grids[len(grids) // 2]
        
        ok = lens_ok(last_img)
        night = last_img.get_statistics().mean() < 30

        size = fire_size_cells(mid_grid)
        
        # We need at least 2 connected cells to consider it a real fire to prevent 1-pixel false alarms
        is_fire = size >= 2
        growth = fire_growth(grids)

        pkt = build_packet(is_fire, size, growth, ok, night)
        uart.write(pkt)

        print("FIRE ALERT={}  size={} cells  growth={}  lens_ok={}".format(
            "YES!" if is_fire else "No", size, growth, ok))

    finally:
        kpu.deinit(task)
        gc.collect()


if __name__ == "__main__":
    main()
