# PrakritiNetX

> **An AI-powered, resilient environmental intelligence and early warning network designed for rugged terrain, flash floods, forest fires, and landslide precursor detection.**

[![Android Native](https://img.shields.io/badge/Platform-Android%20Native%20(Kotlin)-green.svg)](Software/Mobile%20Firmware%20Flasher%20Application/)
[![Hardware](https://img.shields.io/badge/Hardware-ESP32--S3%20%7C%20Kendryte%20K210-orange.svg)](Hardware/)
[![Radio](https://img.shields.io/badge/Mesh-433%20MHz%20LoRa-blue.svg)](#3-communication--lora-mesh-network)
[![License](https://img.shields.io/badge/License-MIT-purple.svg)](LICENSE)

---

## 1. System Philosophy: Detector vs. Predictor

Traditional disaster management relies on **detectors** — sensors that trigger an alarm only after a critical threshold is crossed (e.g., when a river rises above 3 meters). By that time, the flood surge is already arriving downstream, giving communities minutes or seconds of warning.

**PrakritiNetX is a predictor network.** It identifies the physical precursor patterns that precede a disaster before catastrophic damage occurs:
1. **Multiple distributed sensing points** positioned along river reaches and mountain ridges.
2. **Learned, per-site time-varying baselines**: Why fixed thresholds fail physically — a flow volume routine on a wide monsoon-fed lowland river would represent a catastrophic flash flood on a steep mountain stream. PrakritiNetX computes rolling historical baselines ($30\text{-day } \mu, \sigma$) and flags z-score departures ($\ge 3\sigma$) relative to each site's own historical normal.
3. **Rate-of-Change Signal**: Rapid change ($\frac{df}{dt}$) is a far more reliable leading indicator of upstream dam breaches or cloudburst surges than absolute values.
4. **Cross-Node Kinematics**: Computes real inter-node propagation times ($\Delta t = \frac{d}{v}$) using precise deployment GPS geotags captured by field technicians, predicting downstream arrival hours in advance.
5. **Auditable Rule-Based Escalation**: Life-safety alerting logic is transparent and verifiable rather than an opaque black-box model.

```
                   UPSTREAM REACH                           DOWNSTREAM REACH
             [Precursor Detection: t=0]              [Calculated Arrival: t + Δt]
                  +---------------+                       +---------------+
                  | Node #1 (GPS) |                       | Node #2 (GPS) |
                  +-------+-------+                       +-------+-------+
                          |                                       ^
                 Turbidity Spike (df/dt)                          |
                          |                                       |
                          v                                       |
                   +--------------+    Kinematic Travel-Time      |
                   |  Central Hub |===============================+
                   +--------------+      Δt = Distance / Velocity
                          |
             [Rule-Based Warning Dispatch]
                          v
                   +--------------+
                   |  SMS / CAP   | -> Downstream Communities & Authorities
                   +--------------+
```

---

## 2. Hardware Architecture & Sensing Tiers

PrakritiNetX employs a modular mainboard + daughterboard architecture matching compute to task requirements without wasting power or budget:

| Feature / Subsystem | Lite Tier (Hydrology / Seismic) | Vision Tier (Forest Fire / Flood Scene) |
|---|---|---|
| **Primary SoC** | **ESP32-S3** (Dual Xtensa LX7, 240MHz) | **Kendryte K210** (Dual RISC-V 64-bit, 400MHz) |
| **Co-Processor** | None (Single SoC) | **ESP32** (MSM261S4030H0 module for LoRa / Sleep) |
| **Neural Accelerator** | Built-in AI vector instructions (TinyML) | **0.5 TOPS KPU** (Dedicated CNN silicon) |
| **Sensors** | Rain collector (Davis 7852 / YL-83), ADXL355 low-noise accelerometer, dual-axis tilt (SCA100T), soil moisture v1.2 | Camera (OV5647 with telephoto M12 lens) + YG1006 IR flame wake trigger |
| **Vision Workload** | N/A (Camera-free on seismic nodes) | Real-time MobileNet CNN inference for active flame/smoke plume detection |
| **Communication** | 433 MHz LoRa (SX1276 / RFM95) | 433 MHz LoRa (SX1276 / RFM95) via ESP32 |
| **Power Architecture** | Ultra-low power deep sleep (~15µA) | Dual domain: ESP32 listening continuously; K210 fully power-gated (0mA) between bursts |
| **Battery & Solar** | 12V LiFePO4 pack (15-20 Ah) + MPPT solar charge controller (10-20W panel) + 12V-to-5V buck converter | 12V LiFePO4 pack (15-20 Ah) + MPPT solar charge controller (10-20W panel) + 12V-to-5V buck converter |

### Why Power-Gating the K210 is Critical
Kendryte K210 documentation does not guarantee trusted microamp sleep modes. To prevent battery depletion, the ESP32 controls a dedicated P-channel MOSFET load switch to completely cut power to the K210 and camera rail between sensing cycles:
- **Domain A (ESP32 + LoRa)**: Remains active to participate in continuous multi-hop LoRa mesh relaying.
- **Domain B (K210 + Camera)**: Powered ON only for a 3-5 second active capture & inference burst every 10-15 minutes, drawing 0.0mA while asleep.

---

## 3. Communication & LoRa Mesh Network

- **Frequency**: **433 MHz** (sub-GHz license-free band in India). Selected over 868/915 MHz because longer wavelengths offer significantly superior penetration through mountain ridges, dense valley vegetation, and river mist.
- **Topology**: Multi-hop peer-to-peer mesh with intermediate solar-powered relay nodes tolerating lost line-of-sight in deep river gorges.
- **Compact 14-Byte Binary Packet**:
  ```
  [node_id: 1B] [timestamp: 4B] [msg_type: 1B] [primary_reading: 2B]
  [rate_of_change: 2B] [battery_mv: 2B] [secondary_flag: 1B] [checksum: 1B]
  ```
  Distinguishes between routine status updates and priority hazard alerts without wasting radio airtime on verbose text formats.

---

## 4. Software: FieldFlash Mobile Provisioning Application

Deploying IoT hardware in remote Himalayan locations presents unique challenges: there is no cellular coverage at the physical installation site, and bricked nodes cannot be easily recovered.

**FieldFlash** is a native Android (Kotlin) application built specifically for field technicians to flash, verify, and register PrakritiNetX nodes on-site:

```
FieldFlash Provisioning Flow
┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│  1. SELECT FW    │ --> │  2. CONNECT USB  │ --> │  3. FLASH ENGINE │
│  Cloud / Cache   │     │  CP2102 / CH340  │     │  ESP32 / K210    │
└──────────────────┘     └──────────────────┘     └────────┬─────────┘
                                                           │
┌──────────────────┐     ┌──────────────────┐              │
│  5. GEOTAG NODE  │ <-- │  4. VERIFY BOOT  │ <────────────┘
│  Room DB / Sync  │     │  Query Runtime   │ (Unambiguous PASS/FAIL)
└──────────────────┘     └──────────────────┘
```

### Core FieldFlash Capabilities
1. **Native USB Flashing (No Sub-Process Binaries)**:
   - Implements native Espressif ROM serial protocol & Kendryte ISP protocol directly over Android USB Host API (`usb-serial-for-android`).
   - Completely avoids Android 10+ (`API 29+`) SELinux `W^X` permission errors.
   - Flashes ESP32 multi-binaries at fixed offsets (`0x1000`/`0x0` bootloader, `0x8000` partition table, `0x10000` application) with hardware MD5 verification.
   - Flashes K210 full `.kfpkg` packages (unzips archive and maps `flash-list.json`) or standalone `.bin` app updates.
2. **Flash Verification & Safety**:
   - Reboots the MCU into application run mode, queries runtime version over serial (`CMD:GET_VERSION`), and confirms a match before reporting success.
3. **Explicit Location Geotagging**:
   - Distinct step triggered only when the node is bolted into its final mounting position.
   - Uses `FusedLocationProviderClient` to record high-precision GPS coordinates, altitude, and accuracy.
   - **Optional On-Board Writeback**: Toggle switch allows writing coordinates to node EEPROM/NVS over USB-serial (`CONFIG:LOC:...`).
4. **Offline-First Room Database & WorkManager Auto-Sync**:
   - Geotag records are stored in a local SQLite Room DB (`QueuedLocationEntity`).
   - When offline at the deployment site, `LocationSyncWorker` is queued via `WorkManager` with `NetworkType.CONNECTED` constraints to automatically sync with the cloud backend once connectivity returns.
5. **Decoupled REST API**:
   - Communicates with generic endpoints (`GET /firmware/manifest`, `POST /nodes/{id}/location`).
   - Configurable Base URL compatible with AWS API Gateway / Lambda / S3 or on-premise Raspberry Pi edge hubs.

---

## 5. Quick Start & Testing

### 1. Test the FieldFlash UI on PC (No Phone Required)
An interactive HTML5 simulator is included directly in the repo. You can open and test all 5 wizard steps, animated flashing progress, and streaming terminal logs:

```bash
# Open in your browser:
Software/Mobile Firmware Flasher Application/preview_ui.html
```

### 2. Run the Mock Backend REST Server
A Python 3 REST server is provided to test the full cloud manifest and geotag registration workflow:

```bash
cd "Software/Mobile Firmware Flasher Application/mock_backend"

# Run automated integration test:
python test_backend_flow.py

# Start live interactive mock server on port 8080:
python mock_server.py
```

### 3. Build the Android Native APK
```bash
cd "Software/Mobile Firmware Flasher Application"

# Build debug APK with Gradle:
./gradlew assembleDebug
```
Output APK location: `app/build/outputs/apk/debug/app-debug.apk`

---

## 6. Repository Layout

```
PrakritiNetX/
├── Docs/
│   └── Environmental Intelligence Network — Complete Technical Reference.pdf
├── Hardware/                          # Schematics, pinouts, and PCB layouts
└── Software/
    └── Mobile Firmware Flasher Application/   # FieldFlash Native Android App
        ├── app/
        │   ├── build.gradle.kts
        │   ├── src/main/
        │   │   ├── AndroidManifest.xml
        │   │   ├── java/org/prakritinetx/fieldflash/
        │   │   │   ├── core/         # Constants, Resource state wrappers
        │   │   │   ├── data/         # Room DB, Retrofit API, Repositories, WorkManager
        │   │   │   ├── engine/       # ESP32 & K210 native flashing protocol engines
        │   │   │   ├── location/     # FusedLocationProvider & board NVS writer
        │   │   │   └── ui/           # MVVM ViewModel, Wizard Fragments, Adapters
        │   │   └── res/              # Layouts, drawables, rugged field dark theme
        │   └── src/test/             # Unit tests (SLIP framing, .kfpkg parser, offsets)
        ├── mock_backend/             # Python mock REST server & sample firmware
        ├── preview_ui.html           # Interactive PC browser UI simulator
        ├── build.gradle.kts
        └── README.md                 # Detailed FieldFlash technical documentation
```

---

## 7. License & Credits

Developed under the **PrakritiNetX Open Environmental Intelligence Initiative**.  
Licensed under the [MIT License](LICENSE).
