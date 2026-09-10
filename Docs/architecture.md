# PrakritiNetX — System Architecture

## Overview

PrakritiNetX is a distributed environmental early warning network that shifts disaster management from reactive detection to predictive intelligence. The system comprises three main layers:

1. **Field Deployment Layer** — Ruggedized, solar-powered edge computing nodes
2. **Central Intelligence Hub** — Kinematic prediction engine with adaptive baselines
3. **Alert Dissemination Layer** — NDMA/CWC compliant multi-channel alerting

---

## System-Level Architecture

```
┌──────────────────────────────────────────────────────────────────────────┐
│                     FIELD DEPLOYMENT LAYER                              │
│                                                                        │
│   ┌─────────────┐   ┌─────────────┐   ┌─────────────┐                │
│   │ Lite Node #1│   │ Vision Node │   │ Lite Node #3│                │
│   │ (ESP32-S3)  │   │ (K210+ESP32)│   │ (ESP32-S3)  │                │
│   │ Hydrology & │   │ Fire & River│   │ Landslide   │                │
│   │ Landslide   │   │ Dynamics    │   │ Monitoring  │                │
│   └──────┬──────┘   └──────┬──────┘   └──────┬──────┘                │
│          │                 │                  │                        │
│          └────────── 433 MHz LoRa Mesh ───────┘                       │
│                            │                                          │
└────────────────────────────┼──────────────────────────────────────────┘
                             │
                    ┌────────▼────────┐
                    │ LoRa Gateway /  │
                    │ Ridge Repeater  │
                    └────────┬────────┘
                             │
              ┌──────────────▼──────────────┐
              │   CENTRAL INTELLIGENCE HUB  │
              │                             │
              │  • 30-day μ,σ per station   │
              │  • Kinematic wave Δt calc   │
              │  • Z-score anomaly engine   │
              │  • Cross-node correlation   │
              └──────────────┬──────────────┘
                             │
              ┌──────────────▼──────────────┐
              │     ALERT DISSEMINATION     │
              │                             │
              │  • NDMA SACHET Integration  │
              │  • CAP XML Alerts           │
              │  • SMS to DDMA / Public     │
              │  • Dashboard / Web UI       │
              └─────────────────────────────┘
```

---

## Dual-Tier Edge Node Architecture

### Lite Tier (Hydrology & Landslide Monitoring)

```
┌─────────────────────────────────────────────┐
│            ESP32-S3 (Lite Node)             │
│         Dual Xtensa LX7 @ 240 MHz          │
├─────────────────────────────────────────────┤
│                                             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐ │
│  │Rain Gauge│  │ ADXL355  │  │ SCA100T  │ │
│  │Davis 7852│  │ Seismic  │  │Dual Tilt │ │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘ │
│       │              │              │       │
│       └──────────────┼──────────────┘       │
│                      │                      │
│              ┌───────▼───────┐              │
│              │  TinyML Edge  │              │
│              │  Processing   │              │
│              └───────┬───────┘              │
│                      │                      │
│              ┌───────▼───────┐              │
│              │  LoRa Radio   │              │
│              │  SX1276 433MHz│              │
│              └───────────────┘              │
│                                             │
│  Power: 12V LiFePO4 + MPPT Solar           │
│  Autonomy: 14+ overcast days               │
│  Sleep Current: ~15 µA (deep sleep)        │
└─────────────────────────────────────────────┘
```

### Vision Tier (Forest Fire & River Dynamics)

```
┌─────────────────────────────────────────────────────────────────┐
│                    Vision Node (Dual-SoC)                       │
├──────────────────────────┬──────────────────────────────────────┤
│   DOMAIN A (Always On)   │   DOMAIN B (Power-Gated)            │
│                          │                                      │
│   ┌──────────────────┐   │   ┌──────────────────┐              │
│   │     ESP32        │   │   │   Kendryte K210   │              │
│   │  Comms + Sleep   │   │   │  RISC-V @ 400MHz │              │
│   └────────┬─────────┘   │   │  0.5 TOPS KPU    │              │
│            │              │   └────────┬─────────┘              │
│   ┌────────▼─────────┐   │   ┌────────▼─────────┐              │
│   │  LoRa SX1276     │   │   │  OV5647 5MP      │              │
│   │  433 MHz Radio   │   │   │  + M12 Telephoto │              │
│   └──────────────────┘   │   └──────────────────┘              │
│                          │                                      │
│   Current: 112-130 mA   │   P-MOSFET Load Switch               │
│   (Continuous mesh       │   ON: 3-5 sec every 10-15 min       │
│    relay routing)        │   OFF: Absolute 0.0 mA              │
├──────────────────────────┴──────────────────────────────────────┤
│  Power: 12V LiFePO4 + MPPT Solar | Autonomy: 10+ overcast days│
└─────────────────────────────────────────────────────────────────┘
```

---

## Communication: 433 MHz LoRa Mesh

```
Radio Band:       433 MHz ISM (License-Free, India)
Topology:         Peer-to-Peer Multi-Hop Mesh
Packet Size:      14 Bytes (Compact Binary)
Modulation:       LoRa (SX1276 / RFM95)

┌───────────┬──────────────┬──────────┬─────────────────┬────────────────┬────────────┬────────────────┬──────────┐
│ Node ID   │ Timestamp    │ Msg Type │ Primary Reading │ Rate of Change │ Battery mV │ Secondary Flag │ Checksum │
│ (1 Byte)  │ (4 Bytes)    │ (1 Byte) │ (2 Bytes)       │ (2 Bytes)      │ (2 Bytes)  │ (1 Byte)       │ (1 Byte) │
└───────────┴──────────────┴──────────┴─────────────────┴────────────────┴────────────┴────────────────┴──────────┘
```

---

## WaterNet ML Pipeline

```
Training Pipeline:
  Keras Model (90K params) → TFLite → nncase v0.2 → .kmodel v4

On-Device Inference:
  Camera Frame (128x128 RGB) → K210 KPU → Water Mask (32x32) → Feature Extraction

Features Extracted:
  • Water level (pixel coverage)
  • Turbidity (color channel analysis)
  • Surface turbulence (texture variance)
  • Debris detection (mask anomalies)
```

---

## FieldFlash Provisioning Pipeline

```
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

---

## Predictive Intelligence Flow

```
1. Upstream Node Detects Precursor
   └─→ Rate-of-change (dτ/dt) exceeds Z ≥ 3.0σ from 30-day baseline

2. Alert Packet Transmitted via LoRa Mesh
   └─→ Priority escalation over routine telemetry

3. Central Hub Receives & Correlates
   └─→ Cross-node kinematic wave analysis
   └─→ Downstream arrival time: Δt = Distance / River Velocity

4. Deterministic Escalation
   └─→ NDMA SACHET notification
   └─→ CAP XML alert to DDMA
   └─→ SMS to downstream populations

5. Lead Time Delivered
   └─→ Hours of advance warning before flood wave arrival
```

---

## Technology Summary

| Component | Technology |
|---|---|
| Lite Node Compute | ESP32-S3, ULP Co-Processor |
| Vision Node Compute | Kendryte K210 KPU + ESP32 |
| Sensors | Davis 7852, ADXL355, SCA100T, OV5647, YG1006 |
| Radio | 433 MHz LoRa (SX1276/RFM95) |
| ML Framework | TensorFlow/Keras → TFLite → nncase → .kmodel |
| Mobile App | Android Native (Kotlin), USB-OTG |
| Backend | AWS (API Gateway + Lambda + DynamoDB + S3) |
| Power | 12V LiFePO4 + MPPT Solar (IP65) |
| Compliance | NDMA CAP, SACHET, CWC Standards |
