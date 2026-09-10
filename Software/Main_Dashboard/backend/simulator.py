import asyncio
import datetime
import time
import random
import os
import psutil
from typing import Optional, Dict, Any, Callable, List

from database import (
    SessionLocal, NodeModel, ReadingModel, AlertModel,
    PacketModel, SMSLogModel, BaselineStatsModel
)
from physics_engine import physics_engine
from packet_codec import LoRaPacketCodec

class Simulator:
    def __init__(self):
        self.is_running = True
        self.is_paused = False
        self.speed_multiplier = 1.0  # 1x, 2x, 5x, 10x
        self.tick_interval_sec = 2.0
        self.broadcast_callback: Optional[Callable[[Dict[str, Any]], Any]] = None

        # Event simulation states
        self.active_event: Optional[str] = None # None, "FLOOD", "FIRE", "AIR", "HEAT", "LANDSLIDE", "CHEMICAL", "WATER"
        self.event_start_time: float = 0.0
        self.event_phase_sec: float = 0.0

        # Node internal state variables for smooth temporal continuity across all 7 hazards
        self.node_states: Dict[str, Dict[str, Any]] = {
            "N1": {
                # 1. Flood & Water
                "turbidity": 18.5, "turbulence": 12.0, "water_coverage": 39.0, "rain_rate": 0.0, "water_level_m": 2.1,
                # 2. Fire & Smoke
                "flame_detected": False, "smoke_density_pct": 8.0,
                # 3. Air Quality
                "pm25": 22.0, "pm10": 45.0, "aqi": 42,
                # 4. Extreme Heat
                "temperature_c": 21.5, "humidity_pct": 62.0, "heat_index_c": 23.5,
                # 5. Landslide
                "accel_x": 0.0, "accel_y": 0.0, "accel_z": 1.0, "tilt_deg": 0.4, "soil_moisture": 32.0, "geophone_peak_v": 0.04,
                # 6. Chemical
                "gas_voc_ppm": 16.0, "chemical_leak_ppm": 0.0,
                # 7. Water Quality
                "water_ph": 7.4, "water_tds_ppm": 145.0, "water_do_mg_l": 8.2,
                "battery_mv": 3310, "battery_pct": 98.5
            },
            "N2": {
                "turbidity": 19.0, "turbulence": 11.5, "water_coverage": 40.0, "rain_rate": 0.0, "water_level_m": 2.2,
                "flame_detected": False, "smoke_density_pct": 8.5,
                "pm25": 24.0, "pm10": 48.0, "aqi": 46,
                "temperature_c": 22.0, "humidity_pct": 60.0, "heat_index_c": 24.0,
                "accel_x": 0.0, "accel_y": 0.0, "accel_z": 1.0, "tilt_deg": 0.3, "soil_moisture": 30.0, "geophone_peak_v": 0.03,
                "gas_voc_ppm": 17.0, "chemical_leak_ppm": 0.0,
                "water_ph": 7.3, "water_tds_ppm": 150.0, "water_do_mg_l": 8.0,
                "battery_mv": 3320, "battery_pct": 99.0
            },
            "N3": {
                "turbidity": 17.5, "turbulence": 10.0, "water_coverage": 38.0, "rain_rate": 0.0, "water_level_m": 2.0,
                "flame_detected": False, "smoke_density_pct": 9.0,
                "pm25": 28.0, "pm10": 55.0, "aqi": 52,
                "temperature_c": 23.0, "humidity_pct": 58.0, "heat_index_c": 25.0,
                "accel_x": 0.0, "accel_y": 0.0, "accel_z": 1.0, "tilt_deg": 0.2, "soil_moisture": 28.0, "geophone_peak_v": 0.05,
                "gas_voc_ppm": 18.5, "chemical_leak_ppm": 0.0,
                "water_ph": 7.5, "water_tds_ppm": 160.0, "water_do_mg_l": 7.8,
                "battery_mv": 3295, "battery_pct": 95.0
            },
            "N4": {
                "turbidity": 0.0, "turbulence": 0.0, "water_coverage": 0.0, "rain_rate": 0.0, "water_level_m": 0.0,
                "flame_detected": False, "smoke_density_pct": 7.5,
                "pm25": 18.0, "pm10": 38.0, "aqi": 35,
                "temperature_c": 19.5, "humidity_pct": 65.0, "heat_index_c": 20.5,
                "accel_x": 0.02, "accel_y": 0.01, "accel_z": 0.99, "tilt_deg": 0.45, "soil_moisture": 34.0, "geophone_peak_v": 0.04,
                "gas_voc_ppm": 14.0, "chemical_leak_ppm": 0.0,
                "water_ph": 7.0, "water_tds_ppm": 90.0, "water_do_mg_l": 9.0,
                "battery_mv": 3305, "battery_pct": 97.0
            },
            "N5": {
                "turbidity": 16.0, "turbulence": 8.5, "water_coverage": 36.0, "rain_rate": 0.0, "water_level_m": 1.9,
                "flame_detected": False, "smoke_density_pct": 10.0,
                "pm25": 32.0, "pm10": 62.0, "aqi": 60,
                "temperature_c": 24.5, "humidity_pct": 55.0, "heat_index_c": 26.5,
                "accel_x": 0.0, "accel_y": 0.0, "accel_z": 1.0, "tilt_deg": 0.1, "soil_moisture": 35.0, "geophone_peak_v": 0.02,
                "gas_voc_ppm": 19.0, "chemical_leak_ppm": 0.0,
                "water_ph": 7.6, "water_tds_ppm": 175.0, "water_do_mg_l": 7.5,
                "battery_mv": 3315, "battery_pct": 98.0
            }
        }

    def set_broadcast_callback(self, callback: Callable[[Dict[str, Any]], Any]):
        self.broadcast_callback = callback

    def trigger_flood_event(self, speed: Optional[float] = None):
        self.active_event = "FLOOD"
        self.event_start_time = time.time()
        self.event_phase_sec = 0.0
        if speed:
            self.speed_multiplier = speed
        else:
            self.speed_multiplier = max(self.speed_multiplier, 3.0)

    def trigger_fire_event(self, speed: Optional[float] = None):
        self.active_event = "FIRE"
        self.event_start_time = time.time()
        self.event_phase_sec = 0.0
        if speed:
            self.speed_multiplier = speed

    def trigger_air_hazard_event(self, speed: Optional[float] = None):
        self.active_event = "AIR"
        self.event_start_time = time.time()
        self.event_phase_sec = 0.0
        if speed:
            self.speed_multiplier = speed

    def trigger_heat_wave_event(self, speed: Optional[float] = None):
        self.active_event = "HEAT"
        self.event_start_time = time.time()
        self.event_phase_sec = 0.0
        if speed:
            self.speed_multiplier = speed

    def trigger_landslide_event(self, speed: Optional[float] = None):
        self.active_event = "LANDSLIDE"
        self.event_start_time = time.time()
        self.event_phase_sec = 0.0
        if speed:
            self.speed_multiplier = speed

    def trigger_chemical_leak_event(self, speed: Optional[float] = None):
        self.active_event = "CHEMICAL"
        self.event_start_time = time.time()
        self.event_phase_sec = 0.0
        if speed:
            self.speed_multiplier = speed

    def trigger_water_pollution_event(self, speed: Optional[float] = None):
        self.active_event = "WATER"
        self.event_start_time = time.time()
        self.event_phase_sec = 0.0
        if speed:
            self.speed_multiplier = speed

    def reset_simulation(self):
        saved_callback = self.broadcast_callback
        self.active_event = None
        self.event_start_time = 0.0
        self.event_phase_sec = 0.0
        self.speed_multiplier = 1.0
        self.is_paused = False
        physics_engine.active_surge = None

        # Reset states for all nodes
        self.node_states = {
            "N1": {
                "turbidity": 18.5, "turbulence": 12.0, "water_coverage": 39.0, "rain_rate": 0.0, "water_level_m": 2.1,
                "flame_detected": False, "smoke_density_pct": 8.0,
                "pm25": 22.0, "pm10": 45.0, "aqi": 42,
                "temperature_c": 21.5, "humidity_pct": 62.0, "heat_index_c": 23.5,
                "accel_x": 0.0, "accel_y": 0.0, "accel_z": 1.0, "tilt_deg": 0.4, "soil_moisture": 32.0, "geophone_peak_v": 0.04,
                "gas_voc_ppm": 16.0, "chemical_leak_ppm": 0.0,
                "water_ph": 7.4, "water_tds_ppm": 145.0, "water_do_mg_l": 8.2,
                "battery_mv": 3310, "battery_pct": 98.5
            },
            "N2": {
                "turbidity": 19.0, "turbulence": 11.5, "water_coverage": 40.0, "rain_rate": 0.0, "water_level_m": 2.2,
                "flame_detected": False, "smoke_density_pct": 8.5,
                "pm25": 24.0, "pm10": 48.0, "aqi": 46,
                "temperature_c": 22.0, "humidity_pct": 60.0, "heat_index_c": 24.0,
                "accel_x": 0.0, "accel_y": 0.0, "accel_z": 1.0, "tilt_deg": 0.3, "soil_moisture": 30.0, "geophone_peak_v": 0.03,
                "gas_voc_ppm": 17.0, "chemical_leak_ppm": 0.0,
                "water_ph": 7.3, "water_tds_ppm": 150.0, "water_do_mg_l": 8.0,
                "battery_mv": 3320, "battery_pct": 99.0
            },
            "N3": {
                "turbidity": 17.5, "turbulence": 10.0, "water_coverage": 38.0, "rain_rate": 0.0, "water_level_m": 2.0,
                "flame_detected": False, "smoke_density_pct": 9.0,
                "pm25": 28.0, "pm10": 55.0, "aqi": 52,
                "temperature_c": 23.0, "humidity_pct": 58.0, "heat_index_c": 25.0,
                "accel_x": 0.0, "accel_y": 0.0, "accel_z": 1.0, "tilt_deg": 0.2, "soil_moisture": 28.0, "geophone_peak_v": 0.05,
                "gas_voc_ppm": 18.5, "chemical_leak_ppm": 0.0,
                "water_ph": 7.5, "water_tds_ppm": 160.0, "water_do_mg_l": 7.8,
                "battery_mv": 3295, "battery_pct": 95.0
            },
            "N4": {
                "turbidity": 0.0, "turbulence": 0.0, "water_coverage": 0.0, "rain_rate": 0.0, "water_level_m": 0.0,
                "flame_detected": False, "smoke_density_pct": 7.5,
                "pm25": 18.0, "pm10": 38.0, "aqi": 35,
                "temperature_c": 19.5, "humidity_pct": 65.0, "heat_index_c": 20.5,
                "accel_x": 0.02, "accel_y": 0.01, "accel_z": 0.99, "tilt_deg": 0.45, "soil_moisture": 34.0, "geophone_peak_v": 0.04,
                "gas_voc_ppm": 14.0, "chemical_leak_ppm": 0.0,
                "water_ph": 7.0, "water_tds_ppm": 90.0, "water_do_mg_l": 9.0,
                "battery_mv": 3305, "battery_pct": 97.0
            },
            "N5": {
                "turbidity": 16.0, "turbulence": 8.5, "water_coverage": 36.0, "rain_rate": 0.0, "water_level_m": 1.9,
                "flame_detected": False, "smoke_density_pct": 10.0,
                "pm25": 32.0, "pm10": 62.0, "aqi": 60,
                "temperature_c": 24.5, "humidity_pct": 55.0, "heat_index_c": 26.5,
                "accel_x": 0.0, "accel_y": 0.0, "accel_z": 1.0, "tilt_deg": 0.1, "soil_moisture": 35.0, "geophone_peak_v": 0.02,
                "gas_voc_ppm": 19.0, "chemical_leak_ppm": 0.0,
                "water_ph": 7.6, "water_tds_ppm": 175.0, "water_do_mg_l": 7.5,
                "battery_mv": 3315, "battery_pct": 98.0
            }
        }
        self.broadcast_callback = saved_callback

        # Update DB statuses to ONLINE and resolve open alerts
        db = SessionLocal()
        try:
            db.query(NodeModel).update({NodeModel.status: "ONLINE"})
            db.query(AlertModel).filter(AlertModel.status != "RESOLVED").update({
                AlertModel.status: "RESOLVED",
                AlertModel.resolved_at: datetime.datetime.utcnow()
            })
            db.commit()
        finally:
            db.close()

    def pause(self):
        self.is_paused = True

    def resume(self):
        self.is_paused = False

    def set_speed(self, speed: float):
        self.speed_multiplier = max(0.5, min(20.0, speed))

    async def run_loop(self):
        while self.is_running:
            if not self.is_paused:
                try:
                    await self.step_simulation()
                except Exception as e:
                    print(f"[SIMULATOR ERROR] {e}")
            
            await asyncio.sleep(self.tick_interval_sec)

    async def step_simulation(self):
        db = SessionLocal()
        now = datetime.datetime.utcnow()
        now_epoch = time.time()

        try:
            if self.active_event is not None:
                self.event_phase_sec += (self.tick_interval_sec * self.speed_multiplier)

            # 1. Update node physics based on current active scenario
            self._update_node_physics()

            # 2. Query existing baseline stats
            baselines_dict: Dict[str, Dict[str, Dict[str, float]]] = {}
            for b in db.query(BaselineStatsModel).all():
                if b.node_code not in baselines_dict:
                    baselines_dict[b.node_code] = {}
                baselines_dict[b.node_code][b.metric_name] = {
                    "mean": b.rolling_mean,
                    "std": b.rolling_std
                }

            telemetry_batch = []
            packets_batch = []
            alerts_batch = []

            nodes = db.query(NodeModel).all()
            node_map = {n.node_code: n for n in nodes}

            # 3. Process each sensor node
            for node_db in nodes:
                if node_db.node_code == "HUB":
                    continue
                code = node_db.node_code

                # Auto-initialize state if new node was added dynamically
                if code not in self.node_states:
                    is_landslide = "landslide" in (node_db.hazard_type or "").lower()
                    self.node_states[code] = {
                        "turbidity": 0.0 if is_landslide else 18.0,
                        "turbulence": 0.0 if is_landslide else 11.0,
                        "water_coverage": 0.0 if is_landslide else 38.0,
                        "rain_rate": 0.0,
                        "water_level_m": 0.0 if is_landslide else 2.1,
                        "flame_detected": False,
                        "smoke_density_pct": 8.0,
                        "pm25": 22.0,
                        "pm10": 45.0,
                        "aqi": 42,
                        "temperature_c": 22.0,
                        "humidity_pct": 60.0,
                        "heat_index_c": 24.0,
                        "accel_x": 0.0,
                        "accel_y": 0.0,
                        "accel_z": 1.0,
                        "tilt_deg": 0.4 if is_landslide else 0.2,
                        "soil_moisture": 32.0 if is_landslide else 28.0,
                        "geophone_peak_v": 0.03,
                        "gas_voc_ppm": 16.0,
                        "chemical_leak_ppm": 0.0,
                        "water_ph": 7.4,
                        "water_tds_ppm": 145.0,
                        "water_do_mg_l": 8.2,
                        "battery_mv": node_db.battery_mv or 3300,
                        "battery_pct": node_db.battery_pct or 98.0
                    }

                state = self.node_states[code]
                node_baselines = baselines_dict.get(code, {})

                # Feed in-memory history
                for m_name in ["turbidity", "turbulence", "water_coverage", "rain_rate", "tilt_deg", "soil_moisture", "pm25", "temperature_c", "gas_voc_ppm", "water_ph"]:
                    if m_name in state:
                        physics_engine.record_metric(code, m_name, state[m_name], now_epoch)

                # Compute statistical derivatives
                turb_z = physics_engine.calculate_zscore(
                    state["turbidity"],
                    node_baselines.get("turbidity", {}).get("mean", 18.5),
                    node_baselines.get("turbidity", {}).get("std", 3.2)
                )
                turb_roc = physics_engine.calculate_roc(code, "turbidity", state["turbidity"], now_epoch)

                water_z = physics_engine.calculate_zscore(
                    state["water_coverage"],
                    node_baselines.get("water_coverage", {}).get("mean", 39.0),
                    node_baselines.get("water_coverage", {}).get("std", 4.1)
                )
                water_roc = physics_engine.calculate_roc(code, "water_coverage", state["water_coverage"], now_epoch)

                # Determine primary metric and message type for 14-byte LoRa packet
                if code == "N4":
                    primary_val = int(state["tilt_deg"] * 100)
                    roc_val = int(physics_engine.calculate_roc(code, "tilt_deg", state["tilt_deg"], now_epoch) * 100)
                elif self.active_event == "AIR":
                    primary_val = int(state["pm25"] * 10)
                    roc_val = int(physics_engine.calculate_roc(code, "pm25", state["pm25"], now_epoch) * 10)
                elif self.active_event == "HEAT":
                    primary_val = int(state["temperature_c"] * 10)
                    roc_val = int(physics_engine.calculate_roc(code, "temperature_c", state["temperature_c"], now_epoch) * 10)
                elif self.active_event == "CHEMICAL":
                    primary_val = int(state["chemical_leak_ppm"] * 10)
                    roc_val = int(state["chemical_leak_ppm"] * 10)
                elif self.active_event == "WATER":
                    primary_val = int(state["water_ph"] * 100)
                    roc_val = int((7.4 - state["water_ph"]) * 100)
                else:
                    primary_val = int(state["turbidity"] * 10)
                    roc_val = int(turb_roc * 10)

                msg_type = 1 # Routine
                if abs(turb_z) > 3.0 or state["tilt_deg"] > 2.0 or state["turbidity"] > 60.0 or state.get("flame_detected") or state["pm25"] > 140 or state["temperature_c"] > 41:
                    msg_type = 2 # Anomaly Alert

                # Encode 14-byte packed LoRa struct
                packet_bytes, hex_str, crc8 = LoRaPacketCodec.encode(
                    node_id=node_db.id,
                    timestamp=int(now_epoch),
                    msg_type=msg_type,
                    primary_reading=primary_val,
                    rate_of_change=roc_val,
                    battery_mv=int(state["battery_mv"]),
                    health_flags=0x06
                )

                # Create Reading DB record with all 7 risk metrics
                reading = ReadingModel(
                    node_id=node_db.id,
                    timestamp=now,
                    turbidity=state["turbidity"],
                    turbulence=state["turbulence"],
                    water_coverage=state["water_coverage"],
                    rain_rate=state["rain_rate"],
                    water_level_m=state["water_level_m"],
                    flame_detected=state["flame_detected"],
                    smoke_density_pct=state["smoke_density_pct"],
                    pm25=state["pm25"],
                    pm10=state["pm10"],
                    aqi=state["aqi"],
                    temperature_c=state["temperature_c"],
                    humidity_pct=state["humidity_pct"],
                    heat_index_c=state["heat_index_c"],
                    accel_x=state["accel_x"],
                    accel_y=state["accel_y"],
                    accel_z=state["accel_z"],
                    tilt_deg=state["tilt_deg"],
                    soil_moisture=state["soil_moisture"],
                    geophone_peak_v=state["geophone_peak_v"],
                    gas_voc_ppm=state["gas_voc_ppm"],
                    chemical_leak_ppm=state["chemical_leak_ppm"],
                    water_ph=state["water_ph"],
                    water_tds_ppm=state["water_tds_ppm"],
                    water_do_mg_l=state["water_do_mg_l"],
                    turbidity_z=turb_z,
                    turbidity_roc=turb_roc,
                    water_coverage_z=water_z,
                    water_coverage_roc=water_roc,
                    battery_mv=int(state["battery_mv"]),
                    flags=0x06
                )
                db.add(reading)
                telemetry_batch.append({
                    "node_id": node_db.id,
                    "node_code": code,
                    "timestamp": now.isoformat(),
                    "turbidity": state["turbidity"],
                    "turbulence": state["turbulence"],
                    "water_coverage": state["water_coverage"],
                    "rain_rate": state["rain_rate"],
                    "water_level_m": state["water_level_m"],
                    "flame_detected": state["flame_detected"],
                    "smoke_density_pct": state["smoke_density_pct"],
                    "pm25": state["pm25"],
                    "pm10": state["pm10"],
                    "aqi": state["aqi"],
                    "temperature_c": state["temperature_c"],
                    "humidity_pct": state["humidity_pct"],
                    "heat_index_c": state["heat_index_c"],
                    "tilt_deg": state["tilt_deg"],
                    "soil_moisture": state["soil_moisture"],
                    "geophone_peak_v": state["geophone_peak_v"],
                    "gas_voc_ppm": state["gas_voc_ppm"],
                    "chemical_leak_ppm": state["chemical_leak_ppm"],
                    "water_ph": state["water_ph"],
                    "water_tds_ppm": state["water_tds_ppm"],
                    "water_do_mg_l": state["water_do_mg_l"],
                    "turbidity_z": turb_z,
                    "turbidity_roc": turb_roc,
                    "water_coverage_z": water_z,
                    "water_coverage_roc": water_roc,
                    "battery_mv": state["battery_mv"],
                    "battery_pct": state["battery_pct"],
                    "status": node_db.status
                })

                # Create Packet DB record
                packet_rec = PacketModel(
                    node_id=node_db.id,
                    node_code=code,
                    timestamp=now,
                    msg_type=msg_type,
                    raw_hex=hex_str,
                    byte_length=14,
                    primary_reading=primary_val,
                    rate_of_change=roc_val,
                    battery_mv=int(state["battery_mv"]),
                    health_flags=0x06,
                    crc8=crc8,
                    is_valid=True
                )
                db.add(packet_rec)
                packets_batch.append({
                    "id": 0,
                    "node_id": node_db.id,
                    "node_code": code,
                    "timestamp": now.isoformat(),
                    "msg_type": msg_type,
                    "raw_hex": hex_str,
                    "primary_reading": primary_val,
                    "rate_of_change": roc_val,
                    "battery_mv": int(state["battery_mv"]),
                    "crc8": crc8,
                    "is_valid": True
                })

                # Evaluate rule engine
                node_alerts = physics_engine.evaluate_alert_rules(
                    code, state, node_baselines, now_epoch
                )

                for a in node_alerts:
                    recent = db.query(AlertModel).filter(
                        AlertModel.node_code == code,
                        AlertModel.hazard_type == a["hazard_type"],
                        AlertModel.status != "RESOLVED"
                    ).first()

                    if not recent:
                        alert_obj = AlertModel(
                            node_id=node_db.id,
                            node_code=code,
                            timestamp=now,
                            severity=a["severity"],
                            hazard_type=a["hazard_type"],
                            message=a["message"],
                            trigger_rule=a["trigger_rule"],
                            z_score=a["z_score"],
                            rate_of_change=a["rate_of_change"],
                            propagation_stage=a.get("propagation_stage", "LOCAL"),
                            lead_time_min=a.get("lead_time_min", 0.0),
                            status="NEW"
                        )
                        db.add(alert_obj)
                        db.flush()

                        # Generate Automated Citizen SMS Dispatch
                        sms_obj = SMSLogModel(
                            timestamp=now,
                            alert_id=alert_obj.id,
                            recipient_group=a.get("recipient_group", "Emergency Response Team"),
                            recipient_count=random.randint(120, 850),
                            phone_preview="+91 98112-XXXXX (+540 local citizens)",
                            message_body=a.get("sms_preview", a["message"]),
                            status="SENT",
                            channel="GSM_LORA_GATEWAY"
                        )
                        db.add(sms_obj)

                        alerts_batch.append({
                            "id": alert_obj.id,
                            "timestamp": now.isoformat(),
                            "node_id": node_db.id,
                            "node_code": code,
                            "severity": a["severity"],
                            "hazard_type": a["hazard_type"],
                            "message": a["message"],
                            "trigger_rule": a["trigger_rule"],
                            "z_score": a["z_score"],
                            "rate_of_change": a["rate_of_change"],
                            "propagation_stage": a.get("propagation_stage", "LOCAL"),
                            "lead_time_min": a.get("lead_time_min", 0.0),
                            "status": "NEW"
                        })

                # Node status calculation
                is_alert = (
                    turb_z > 4.0 or state["tilt_deg"] > 2.0 or state["turbidity"] > 70.0 or
                    state["flame_detected"] or state["pm25"] > 150 or state["temperature_c"] > 42 or
                    state["chemical_leak_ppm"] > 40 or state["water_ph"] < 5.5
                )
                is_warn = (
                    turb_z > 2.2 or state["tilt_deg"] > 1.2 or state["turbidity"] > 45.0 or
                    state["smoke_density_pct"] > 45 or state["pm25"] > 90 or state["temperature_c"] > 38 or
                    state["chemical_leak_ppm"] > 15 or state["water_ph"] < 6.2 or state["water_tds_ppm"] > 450
                )

                if is_alert:
                    node_db.status = "ALERT"
                elif is_warn:
                    node_db.status = "WARNING"
                else:
                    node_db.status = "ONLINE"

                node_db.last_seen = now
                node_db.battery_mv = int(state["battery_mv"])
                node_db.battery_pct = state["battery_pct"]

            db.commit()

            # 4. Hub Health Metrics
            db_size_kb = 0.0
            if os.path.exists(db.bind.url.database):
                db_size_kb = os.path.getsize(db.bind.url.database) / 1024.0

            active_alerts_cnt = db.query(AlertModel).filter(AlertModel.status != "RESOLVED").count()
            nodes_online_cnt = db.query(NodeModel).filter(NodeModel.status != "OFFLINE").count()

            correlation_data = physics_engine.compute_cross_correlation("N1", "N2", "turbidity")
            travel_time_n1_n3 = physics_engine.calculate_travel_time("N1", "N3")

            # 5. Broadcast over WebSockets
            if self.broadcast_callback:
                host_cpu = psutil.cpu_percent() if hasattr(psutil, "cpu_percent") else random.uniform(8.0, 18.0)
                host_mem = psutil.virtual_memory().percent if hasattr(psutil, "virtual_memory") else 42.0

                broadcast_payload = {
                    "type": "CYCLE_UPDATE",
                    "timestamp": now.isoformat(),
                    "telemetry": telemetry_batch,
                    "recent_packets": packets_batch,
                    "new_alerts": alerts_batch,
                    "active_surge": physics_engine.active_surge,
                    "correlation": correlation_data,
                    "travel_time_estimate": travel_time_n1_n3,
                    "system_health": {
                        "cpu_percent": round(host_cpu, 1),
                        "memory_percent": round(host_mem, 1),
                        "db_size_kb": round(db_size_kb, 1),
                        "total_packets_received": db.query(PacketModel).count(),
                        "active_alerts_count": active_alerts_cnt,
                        "nodes_online": nodes_online_cnt,
                        "simulation_state": self.active_event or "IDLE_MONITORING",
                        "speed_multiplier": self.speed_multiplier,
                        "event_phase_sec": round(self.event_phase_sec, 1)
                    }
                }
                await self.broadcast_callback(broadcast_payload)

        finally:
            db.close()

    def _update_node_physics(self):
        """
        Synthesizes dynamic physical sensor readings across all 7 environmental risks.
        """
        # 1. Normal stochastic background variation
        for code, s in self.node_states.items():
            if code != "N4":
                s["turbidity"] = max(8.0, min(100.0, s["turbidity"] + random.uniform(-0.3, 0.3)))
                s["turbulence"] = max(4.0, min(100.0, s["turbulence"] + random.uniform(-0.2, 0.2)))
                s["water_coverage"] = max(20.0, min(100.0, s["water_coverage"] + random.uniform(-0.2, 0.2)))
                s["rain_rate"] = max(0.0, min(200.0, s["rain_rate"] + random.uniform(-0.1, 0.1)))
                s["water_level_m"] = max(1.0, min(10.0, s["water_level_m"] + random.uniform(-0.02, 0.02)))
            else:
                s["tilt_deg"] = max(0.1, min(45.0, s["tilt_deg"] + random.uniform(-0.01, 0.01)))
                s["soil_moisture"] = max(10.0, min(100.0, s["soil_moisture"] + random.uniform(-0.15, 0.15)))

            s["pm25"] = max(10.0, min(300.0, s["pm25"] + random.uniform(-0.4, 0.4)))
            s["pm10"] = max(20.0, min(500.0, s["pm10"] + random.uniform(-0.5, 0.5)))
            s["aqi"] = int(s["pm25"] * 1.8 + random.uniform(-2, 2))
            s["smoke_density_pct"] = max(3.0, min(100.0, s["smoke_density_pct"] + random.uniform(-0.1, 0.1)))
            s["temperature_c"] = max(15.0, min(55.0, s["temperature_c"] + random.uniform(-0.1, 0.1)))
            s["heat_index_c"] = round(s["temperature_c"] + (s["humidity_pct"] * 0.05), 1)
            s["water_ph"] = max(6.0, min(9.0, s["water_ph"] + random.uniform(-0.01, 0.01)))
            s["water_tds_ppm"] = max(80.0, min(1000.0, s["water_tds_ppm"] + random.uniform(-0.5, 0.5)))
            s["water_do_mg_l"] = max(2.0, min(12.0, s["water_do_mg_l"] + random.uniform(-0.02, 0.02)))

            s["battery_mv"] = max(3100, min(3350, s["battery_mv"] + random.choice([-1, 0, 1])))
            s["battery_pct"] = round((s["battery_mv"] - 3000) / (3350 - 3000) * 100, 1)

        # 2. Dynamic Event Scenarios
        # A. FLOOD
        if self.active_event == "FLOOD":
            t = self.event_phase_sec
            if t < 40.0:
                s1 = self.node_states["N1"]
                s1["turbidity"] += (88.0 - s1["turbidity"]) * 0.35
                s1["water_coverage"] += (78.0 - s1["water_coverage"]) * 0.25
                s1["turbulence"] += (82.0 - s1["turbulence"]) * 0.30
                s1["water_level_m"] += (5.4 - s1["water_level_m"]) * 0.30
                s1["rain_rate"] = 68.0 + random.uniform(-5.0, 5.0)

            if t >= 8.0 and t < 70.0:
                s2 = self.node_states["N2"]
                s2["turbidity"] += (82.0 - s2["turbidity"]) * 0.28
                s2["water_coverage"] += (72.0 - s2["water_coverage"]) * 0.22
                s2["water_level_m"] += (4.8 - s2["water_level_m"]) * 0.25

            if t >= 18.0 and t < 95.0:
                s3 = self.node_states["N3"]
                s3["turbidity"] += (78.0 - s3["turbidity"]) * 0.25
                s3["water_coverage"] += (68.0 - s3["water_coverage"]) * 0.20
                s3["water_level_m"] += (4.5 - s3["water_level_m"]) * 0.22

            if t >= 30.0 and t < 120.0:
                s5 = self.node_states["N5"]
                s5["turbidity"] += (70.0 - s5["turbidity"]) * 0.22
                s5["water_coverage"] += (62.0 - s5["water_coverage"]) * 0.18
                s5["water_level_m"] += (3.9 - s5["water_level_m"]) * 0.20

            if t >= 120.0:
                for c in ["N1", "N2", "N3", "N5"]:
                    sc = self.node_states[c]
                    sc["turbidity"] += (18.5 - sc["turbidity"]) * 0.05
                    sc["water_coverage"] += (39.0 - sc["water_coverage"]) * 0.05
                    sc["water_level_m"] += (2.1 - sc["water_level_m"]) * 0.05
                    sc["rain_rate"] = max(0.0, sc["rain_rate"] - 1.5)

        # B. FOREST FIRE & SMOKE
        elif self.active_event == "FIRE":
            s4 = self.node_states["N4"]
            s4["flame_detected"] = True
            s4["smoke_density_pct"] = min(92.0, s4["smoke_density_pct"] + 4.5)
            s4["temperature_c"] = min(48.0, s4["temperature_c"] + 1.2)
            s4["pm25"] = min(280.0, s4["pm25"] + 8.0)
            s4["aqi"] = int(s4["pm25"] * 1.5)

            s3 = self.node_states["N3"]
            s3["smoke_density_pct"] = min(65.0, s3["smoke_density_pct"] + 2.5)
            s3["pm25"] = min(190.0, s3["pm25"] + 4.0)
            s3["aqi"] = int(s3["pm25"] * 1.5)

        # C. HAZARDOUS AIR POLLUTION (AQI / SMOG)
        elif self.active_event == "AIR":
            for c in ["N3", "N5"]:
                sc = self.node_states[c]
                sc["pm25"] = min(220.0, sc["pm25"] + 9.5)
                sc["pm10"] = min(420.0, sc["pm10"] + 15.0)
                sc["aqi"] = min(410, int(sc["pm25"] * 1.9))

        # D. EXTREME HEAT WAVE
        elif self.active_event == "HEAT":
            for c in ["N2", "N3", "N5"]:
                sc = self.node_states[c]
                sc["temperature_c"] = min(46.5, sc["temperature_c"] + 0.8)
                sc["humidity_pct"] = max(35.0, sc["humidity_pct"] - 0.5)
                sc["heat_index_c"] = min(54.0, sc["temperature_c"] + 6.5)

        # E. LANDSLIDE
        elif self.active_event == "LANDSLIDE":
            s4 = self.node_states["N4"]
            s4["rain_rate"] = 75.0 + random.uniform(-5.0, 5.0)
            s4["soil_moisture"] = min(96.0, s4["soil_moisture"] + 2.5)
            if s4["soil_moisture"] > 65.0:
                s4["tilt_deg"] = min(6.8, s4["tilt_deg"] + 0.18)
                s4["geophone_peak_v"] = random.uniform(0.85, 2.4)

        # F. INDUSTRIAL CHEMICAL LEAK / VOC
        elif self.active_event == "CHEMICAL":
            s3 = self.node_states["N3"]
            s3["chemical_leak_ppm"] = min(88.0, s3["chemical_leak_ppm"] + 4.5)
            s3["gas_voc_ppm"] = min(120.0, s3["gas_voc_ppm"] + 5.0)

        # G. WATER QUALITY DEGRADATION
        elif self.active_event == "WATER":
            s1 = self.node_states["N1"]
            s1["water_ph"] = max(4.8, s1["water_ph"] - 0.15)
            s1["water_tds_ppm"] = min(850.0, s1["water_tds_ppm"] + 35.0)
            s1["water_do_mg_l"] = max(1.8, s1["water_do_mg_l"] - 0.3)

            s2 = self.node_states["N2"]
            s2["water_ph"] = max(5.2, s2["water_ph"] - 0.10)
            s2["water_tds_ppm"] = min(720.0, s2["water_tds_ppm"] + 25.0)
            s2["water_do_mg_l"] = max(2.5, s2["water_do_mg_l"] - 0.2)

simulator = Simulator()
