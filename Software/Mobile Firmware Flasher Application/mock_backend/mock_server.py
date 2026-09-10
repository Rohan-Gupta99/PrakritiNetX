#!/usr/bin/env python3
"""
FieldFlash Mock REST API Server
PrakritiNetX Sensor Network - Firmware & Geotagging Backend

Endpoints:
  GET  /firmware/manifest          - Returns available firmware packages
  GET  /firmware/download/<file>   - Streams firmware binary payload
  POST /nodes/<node_id>/location   - Registers node GPS deployment location
  GET  /nodes/deployments          - Lists all recorded node deployments
"""

import os
import json
import zipfile
from http.server import HTTPServer, BaseHTTPRequestHandler
import urllib.parse

PORT = 8080
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
FIRMWARE_DIR = os.path.join(BASE_DIR, "sample_firmware")
DEPLOYMENTS_FILE = os.path.join(BASE_DIR, "deployments_db.json")

os.makedirs(FIRMWARE_DIR, exist_ok=True)

# Generate sample files if they do not exist
def generate_sample_assets():
    bootloader_path = os.path.join(FIRMWARE_DIR, "bootloader.bin")
    if not os.path.exists(bootloader_path):
        with open(bootloader_path, "wb") as f:
            f.write(b"\xE9" + b"\x00" * 4095) # 4KB dummy bootloader with ESP magic

    part_path = os.path.join(FIRMWARE_DIR, "partition-table.bin")
    if not os.path.exists(part_path):
        with open(part_path, "wb") as f:
            f.write(b"\xAA\x50" + b"\x00" * 3070) # 3KB dummy partition table

    water_bin_path = os.path.join(FIRMWARE_DIR, "prakriti_water_v1.4.0.bin")
    if not os.path.exists(water_bin_path):
        with open(water_bin_path, "wb") as f:
            f.write(b"PrakritiNetX v1.4.0 (ESP32-S3 Water Sensor)\n" + b"\x00" * 8192)

    seismic_bin_path = os.path.join(FIRMWARE_DIR, "prakriti_seismic_v1.1.0.bin")
    if not os.path.exists(seismic_bin_path):
        with open(seismic_bin_path, "wb") as f:
            f.write(b"PrakritiNetX v1.1.0 (ESP32-S3 Seismic Sensor)\n" + b"\x00" * 8192)

    # Generate sample .kfpkg zip archive
    kfpkg_path = os.path.join(FIRMWARE_DIR, "fire_k210_bundle_v2.1.0.kfpkg")
    if not os.path.exists(kfpkg_path):
        manifest = {
            "version": "0.1.0",
            "files": [
                {"address": 0, "bin": "k210_bootloader.bin", "sha256Prefix": False},
                {"address": 65536, "bin": "k210_app.bin", "sha256Prefix": False},
                {"address": 2097152, "bin": "mobilenet_fire.kmodel", "sha256Prefix": False}
            ]
        }
        with zipfile.ZipFile(kfpkg_path, "w") as zf:
            zf.writestr("flash-list.json", json.dumps(manifest, indent=2))
            zf.writestr("k210_bootloader.bin", b"\x00" * 2048)
            zf.writestr("k210_app.bin", b"PrakritiNetX v2.1.0 (K210 Fire Vision)\n" + b"\x00" * 4096)
            zf.writestr("mobilenet_fire.kmodel", b"KMDL" + b"\x00" * 1024)

class FieldFlashRequestHandler(BaseHTTPRequestHandler):

    def _send_json(self, status_code, data):
        response = json.dumps(data, indent=2).encode("utf-8")
        self.send_response(status_code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(response)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(response)

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path

        if path == "/firmware/manifest" or path == "/firmware/manifest/":
            manifest_file = os.path.join(BASE_DIR, "sample_manifest.json")
            if os.path.exists(manifest_file):
                with open(manifest_file, "r", encoding="utf-8") as f:
                    manifest_data = json.load(f)
                self._send_json(200, manifest_data)
            else:
                self._send_json(404, {"error": "Manifest file not found"})

        elif path.startswith("/firmware/download/"):
            filename = os.path.basename(path)
            filepath = os.path.join(FIRMWARE_DIR, filename)
            if os.path.exists(filepath):
                file_size = os.path.getsize(filepath)
                self.send_response(200)
                self.send_header("Content-Type", "application/octet-stream")
                self.send_header("Content-Length", str(file_size))
                self.send_header("Content-Disposition", f'attachment; filename="{filename}"')
                self.end_headers()
                with open(filepath, "rb") as f:
                    while chunk := f.read(65536):
                        self.wfile.write(chunk)
                print(f"[DOWNLOAD] Streamed {filename} ({file_size} bytes)")
            else:
                self._send_json(404, {"error": f"File {filename} not found"})

        elif path == "/nodes/deployments":
            if os.path.exists(DEPLOYMENTS_FILE):
                with open(DEPLOYMENTS_FILE, "r") as f:
                    deployments = json.load(f)
            else:
                deployments = []
            self._send_json(200, {"count": len(deployments), "deployments": deployments})

        else:
            self._send_json(404, {"error": "Endpoint not found", "path": path})

    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path

        if path.startswith("/nodes/") and path.endswith("/location"):
            # Format: /nodes/<id>/location
            parts = path.strip("/").split("/")
            node_id = parts[1]

            content_len = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(content_len).decode("utf-8")

            try:
                payload = json.loads(body)
            except Exception as e:
                self._send_json(400, {"error": "Malformed JSON payload", "details": str(e)})
                return

            print("\n=======================================================")
            print(f"[GEOTAG RECEIVED] Node ID: {node_id}")
            print(f"  Latitude:  {payload.get('latitude')}")
            print(f"  Longitude: {payload.get('longitude')}")
            print(f"  Altitude:  {payload.get('altitude')} m")
            print(f"  Accuracy:  ±{payload.get('accuracy')} m")
            print(f"  Firmware:  {payload.get('firmware_version')}")
            print(f"  Chip:      {payload.get('chip_type')}")
            print(f"  Written to Board: {payload.get('written_to_board')}")
            print(f"  Notes:     {payload.get('technician_notes')}")
            print("=======================================================\n")

            # Persist to local JSON database
            deployments = []
            if os.path.exists(DEPLOYMENTS_FILE):
                try:
                    with open(DEPLOYMENTS_FILE, "r") as f:
                        deployments = json.load(f)
                except Exception:
                    deployments = []

            payload["registered_node_id"] = node_id
            deployments.append(payload)

            with open(DEPLOYMENTS_FILE, "w") as f:
                json.dump(deployments, f, indent=2)

            self._send_json(200, {
                "status": "SUCCESS",
                "message": f"Deployment location confirmed and registered for node {node_id}",
                "id": node_id
            })
        else:
            self._send_json(404, {"error": "Unknown POST route", "path": path})

if __name__ == "__main__":
    generate_sample_assets()
    server = HTTPServer(("0.0.0.0", PORT), FieldFlashRequestHandler)
    print(f"[FieldFlash Mock Server] Running on http://0.0.0.0:{PORT}")
    print(f"  Manifest: http://localhost:{PORT}/firmware/manifest")
    print(f"  Sample files in: {FIRMWARE_DIR}")
    print("Press Ctrl+C to stop.")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping server.")
        server.server_close()

