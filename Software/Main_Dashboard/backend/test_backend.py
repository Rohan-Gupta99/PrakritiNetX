import unittest
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from database import init_db, SessionLocal, NodeModel, AlertModel, PacketModel
from packet_codec import LoRaPacketCodec, calculate_crc8
from physics_engine import physics_engine
from simulator import simulator
from fastapi.testclient import TestClient
from main import app

class TestBackendHub(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        # Stop background simulator loop during static unit test runs
        simulator.is_running = False
        init_db()
        cls.client = TestClient(app, raise_server_exceptions=True)

    def test_database_nodes_seeded(self):
        db = SessionLocal()
        try:
            nodes = db.query(NodeModel).all()
            self.assertEqual(len(nodes), 6) # 5 valley nodes + 1 Laptop Hub
            node_codes = [n.node_code for n in nodes]
            self.assertIn("N1", node_codes)
            self.assertIn("N2", node_codes)
            self.assertIn("N3", node_codes)
            self.assertIn("N4", node_codes)
            self.assertIn("N5", node_codes)
            self.assertIn("HUB", node_codes)
        finally:
            db.close()

    def test_lora_packet_codec(self):
        node_id = 1
        timestamp = 1726000000
        msg_type = 2
        primary_reading = 880
        rate_of_change = 125
        battery_mv = 3312
        health_flags = 0x06

        packet_bytes, hex_str, crc8 = LoRaPacketCodec.encode(
            node_id, timestamp, msg_type, primary_reading, rate_of_change, battery_mv, health_flags
        )

        self.assertEqual(len(packet_bytes), 14)
        self.assertEqual(len(hex_str), 28)

        decoded = LoRaPacketCodec.decode(packet_bytes)
        self.assertTrue(decoded["is_valid"])
        self.assertEqual(decoded["node_id"], 1)
        self.assertEqual(decoded["timestamp"], 1726000000)
        self.assertEqual(decoded["primary_reading"], 880)

    def test_physics_engine_calculations(self):
        z = physics_engine.calculate_zscore(88.0, 18.5, 3.2)
        self.assertAlmostEqual(z, (88.0 - 18.5) / 3.2, places=1)

        travel = physics_engine.calculate_travel_time("N1", "N2", 3.5)
        self.assertEqual(travel["distance_km"], 4.8)

    def test_fastapi_endpoints(self):
        with TestClient(app) as client:
            res = client.get("/api/health")
            self.assertEqual(res.status_code, 200)
            self.assertEqual(res.json()["status"], "ONLINE")

            res = client.get("/api/nodes")
            self.assertEqual(res.status_code, 200)
            self.assertEqual(len(res.json()), 6)

            res = client.get("/api/system/health")
            self.assertEqual(res.status_code, 200)

            res = client.post("/api/simulate/event", json={"event_type": "flood", "speed_multiplier": 5.0})
            self.assertEqual(res.status_code, 200)

if __name__ == "__main__":
    unittest.main(exit=False)
