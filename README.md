# PrakritiNetX

> **An Autonomous, AI-Accelerated Environmental Early Warning & Hydro-Meteorological Intelligence Network for Flash Floods, Forest Fires, and Landslide Precursors in Mountain River Basins.**

[![Platform](https://img.shields.io/badge/Mobile%20Provisioner-Android%20Native%20(Kotlin)-2e7d32.svg)](Software/Mobile%20Firmware%20Flasher%20Application/)
[![Hardware Architecture](https://img.shields.io/badge/Hardware-ESP32--S3%20%7C%20Kendryte%20K210%20KPU-e65100.svg)](Hardware/)
[![LoRa Radio Mesh](https://img.shields.io/badge/Telemetry-433%20MHz%20Sub--GHz%20LoRa-0288d1.svg)](#3-communication--sub-ghz-lora-mesh-network)
[![Disaster Compliance](https://img.shields.io/badge/Interoperability-NDMA%20CAP%20%2F%20SACHET-6a1b9a.svg)](#4-central-intelligence-hub--kinematic-prediction-engine)
[![License](https://img.shields.io/badge/License-MIT-455a64.svg)](LICENSE)

---

## 1. Executive Summary & Foundational Physics

Traditional environmental monitoring relies on single-point **detectors** — threshold-based sensors that sound an alarm only after a river crosses a fixed water level or smoke reaches a localized probe. In steep Himalayan watersheds and river torrents, fixed thresholds fail physically:
* A water level routine on a wide lowland river represents a devastating flash flood on a narrow mountain gorge.
* Any hardcoded threshold logic produces perpetual false alarms during seasonal snowmelt or misses sudden cloudburst pulses entirely.
* By the time an in-stream probe detects a 3-meter surge, the flood wave is already destroying infrastructure downstream.

**PrakritiNetX shifts disaster management from reactive detection to predictive intelligence:**
1. **Multi-Station Kinematic Forecasting**: Distributed edge nodes capture leading physical precursors (rate of suspended sediment turbidity change $\frac{d\tau}{dt}$, river surface texture agitation, rainfall accumulation, and micro-seismic slope creep) rather than late-stage water depth.
2. **Per-Site Learned Normal ($30\text{-Day } \mu, \sigma$)**: Each node's baseline adapts to seasonal monsoon transitions. Anomalies are quantified via standard-deviation departures ($Z \ge 3.0\sigma$) relative to that specific site's own historical normal.
3. **Cross-Node Kinematic Wave Correlation**: When an upstream station flags an anomaly, the central predictive engine computes downstream arrival times ($\Delta t = \frac{d}{v}$) based on precise field GNSS coordinates, delivering actionable hours of lead time to civil defense authorities.
4. **Transparent, Auditable Escalation**: All alerting decisions follow deterministic, explainable rules matching Central Water Commission (CWC) operational standards, avoiding black-box failures during life-safety events.

```
                    UPSTREAM SENSING STATION                               DOWNSTREAM COMMUNITY
                 [Precursor Detected at t = 0]                           [Predicted Arrival at t + Δt]
                   +------------------------+                             +------------------------+
                   | Node #1: Alaknanda #4  |                             | Node #2: Devprayag #1  |
                   | (Precise GNSS Geotag)  |                             | (Precise GNSS Geotag)  |
                   +-----------+------------+                             +-----------+------------+
                               |                                                      ^
                      Rate-of-Change (dτ/dt)                                          |
                               |                                                      |
                               v                                                      |
                   +------------------------+    Kinematic Propagation Model          |
                   | Central Predictive Hub |=========================================+
                   | (Rolling 30-day μ, σ)  |       Δt = Distance / River Velocity
                   +-----------+------------+
                               |
                   [Deterministic Rule Escalation]
                               v
                   +------------------------+
                   | NDMA SACHET / SMS / CAP| ---> District Disaster Authorities (DDMA)
                   +------------------------+      & Downstream Riverine Populations
```

---

## 2. Hardware Architecture & Dual-Tier Edge Nodes

PrakritiNetX utilizes a modular, ruggedized compute architecture engineered for unassisted multi-year field survival under extreme weather and power constraints:

| System Specification | Lite Tier (Hydrology & Landslide) | Vision Tier (Forest Fire & River Dynamics) |
|---|---|---|
| **Primary Compute** | **ESP32-S3** (Dual Xtensa LX7 @ 240MHz) | **Kendryte K210** (Dual 64-bit RISC-V @ 400MHz) |
| **Co-Processor** | Ultra-Low-Power (ULP) Core | **ESP32** (MSM261S4030H0 module for Comms/Sleep) |
| **AI Acceleration** | Espressif Vector Instructions (TinyML) | **0.5 TOPS KPU** (Dedicated CNN Hardware Accelerator) |
| **Sensor Subsystem** | Rain gauge (Davis 7852 / YL-83), ADXL355 low-noise seismic accelerometer, dual-axis tilt (SCA100T), soil moisture v1.2 | OV5647 5MP sensor with telephoto M12 lens + YG1006 low-power IR flame wake trigger |
| **Edge Workload** | Micro-tremor filtering, slope deformation, surface runoff aggregation | Real-time MobileNet CNN binary smoke/fire classification & optical water texture variance |
| **Radio Link** | 433 MHz Sub-GHz LoRa (SX1276 / RFM95) | 433 MHz Sub-GHz LoRa (SX1276 / RFM95) via ESP32 |
| **Power Management** | Deep sleep with timer wake (~15 µA) | **Dual Power Domains**: ESP32 radio continuously active; K210 fully power-gated (0.0 mA) between bursts |
| **Energy Storage** | 12V LiFePO4 Pack (15-20 Ah) + MPPT Solar Controller (10-20W Monocrystalline Panel, IP65) | 12V LiFePO4 Pack (15-20 Ah) + MPPT Solar Controller (10-20W Monocrystalline Panel, IP65) |
| **Autonomy Rating** | **14+ Consecutive Overcast Days** | **10+ Consecutive Overcast Days** (Continuous Mesh Relay) |

### Industrial Power-Gating Innovation
To guarantee uninterrupted multi-hop mesh routing without exhausting off-grid batteries:
* **Domain A (ESP32 + LoRa Radio)**: Remains continuously active (112-130 mA) to listen, route, and forward packets across the regional mesh network.
* **Domain B (K210 SoC + Camera Rail)**: Controlled by an industrial P-channel MOSFET load switch driven by the ESP32. It powers ON strictly for 3-5 seconds every 10-15 minutes to run camera capture and KPU inference, then drops to **absolute 0.0 mA draw**, guaranteeing system autonomy even during 10 days of zero sunlight.

---

## 3. Communication: Sub-GHz LoRa Mesh Network

* **Radio Band**: **433 MHz License-Free ISM Band (India)**. 433 MHz provides superior wave diffraction around ridgelines, forest foliage, and deep mountain gorges compared to 868/915 MHz or 2.4 GHz protocols.
* **Multi-Hop Topology**: Peer-to-peer mesh networking eliminates single-point gateway failures. In steep river valleys where line-of-sight to the base camp is obstructed, solar-powered ridge repeaters relay packets seamlessly.
* **Deterministic 14-Byte Compact Binary Packet**:
  ```
  ┌───────────┬──────────────┬──────────┬─────────────────┬────────────────┬────────────┬────────────────┬──────────┐
  │ Node ID   │ Timestamp    │ Msg Type │ Primary Reading │ Rate of Change │ Battery mV │ Secondary Flag │ Checksum │
  │ (1 Byte)  │ (4 Bytes)    │ (1 Byte) │ (2 Bytes)       │ (2 Bytes)      │ (2 Bytes)  │ (1 Byte)       │ (1 Byte) │
  └───────────┴──────────────┴──────────┴─────────────────┴────────────────┴────────────┴────────────────┴──────────┘
  ```
  Prioritizes airtime efficiency and power conservation while guaranteeing instant prioritization of emergency event packets over routine telemetry updates.

---

## 4. Software Suite: FieldFlash Mobile Provisioner

Deploying environmental nodes in remote Himalayan regions involves harsh conditions: zero cellular connectivity, steep cliffs, and the absolute requirement that no deployed hardware is left bricked or misconfigured.

**FieldFlash** is a native Android (Kotlin) engineering application designed for field technicians to provision, flash, cryptographically verify, and register PrakritiNetX sensor nodes directly over USB-OTG:

```
FieldFlash Provisioning Workflow
┌─────────────────────────┐     ┌─────────────────────────┐     ┌─────────────────────────┐
│   1. REPOSITORY CACHE   │ --> │   2. USB HOST BRIDGE    │ --> │    3. FLASH ENGINES     │
│ Cloud Manifest / SAF    │     │ CP2102, CH340, CDC-ACM  │     │ ESP32 ROM & K210 ISP    │
│ Cryptographic Signatures│     │ Hardware Auto-Reset     │     │ Adaptive Baud Fallback  │
└─────────────────────────┘     └─────────────────────────┘     └────────────┬────────────┘
                                                                             │
┌─────────────────────────┐     ┌─────────────────────────┐                  │
│   5. GEOTAG & REGISTER  │ <-- │   4. BOOT DIAGNOSTICS   │ <────────────────┘
│ Multi-Constellation GNSS│     │ Serial Telemetry Query  │ (Strict Pass / Fail
│ Local Room DB Auto-Sync │     │ Version & CRC Matching  │  Zero Bricked Devices)
└─────────────────────────┘     └─────────────────────────┘
```

### Key Engineering Capabilities
* **Native Protocol Engines (Zero Binary Sub-Processes)**:
  * Reimplemented Espressif ROM Bootloader Protocol and Kendryte ISP Protocol natively in Kotlin over `usb-serial-for-android`.
  * Fully compliant with Android 14 security policies, avoiding SELinux `W^X` binary execution blocks.
  * Handles DTR/RTS auto-reset strobing, RFC 1055 SLIP framing, hardware ROM sync (`0x08`), and 3-partition flash flashing (`0x0000`/`0x1000`, `0x8000`, `0x10000`) with hardware MD5 digest confirmation (`0x13`).
  * Dedicated Kendryte K210 engine unpacks official `.kfpkg` release archives, maps `flash-list.json`, and flashes neural network models (`.kmodel`) directly to dedicated flash sectors.
* **Post-Flash Boot Diagnostics & Verification**:
  * Resets node into runtime execution mode and reads initial serial streams at 115200 bps.
  * Queries version and telemetry registers (`CMD:GET_VERSION`, `SYS:DIAGNOSTICS`).
  * Only unlocks the physical installation step once version confirmation succeeds, displaying unambiguous failure diagnostics if a boot loop occurs.
* **Multi-Constellation GNSS Geotagging**:
  * Integrates `FusedLocationProviderClient` with multi-constellation GNSS (NavIC L5 + GPS L1/L5 + GLONASS) tracking satellites in view, elevation ASL, and HDOP precision.
  * Associates captured coordinates with the node's unique hardware MAC / Chip ID.
  * **On-Board NVS Redundancy**: Writes coordinates back to the board's internal flash/EEPROM over USB (`CONFIG:LOC:...`) for autonomous off-grid location reporting.
* **Offline-First Room Database & WorkManager Sync**:
  * Persists records locally in Room SQLite DB (`QueuedLocationEntity`).
  * Automatically syncs queued records to the cloud backend via background `WorkManager` with exponential backoff and network-connectivity constraints.
* **Decoupled REST Backend Architecture**:
  * Compatible with AWS Cloud Infrastructure (API Gateway + Lambda + DynamoDB + S3) or local edge Raspberry Pi base stations via standard HTTPS/REST contracts (`GET /firmware/manifest`, `POST /nodes/{id}/location`).

---

## 5. Operations & Quick-Start Guide

### Interactive UI Simulator (PC Browser - No Phone Required)
Technicians and reviewers can test the complete FieldFlash mobile user experience, live flashing progress, streaming diagnostics terminal, and GNSS geotagging workflow directly on any PC browser:

```bash
# Launch in Chrome, Edge, or Firefox:
Software/Mobile Firmware Flasher Application/preview_ui.html
```

### Local Base-Station REST Gateway Server
To run the local base-station server for offline firmware distribution and deployment registration:

```bash
cd "Software/Mobile Firmware Flasher Application/mock_backend"

# Run end-to-end integration test:
python test_backend_flow.py

# Start live local gateway server on port 8080:
python mock_server.py
```

### Compiling FieldFlash for Android
```bash
cd "Software/Mobile Firmware Flasher Application"

# Build debug APK:
./gradlew assembleDebug
```
Output Binary: `app/build/outputs/apk/debug/app-debug.apk`

---

## 6. Project Architecture & Directory Layout

```
PrakritiNetX/
├── Docs/
│   └── Environmental Intelligence Network — Complete Technical Reference.pdf
├── Hardware/                          # Schematics, BOM, and PCB layout archives
├── LICENSE                            # MIT Open Source License
├── README.md                          # Master System Documentation
└── Software/
    └── Mobile Firmware Flasher Application/   # FieldFlash Native Android Application
        ├── app/
        │   ├── build.gradle.kts
        │   ├── src/main/
        │   │   ├── AndroidManifest.xml
        │   │   ├── java/org/prakritinetx/fieldflash/
        │   │   │   ├── core/         # State wrappers, constants, result models
        │   │   │   ├── data/         # Room SQLite DB, Retrofit REST client, WorkManager
        │   │   │   ├── engine/       # Native ESP32 ROM & K210 ISP flashing engines
        │   │   │   ├── location/     # GNSS location provider & board NVS writer
        │   │   │   └── ui/           # MVVM ViewModel, Wizard Fragments, Terminal Views
        │   │   └── res/              # High-contrast rugged field themes, drawables, layouts
        │   └── src/test/             # Protocol unit tests (SLIP, Kfpkg parser, Checksums)
        ├── mock_backend/             # Standalone base-station gateway & integration tests
        ├── preview_ui.html           # Full-feature PC browser UI simulator
        ├── build.gradle.kts
        └── README.md                 # Detailed FieldFlash technical documentation
```

---

## 7. Compliance & License

PrakritiNetX is developed as an open disaster risk reduction platform under the **MIT License**.  
Architected in alignment with guidelines from the **National Disaster Management Authority (NDMA)** and the **Central Water Commission (CWC)**, Government of India.
