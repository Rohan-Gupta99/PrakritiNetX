#!/usr/bin/env python3
"""
End-to-End REST Flow Verification for FieldFlash
Tests manifest retrieval, binary download, and location geotag upload.
"""

import urllib.request
import json
import time
import subprocess
import os
import sys

BASE_URL = "http://127.0.0.1:8080"
SERVER_SCRIPT = os.path.join(os.path.dirname(__file__), "mock_server.py")

def run_tests():
    print("[1/4] Starting FieldFlash Mock Backend Server...")
    proc = subprocess.Popen([sys.executable, SERVER_SCRIPT], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    time.sleep(1.5)

    try:
        # Test 1: GET /firmware/manifest
        print("[2/4] Testing GET /firmware/manifest...")
        req = urllib.request.Request(f"{BASE_URL}/firmware/manifest")
        with urllib.request.urlopen(req) as resp:
            assert resp.status == 200, f"Expected 200 OK, got {resp.status}"
            data = json.loads(resp.read().decode("utf-8"))
            assert data["network"] == "PrakritiNetX"
            packages = data["packages"]
            print(f"  Manifest fetched successfully with {len(packages)} packages:")
            for p in packages:
                print(f"    - {p['display_name']} [{p['chip_type'].upper()}] - {len(p['files'])} file(s)")

        # Test 2: GET /firmware/download/bootloader.bin
        print("[3/4] Testing GET /firmware/download/bootloader.bin...")
        dl_req = urllib.request.Request(f"{BASE_URL}/firmware/download/bootloader.bin")
        with urllib.request.urlopen(dl_req) as dl_resp:
            assert dl_resp.status == 200
            file_data = dl_resp.read()
            assert len(file_data) > 0
            print(f"  Firmware binary downloaded: {len(file_data)} bytes [Magic: {hex(file_data[0])}]")

        # Test 3: POST /nodes/ESP32_30AEA4070D64/location
        print("[4/4] Testing POST /nodes/ESP32_30AEA4070D64/location...")
        node_id = "ESP32_30AEA4070D64"
        payload = {
            "node_id": node_id,
            "latitude": 30.316496,
            "longitude": 78.032188,
            "altitude": 1420.5,
            "accuracy": 3.8,
            "timestamp": int(time.time() * 1000),
            "firmware_version": "v1.4.0",
            "chip_type": "esp32",
            "written_to_board": True,
            "technician_notes": "Alaknanda River Catchment - Bridge Pillar Node #3"
        }
        post_data = json.dumps(payload).encode("utf-8")
        post_req = urllib.request.Request(
            f"{BASE_URL}/nodes/{node_id}/location",
            data=post_data,
            headers={"Content-Type": "application/json"}
        )
        with urllib.request.urlopen(post_req) as post_resp:
            assert post_resp.status == 200
            result = json.loads(post_resp.read().decode("utf-8"))
            print(f"  Geotag upload response: {result}")
            assert result["status"] == "SUCCESS"
            assert result["id"] == node_id

        print("\n>>> ALL REST FLOW VERIFICATION CHECKS PASSED SUCCESSFULLY! <<<")

    finally:
        print("Terminating mock server...")
        proc.terminate()
        proc.wait()

if __name__ == "__main__":
    run_tests()
