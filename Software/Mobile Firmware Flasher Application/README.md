# FieldFlash: Native Android Firmware Flasher & Geotagging Provisioner

**FieldFlash** is an enterprise-grade native Android (Kotlin) engineering application developed for field technicians deploying **PrakritiNetX** remote IoT environmental sensor nodes across mountain slopes, river gauge stations, and forest ridges with zero reliable internet access.

FieldFlash provides robust, reliable firmware flashing over USB-OTG, hardware boot and diagnostic verification, offline firmware caching, and post-installation GNSS geotagging with guaranteed-delivery offline queuing.

---

## 1. Operational Hardware Context & Supported Silicon

In accordance with the **PrakritiNetX Technical Specifications**:
- **ESP32-S3 ("Lite" Tier)**: Used for hydrology and flood monitoring (rain gauge, optical turbidity, water level) and seismic/landslide precursor sensing (ADXL355 low-noise accelerometer, dual-axis tilt, capacitive soil moisture).
- **Kendryte K210 ("Vision" Tier)**: Dual-core 64-bit RISC-V SoC with a hardware KPU running quantized MobileNet CNNs for smoke/fire detection and scene feature extraction.
- **Combined Architecture (e.g. Sipeed Maixduino)**: K210 for KPU edge vision paired with ESP32 for 433 MHz LoRa mesh transmission and power management.
- **Supported USB Bridges**: Silicon Labs CP2102/CP2104, WCH CH340/CH341, FTDI FT232R/FT2232, and native ESP32 USB CDC/JTAG.

---

## 2. Architecture & Engine Design

```
FieldFlash Architecture
├── UI Layer (MVVM + Jetpack Navigation)
│   ├── Step 1: Repository (Production Manifest / Offline Cache / SAF Storage)
│   ├── Step 2: USB Host Bridge & Hardware Probing (CP2102, CH340, FTDI, CDC-ACM)
│   ├── Step 3: Native Flashing Engine (Live progress, adaptive baud, terminal log)
│   ├── Step 4: Diagnostics & Safety (Run mode reset, telemetry query, version check)
│   ├── Step 5: GNSS Geotag & Registration (Multi-constellation lock, NVS writeback)
│   └── Gateway Settings & Queue (Pending sync list, base-station URL configuration)
│
├── Flashing Engines
│   ├── ESP32 Native Serial Engine (Espressif ROM protocol, SLIP framing, MD5 verify)
│   └── K210 ISP Flashing Engine (Kendryte ISP protocol, .kfpkg zip unpacker, standalone .bin)
│
├── Serial Layer (usb-serial-for-android)
│   ├── UsbSerialManager (USB Host API, DTR/RTS hardware auto-reset)
│   └── SlipFraming (RFC 1055 encoder/decoder)
│
├── Data & Offline Synchronization
│   ├── Room Database (QueuedLocationEntity & CachedFirmwareEntity)
│   ├── WorkManager (LocationSyncWorker with NetworkType.CONNECTED constraint)
│   └── Retrofit / OkHttp REST Client (Decoupled generic endpoints)
```

### Native Kotlin Serial Protocol (Zero Binary Sub-Processes)
On Android 10+ (`targetSdkVersion >= 29`):
1. **SELinux `W^X` Compliance**: The Android OS strictly blocks executing sub-process ELF binaries from app-private storage (`/data/data/...`), throwing `java.io.IOException: error=13, Permission denied`.
2. **Direct USB Host Management**: Non-root Android applications cannot access `/dev/ttyUSB*` directly. All hardware communications must flow through Android's `UsbManager` and `UsbDeviceConnection`.
3. **FieldFlash Implementation**: Directly communicates with the Android USB Host API via `usb-serial-for-android`. Implements the Espressif Bootloader Protocol natively in Kotlin (DTR/RTS auto-reset, SLIP framing, ROM sync `0x08`, adaptive baud rate negotiation up to 921,600 bps, flash sector writes `0x03`, and hardware ROM MD5 verification `0x13`).

---

## 3. Flashing Engines

### ESP32-S3 Flashing Engine
Flashes three files at their required fixed memory offsets:
1. `bootloader.bin` at `0x0000` (or `0x1000` for ESP32 legacy)
2. `partition-table.bin` at `0x8000`
3. Application firmware `.bin` at `0x10000`

- **Hardware Auto-Reset**: Controlled via DTR/RTS lines:
  - RTS = HIGH (active-low EN asserted -> reset held)
  - DTR = HIGH (active-low IO0 asserted -> bootloader mode selected)
  - RTS released -> chip boots into ROM bootloader
- **Integrity Validation**: Issues `ESP_SPI_FLASH_MD5` to compute and match MD5 digests against the original binary before reporting block completion.

### Kendryte K210 ISP Flashing Engine
Completely isolated module (`org.prakritinetx.fieldflash.engine.k210`):
- **Package Modes**:
  1. Full `.kfpkg` bundle: Unzips archive, reads `flash-list.json`, extracts binaries (bootloader, runtime, `.kmodel` neural network weights), and writes each entry to its specified address.
  2. Standalone `.bin` application update: Flashes application binary directly to specified offset (e.g. `0x000000` or custom) without overwriting bootloader or neural network models.
- **Protocol**: Kendryte ISP greeting (`0xC1`), reads 64-bit factory unique device ID, switches UART baud rate up to 1,500,000 bps, initializes flash (`0xC4`), and writes 4KB chunks (`0xC5`) with ISP ACK handshakes.

---

## 4. Post-Flash Diagnostics & Verification Protocol

Because PrakritiNetX nodes are deployed in remote, physically inaccessible mountain terrain, **devices must never be left in an uncertain or bricked state**.

1. **Hardware Reboot**: Releases DTR/RTS and resets MCU into normal runtime application mode.
2. **Diagnostics Query**: Switches baud to standard runtime speed (115,200 bps) and transmits verification queries (`CMD:GET_VERSION\r\n`, `SYS:DIAGNOSTICS\r\n`).
3. **Live Telemetry Parsing**: Extracts runtime battery voltage ($V_{bat}$), state of charge (%), solar array input voltage, internal temperature, LoRa radio frequency, and sensor bus status.
4. **Safety Enforced**: The app **only** displays a success state and enables the geotagging step if verification explicitly passes. If the board fails to boot or returns a version mismatch, an unambiguous failure banner is shown.

---

## 5. Location Geotagging & Offline-First Sync

- **Separation of Concerns**: Geotagging is explicitly decoupled from flashing. Technicians often flash nodes in a base camp workshop; geotagging is triggered **only** once the node is physically mounted at its riverbank or mountain site.
- **Multi-Constellation GNSS**: Captured via Google Play Services `FusedLocationProviderClient` with `PRIORITY_HIGH_ACCURACY` (recording Latitude, Longitude, Altitude, Accuracy in meters, Satellites used, Constellation type, and HDOP).
- **Node ID Association**: Automatically tagged with the unique hardware ID read during the flash/handshake step (ESP32 MAC or K210 64-bit Chip ID).
- **On-Board NVS Redundancy**: Writes captured coordinates back to the board over USB-serial (`CONFIG:LOC:<lat>,<lon>,<alt>,<acc>,<time>\r\n`) so the node can store its own position in flash/EEPROM.
- **Offline Queuing**: When offline at the deployment site, records are stored in a local Room database (`QueuedLocationEntity`).
- **Guaranteed Auto-Sync**: Background `LocationSyncWorker` is enqueued with `NetworkType.CONNECTED` constraint via `WorkManager`. As soon as the technician returns to cellular/Wi-Fi coverage, pending records automatically sync to the backend cloud.

---

## 6. Decoupled REST API Specification

The app communicates with a backend REST service. The base URL is configurable in the app's Settings screen (`http://<server-ip>:8080/` or AWS API Gateway endpoint).

### 1. Firmware Manifest
- **Endpoint**: `GET /firmware/manifest`
- **Response**:
```json
{
  "network": "PrakritiNetX",
  "manifest_version": "2.4.0",
  "release_channel": "production-stable",
  "packages": [
    {
      "id": "prakriti-water-esp32-v2.4.0",
      "node_type": "water-esp32",
      "display_name": "Hydrology & Flood Early Warning Node (ESP32-S3)",
      "version": "v2.4.0",
      "chip_type": "esp32",
      "description": "Camera turbidity analysis, optical water level, and tipping-bucket rain gauge telemetry.",
      "files": [
        { "name": "bootloader.bin", "offset": "0x0000", "download_url": "firmware/download/bootloader.bin" },
        { "name": "partition-table.bin", "offset": "0x8000", "download_url": "firmware/download/partition-table.bin" },
        { "name": "prakriti_water_v2.4.0.bin", "offset": "0x10000", "download_url": "firmware/download/prakriti_water_v1.4.0.bin" }
      ]
    }
  ]
}
```

### 2. File Download
- **Endpoint**: `GET /firmware/download/{filename}`
- **Response**: Binary octet-stream of the requested firmware payload.

### 3. Geotag Registration
- **Endpoint**: `POST /nodes/{node_id}/location`
- **Payload**:
```json
{
  "node_id": "30:AE:A4:07:0D:64",
  "latitude": 30.316496,
  "longitude": 78.032188,
  "altitude": 1420.5,
  "accuracy": 2.4,
  "satellites_used": 14,
  "gnss_constellation": "GPS+NavIC+GLONASS",
  "hdop": 0.85,
  "timestamp": 1789035600000,
  "firmware_version": "v2.4.0",
  "chip_type": "esp32",
  "catchment_basin": "Alaknanda Upper Catchment",
  "mounting_height_meters": 24.5,
  "written_to_board": true,
  "battery_voltage_mv": 12450,
  "technician_notes": "Alaknanda River Catchment - Bridge Pillar Node #3"
}
```
- **Response**:
```json
{
  "status": "SUCCESS",
  "message": "Deployment location confirmed and registered for node 30:AE:A4:07:0D:64",
  "id": "30:AE:A4:07:0D:64"
}
```

---

## 7. Testing & Verification

### 1. Interactive UI Simulator
Test the complete mobile flow directly on any PC browser:
```bash
# Open in your browser:
preview_ui.html
```

### 2. Local Base-Station REST Gateway Server
A standalone Python REST gateway is included in `mock_backend/`:
```bash
cd mock_backend

# Run automated integration test
python test_backend_flow.py

# Start the interactive local gateway server
python mock_server.py
```

### 3. Building FieldFlash for Android
```bash
# Build Debug APK
./gradlew assembleDebug
```
Output APK: `app/build/outputs/apk/debug/app-debug.apk`
