import struct
import time
from typing import Dict, Any, Tuple

def calculate_crc8(data: bytes, poly: int = 0x07, init_val: int = 0x00) -> int:
    """
    Standard CRC-8 (SMBus / ATM-8 polynomial: x^8 + x^2 + x + 1 = 0x07)
    Calculated across payload bytes.
    """
    crc = init_val
    for byte in data:
        crc ^= byte
        for _ in range(8):
            if crc & 0x80:
                crc = ((crc << 1) ^ poly) & 0xFF
            else:
                crc = (crc << 1) & 0xFF
    return crc


class LoRaPacketCodec:
    """
    Encodes and decodes 14-byte packed binary telemetry structs transmitted
    across the SX1262/SX1278 LoRa mesh network.
    
    Binary Layout (14 Bytes):
    - [0]    uint8_t   node_id (1-255)
    - [1-4]  uint32_t  timestamp (Epoch seconds)
    - [5]    uint8_t   msg_type (0x01=Routine, 0x02=Anomaly/Surge, 0x03=Low-Bat, 0x04=Heartbeat)
    - [6-7]  uint16_t  primary_reading (0-1000 scale: e.g. Turbidity*10 or Tilt*10 or Gas)
    - [8-9]  int16_t   rate_of_change (Delta per min * 10)
    - [10-11] uint16_t battery_mv (e.g. 3300 = 3.30V)
    - [12]   uint8_t   health_flags (Bit 0: Lens Obstr, Bit 1: Solar OK, Bit 2: Radar Valid, Bit 3: Relay)
    - [13]   uint8_t   crc8_checksum (CRC-8 over bytes 0-12)
    """

    FORMAT_PAYLOAD = "<BIBhhHB"  # First 13 bytes
    FULL_FORMAT = "<BIBhhHBB"    # All 14 bytes

    @classmethod
    def encode(
        cls,
        node_id: int,
        timestamp: int,
        msg_type: int,
        primary_reading: int,
        rate_of_change: int,
        battery_mv: int,
        health_flags: int = 0x06
    ) -> Tuple[bytes, str, int]:
        """
        Packs metrics into 14-byte binary payload, calculates CRC-8, and returns (bytes, hex_string, crc8).
        """
        # Clamp ranges
        node_id = max(1, min(255, int(node_id)))
        timestamp = int(timestamp) & 0xFFFFFFFF
        msg_type = int(msg_type) & 0xFF
        primary_reading = max(0, min(65535, int(primary_reading)))
        rate_of_change = max(-32768, min(32767, int(rate_of_change)))
        battery_mv = max(0, min(65535, int(battery_mv)))
        health_flags = int(health_flags) & 0xFF

        # Pack first 13 bytes
        payload_13 = struct.pack(
            cls.FORMAT_PAYLOAD,
            node_id,
            timestamp,
            msg_type,
            primary_reading,
            rate_of_change,
            battery_mv,
            health_flags
        )

        crc8 = calculate_crc8(payload_13)
        full_bytes = payload_13 + bytes([crc8])
        hex_str = full_bytes.hex().upper()

        return full_bytes, hex_str, crc8

    @classmethod
    def decode(cls, raw_data: bytes) -> Dict[str, Any]:
        """
        Unpacks 14-byte binary packet and verifies CRC8 checksum.
        """
        if len(raw_data) != 14:
            raise ValueError(f"Expected exactly 14 bytes, received {len(raw_data)}")

        payload_13 = raw_data[:13]
        received_crc = raw_data[13]
        expected_crc = calculate_crc8(payload_13)
        is_valid = (received_crc == expected_crc)

        node_id, timestamp, msg_type, primary_reading, rate_of_change, battery_mv, health_flags = struct.unpack(
            cls.FORMAT_PAYLOAD, payload_13
        )

        msg_type_names = {
            1: "ROUTINE_TELEMETRY",
            2: "ANOMALY_SURGE",
            3: "LOW_BATTERY_WARN",
            4: "HEARTBEAT_STATUS"
        }

        flags_dict = {
            "camera_obstructed": bool(health_flags & 0x01),
            "solar_charging": bool(health_flags & 0x02),
            "radar_valid": bool(health_flags & 0x04),
            "mesh_relay_active": bool(health_flags & 0x08)
        }

        return {
            "node_id": node_id,
            "timestamp": timestamp,
            "msg_type": msg_type,
            "msg_type_name": msg_type_names.get(msg_type, "UNKNOWN"),
            "primary_reading": primary_reading,
            "rate_of_change": rate_of_change,
            "battery_mv": battery_mv,
            "health_flags": health_flags,
            "flags_breakdown": flags_dict,
            "crc8": received_crc,
            "crc8_expected": expected_crc,
            "is_valid": is_valid,
            "raw_hex": raw_data.hex().upper(),
            "byte_length": 14
        }
