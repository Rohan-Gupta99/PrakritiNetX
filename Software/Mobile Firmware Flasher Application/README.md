# FieldFlash: Native Android Firmware Flasher & Geotagging Provisioner

**FieldFlash** is a production-grade native Android (Kotlin) application designed for field technicians deploying **PrakritiNetX** remote IoT environmental sensor nodes across mountain slopes, river gauge stations, and forest ridges with zero reliable internet access.

FieldFlash provides robust, reliable firmware flashing over USB-OTG, hardware boot and version verification, offline firmware caching, and post-installation GPS geotagging with guaranteed-delivery offline queuing.

---

## 1. Hardware Context & Supported Silicon

In accordance with the **PrakritiNetX Technical Reference**:
- **ESP32-S3 ("Lite" Tier)**: Used for water/flood monitoring (rain gauge, turbidity, water level) and seismic/landslide precursor sensing (ADXL355 low-noise accelerometer, tilt sensors, capacitive soil moisture).
- **Kendryte K210 ("Vision" Tier)**: Dual-core 64-bit RISC-V SoC with a hardware KPU running quantized MobileNet CNNs for smoke/fire detection and scene feature extraction.
- **Combined Boards (e.g. Sipeed Maixduino)**: K210 for KPU vision paired with ESP32 for LoRa mesh transmission and power management.
- **USB-to-Serial Bridges**: Silicon Labs CP2102/CP2104, WCH CH340/CH341, FTDI FT232R/FT2232, and native ESP32 USB CDC/JTAG.

---

## 2. Architecture & Engine Design

```
FieldFlash Architecture
├── UI Layer (MVVM + Jetpack Navigation)
│   ├── Step 1: Firmware Selection (Online manifest / Offline Cache / SAF Local Storage)
│   ├── Step 2: USB Connection & Chip Handshake (CP2102, CH340, FTDI, CDC-ACM)
│   ├── Step 3: Native Flashing Engine (Live progress, speed, offsets, terminal log)
│   ├── Step 4: Verification & Safety (Run mode reset, serial query, version check)
│   ├── Step 5: Geotagging & Deployment (FusedLocationProvider, on-board writeback)
│   └── Settings & Offline Queue (Pending sync list, backend URL configuration)
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

### Why Native Kotlin Serial Protocol Instead of Bundled `esptool` Executable?
On Android 10+ (`targetSdkVersion >= 29`):
1. **SELinux `W^X` Violation**: The Android OS strictly blocks executing sub-process ELF binaries from app-private storage (`/data/data/...`), throwing `java.io.IOException: error=13, Permission denied`.
2. **USB Permissions**: Android does not expose raw `/dev/ttyUSB*` character devices to non-root applications. All USB access must flow through Android's `UsbManager` and `UsbDeviceConnection`.
3. **FieldFlash Solution**: Implements the Espressif Bootloader Protocol natively in Kotlin over `usb-serial-for-android`. It communicates directly with the USB Host API, performs SLIP framing, sends ROM sync commands (`0x08`), negotiates baud rates up to 921600 bps, writes flash blocks (`0x03`) with XOR checksums, and queries hardware MD5 verification (`0x13`).

---

## 3. Flashing Engines

### ESP32-S3 Flashing Engine
Flashes three files at their required fixed memory offsets:
1. `bootloader.bin` at `0x1000` (or `0x0000` for ESP32-S3)
2. `partition-table.bin` at `0x8000`
3. Application firmware `.bin` at `0x10000`

- **Auto-Reset Sequence**: Driven via DTR/RTS control lines:
  - RTS = HIGH (active-low EN asserted -> reset held)
  - DTR = HIGH (active-low IO0 asserted -> bootloader mode selected)
  - RTS released -> chip boots into ROM bootloader
- **Integrity Check**: Issues `ESP_SPI_FLASH_MD5` to compute and match MD5 digest against the original binary before reporting block completion.

### Kendryte K210 ISP Flashing Engine
Completely isolated module (`org.prakritinetx.fieldflash.engine.k210`):
- **Package Modes**:
  1. Full `.kfpkg` bundle: Unzips archive, reads `flash-list.json`, extracts binaries (bootloader, runtime, `.kmodel` neural network weights), and writes each entry to its specified address.
  2. Standalone `.bin` application update: Flashes application binary directly to specified offset (e.g. `0x000000` or custom) without overwriting bootloader or neural network models.
- **Protocol**: Kendryte ISP greeting (`0xC1`), reads 64-bit factory unique device ID, switches UART baud rate up to 1,500,000 bps, initializes flash (`0xC4`), and writes 4KB chunks (`0xC5`) with ISP ACK handshakes.

---

## 4. Post-Flash Verification & Safety Protocol

Because PrakritiNetX nodes are deployed in remote, physically inaccessible mountain terrain, **devices must never be left in an uncertain or bricked state**.

1. **Hardware Reboot**: Releases DTR/RTS and resets MCU into normal runtime application mode.
2. **Serial Query**: Switches baud to standard runtime speed (115200 bps) and transmits verification queries (`CMD:GET_VERSION\r\n`, `AT+VERSION?\r\n`).
3. **Response Matching**: Extracts the reported version string from the serial stream and verifies it against the target firmware package version.
4. **Safety Enforced**: The app **only** displays a success state and enables the geotagging step if verification explicitly passes. If the board fails to boot or returns a version mismatch, an unambiguous red failure banner is shown.

---

## 5. Location Geotagging & Offline-First Sync

- **Separation of Concerns**: Geotagging is explicitly decoupled from flashing. Technicians often flash nodes in a base camp workshop; geotagging is triggered **only** once the node is physically mounted at its riverbank or mountain site.
- **GPS Coordinates**: Captured via Google Play Services `FusedLocationProviderClient` with `PRIORITY_HIGH_ACCURACY` (recording Latitude, Longitude, Altitude, Accuracy in meters, and Timestamp).
- **Node ID Association**: Automatically tagged with the unique hardware ID read during the flash/handshake step (ESP32 MAC or K210 64-bit Chip ID).
- **Optional On-Board Writeback**: Toggle-able switch allows sending captured coordinates back to the board over USB-serial (`CONFIG:LOC:<lat>,<lon>,<alt>,<acc>,<time>\r\n`) so the node can store its own position in flash/EEPROM.
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
  "manifest_version": "1.0.0",
  "packages": [
    {
      "id": "prakriti-water-esp32-v1.4.0",
      "node_type": "water-esp32",
      "display_name": "Water & Flood Monitoring Node (ESP32-S3)",
      "version": "v1.4.0",
      "chip_type": "esp32",
      "description": "Camera turbidity analysis, water level, and rain gauge telemetry node.",
      "files": [
        { "name": "bootloader.bin", "offset": "0x1000", "download_url": "firmware/download/bootloader.bin" },
        { "name": "partition-table.bin", "offset": "0x8000", "download_url": "firmware/download/partition-table.bin" },
        { "name": "prakriti_water_v1.4.0.bin", "offset": "0x10000", "download_url": "firmware/download/prakriti_water_v1.4.0.bin" }
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
  "accuracy": 3.8,
  "timestamp": 1789035600000,
  "firmware_version": "v1.4.0",
  "chip_type": "esp32",
  "written_to_board": true,
  "technician_notes": "Alaknanda River Catchment - Bridge Pillar #3"
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

## 7. Testing with the Mock Backend Server

A ready-to-run Python REST server is included in `mock_backend/`.

```bash
cd mock_backend

# 1. Run automated end-to-end REST test
python test_backend_flow.py

# 2. Start the interactive mock server
python mock_server.py
```

- When running, open FieldFlash Settings and set Backend URL to:
  `http://<YOUR_COMPUTER_LOCAL_IP>:8080/`
- FieldFlash will download and cache the manifest and sample packages, flash the nodes, verify them, and post geotags to the server.

---

## 8. Building FieldFlash

### Prerequisites
- Android Studio Hedgehog (2023.1.1) or newer
- JDK 17
- Android SDK 34 (Android 14)

### Build Instructions
```bash
# Clone the repository
git clone https://github.com/Rohan-Gupta99/PrakritiNetX.git

# Open the project directory in Android Studio:
# Software/Mobile Firmware Flasher Application

# Build Debug APK
./gradlew assembleDebug
```
The resulting APK will be located at:
`app/build/outputs/apk/debug/app-debug.apk`

