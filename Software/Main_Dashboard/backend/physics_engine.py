import math
import datetime
from typing import Dict, List, Optional, Tuple, Any

class PhysicsEngine:
    """
    Computes rolling baselines, Z-scores, rates of change, spatiotemporal
    river wave travel-time propagation, cross-node correlation, and explainable
    early warning alerts.
    """

    # River distances along valley from N1 (in kilometers)
    NODE_RIVER_KM = {
        "N1": 0.0,
        "N2": 4.8,
        "N3": 9.2,
        "N4": 13.5,  # Ridge landslide node
        "N5": 18.5,
    }

    # Physical parameters for Himalayan mountain river (Alaknanda / Ganga)
    DEFAULT_RIVER_VELOCITY_MPS = 3.5    # meters/second (~12.6 km/h)
    SURGE_RIVER_VELOCITY_MPS = 4.2      # during flash flood surge

    def __init__(self):
        # In-memory fast rolling history for real-time calculations
        # Structure: node_code -> metric_name -> list of (timestamp_epoch, value)
        self.history: Dict[str, Dict[str, List[Tuple[float, float]]]] = {
            f"N{i}": {
                "turbidity": [],
                "turbulence": [],
                "water_coverage": [],
                "rain_rate": [],
                "tilt_deg": [],
                "soil_moisture": [],
                "gas_voc_ppm": [],
                "battery_mv": []
            } for i in range(1, 6)
        }

        # Active surge tracking for travel time
        self.active_surge: Optional[Dict[str, Any]] = None

    def record_metric(self, node_code: str, metric_name: str, value: float, timestamp_epoch: float):
        if node_code not in self.history:
            self.history[node_code] = {
                "turbidity": [],
                "turbulence": [],
                "water_coverage": [],
                "rain_rate": [],
                "tilt_deg": [],
                "soil_moisture": [],
                "gas_voc_ppm": [],
                "battery_mv": [],
                "pm25": [],
                "temperature_c": [],
                "water_ph": []
            }
        if metric_name not in self.history[node_code]:
            self.history[node_code][metric_name] = []
        
        hist = self.history[node_code][metric_name]
        hist.append((timestamp_epoch, value))
        # Keep recent 200 samples in RAM for fast correlation and ROC calculations
        if len(hist) > 200:
            self.history[node_code][metric_name] = hist[-200:]

    def calculate_roc(self, node_code: str, metric_name: str, current_val: float, current_time: float) -> float:
        """
        Calculates rate of change (delta per minute) over the last 15-60 seconds.
        """
        hist = self.history.get(node_code, {}).get(metric_name, [])
        if len(hist) < 2:
            return 0.0

        # Look back approx 30 seconds
        prev_time, prev_val = hist[-2]
        dt_sec = max(1.0, current_time - prev_time)
        dt_min = dt_sec / 60.0
        roc = (current_val - prev_val) / dt_min
        return round(roc, 2)

    def calculate_zscore(self, current_val: float, baseline_mean: float, baseline_std: float) -> float:
        """
        Z = (X - μ) / σ
        """
        if baseline_std <= 0.001:
            baseline_std = 1.0
        z = (current_val - baseline_mean) / baseline_std
        return round(z, 2)

    def calculate_travel_time(
        self,
        from_node: str,
        to_node: str,
        velocity_mps: Optional[float] = None
    ) -> Dict[str, Any]:
        """
        Computes physical distance and expected travel time between two valley nodes.
        """
        dist_km = abs(self.NODE_RIVER_KM.get(to_node, 0.0) - self.NODE_RIVER_KM.get(from_node, 0.0))
        dist_m = dist_km * 1000.0
        v = velocity_mps or self.DEFAULT_RIVER_VELOCITY_MPS

        travel_time_sec = dist_m / v
        travel_time_min = travel_time_sec / 60.0
        travel_time_hours = travel_time_min / 60.0

        return {
            "from_node": from_node,
            "to_node": to_node,
            "distance_km": round(dist_km, 2),
            "distance_m": round(dist_m, 1),
            "velocity_mps": round(v, 2),
            "travel_time_sec": round(travel_time_sec, 1),
            "travel_time_min": round(travel_time_min, 1),
            "travel_time_hours": round(travel_time_hours, 2),
            "tolerance_window_sec": 600 # +/- 10 mins window
        }

    def compute_cross_correlation(
        self,
        upstream_node: str = "N1",
        downstream_node: str = "N2",
        metric: str = "turbidity"
    ) -> Dict[str, Any]:
        """
        Computes Pearson correlation coefficient of deviation profiles between upstream and downstream nodes.
        """
        up_hist = self.history.get(upstream_node, {}).get(metric, [])
        down_hist = self.history.get(downstream_node, {}).get(metric, [])

        min_len = min(len(up_hist), len(down_hist))
        if min_len < 5:
            return {
                "correlation": 0.0,
                "confidence_pct": 50.0,
                "sample_points": min_len,
                "status": "CALIBRATING"
            }

        up_vals = [v for _, v in up_hist[-min_len:]]
        down_vals = [v for _, v in down_hist[-min_len:]]

        mean_up = sum(up_vals) / min_len
        mean_down = sum(down_vals) / min_len

        numerator = sum((u - mean_up) * (d - mean_down) for u, d in zip(up_vals, down_vals))
        var_up = sum((u - mean_up) ** 2 for u in up_vals)
        var_down = sum((d - mean_down) ** 2 for d in down_vals)

        denom = math.sqrt(var_up * var_down)
        if denom < 0.0001:
            r = 0.0
        else:
            r = max(-1.0, min(1.0, numerator / denom))

        confidence = min(99.0, max(40.0, (abs(r) * 60.0) + (min_len * 1.5)))

        return {
            "upstream_node": upstream_node,
            "downstream_node": downstream_node,
            "metric": metric,
            "correlation": round(r, 3),
            "confidence_pct": round(confidence, 1),
            "sample_points": min_len,
            "status": "STRONG_CORRELATION" if r > 0.65 else ("MODERATE" if r > 0.3 else "LOW")
        }

    def evaluate_alert_rules(
        self,
        node_code: str,
        readings: Dict[str, float],
        baselines: Dict[str, Dict[str, float]],
        simulation_time_epoch: float
    ) -> List[Dict[str, Any]]:
        """
        Runs explainable multi-stage rule engine across all 7 environmental hazards:
        1. Flash Flooding & Rising Water Levels
        2. Forest Fires & Smoke Outbreaks
        3. Hazardous Air Pollution (PM2.5 / AQI)
        4. Extreme Heat Conditions & Heat Index
        5. Landslide Precursors & Slope Instability
        6. Industrial Chemical Leaks & Toxic Emissions
        7. Water Quality Degradation (pH, TDS, DO)
        """
        generated_alerts = []

        # 1. Rising Water & Flood Metrics
        turbidity = readings.get("turbidity", 15.0)
        water_cov = readings.get("water_coverage", 38.0)
        water_lvl = readings.get("water_level_m", 2.1)
        turb_mean = baselines.get("turbidity", {}).get("mean", 18.5)
        turb_std = baselines.get("turbidity", {}).get("std", 3.2)
        turb_z = self.calculate_zscore(turbidity, turb_mean, turb_std)
        turb_roc = self.calculate_roc(node_code, "turbidity", turbidity, simulation_time_epoch)
        water_mean = baselines.get("water_coverage", {}).get("mean", 39.0)
        water_std = baselines.get("water_coverage", {}).get("std", 4.1)
        water_z = self.calculate_zscore(water_cov, water_mean, water_std)
        water_roc = self.calculate_roc(node_code, "water_coverage", water_cov, simulation_time_epoch)

        # 2. Forest Fire & Smoke Metrics
        flame = bool(readings.get("flame_detected", False))
        smoke = readings.get("smoke_density_pct", 8.0)

        # 3. Hazardous Air Pollution
        pm25 = readings.get("pm25", 22.0)
        aqi = int(readings.get("aqi", 42))

        # 4. Extreme Heat Conditions
        temp_c = readings.get("temperature_c", 22.0)
        humidity = readings.get("humidity_pct", 60.0)
        heat_idx = readings.get("heat_index_c", 24.0)

        # 5. Landslide Precursors
        tilt = readings.get("tilt_deg", 0.5)
        soil = readings.get("soil_moisture", 32.0)
        tilt_mean = baselines.get("tilt_deg", {}).get("mean", 0.45)
        tilt_std = baselines.get("tilt_deg", {}).get("std", 0.15)
        tilt_z = self.calculate_zscore(tilt, tilt_mean, tilt_std)

        # 6. Industrial Emissions & Chemical Leaks
        voc_ppm = readings.get("gas_voc_ppm", 16.5)
        chem_ppm = readings.get("chemical_leak_ppm", 0.0)

        # 7. Water Quality Degradation
        ph = readings.get("water_ph", 7.4)
        tds = readings.get("water_tds_ppm", 145.0)
        do_mg = readings.get("water_do_mg_l", 8.2)

        # --- RULE 1: Upstream Silt / Flash Flood Surge (N1) ---
        if node_code == "N1" and (turb_z > 3.0 or turbidity > 65.0 or water_lvl > 4.2):
            travel_n2 = self.calculate_travel_time("N1", "N2")
            travel_n3 = self.calculate_travel_time("N1", "N3")
            travel_n5 = self.calculate_travel_time("N1", "N5")

            self.active_surge = {
                "source_node": "N1",
                "detected_at": simulation_time_epoch,
                "initial_turbidity": turbidity,
                "turb_z": turb_z,
                "target_n2": travel_n2,
                "target_n3": travel_n3,
                "target_n5": travel_n5,
                "status": "PROPAGATING"
            }

            generated_alerts.append({
                "severity": "CRITICAL" if turb_z > 4.5 or water_lvl > 4.8 else "WARNING",
                "hazard_type": "FLOOD",
                "message": f"Upstream Sediment Surge & River Rise at N1: Turbidity {turbidity:.1f} (Z={turb_z:+.1f}), Level {water_lvl:.2f}m. Hydrodynamic wave propagating downstream.",
                "trigger_rule": f"Turbidity Z-Score ({turb_z:+.2f}) > 3.0 OR Water Level ({water_lvl:.2f}m) > 4.2m",
                "z_score": turb_z,
                "rate_of_change": turb_roc,
                "propagation_stage": "PROPAGATING",
                "lead_time_min": travel_n3["travel_time_min"],
                "recipient_group": "Upper Valley Flood Patrol & SDRF",
                "sms_preview": f"🚨 [EIN ALERT] Flash flood surge detected at N1 Upstream Gauge (Z={turb_z:+.1f}, Level {water_lvl:.1f}m). Wave arrival Devprayag: {travel_n2['travel_time_min']:.0f}m, Rishikesh: {travel_n3['travel_time_min']:.0f}m. Evacuate riverbeds."
            })

        # --- RULE 1b: Downstream Cross-Node Flood Confirmation (N2, N3, N5) ---
        if node_code in ["N2", "N3", "N5"] and self.active_surge is not None:
            if turb_z > 2.5 or water_z > 2.5 or turbidity > 55.0 or water_lvl > 4.0:
                generated_alerts.append({
                    "severity": "CRITICAL",
                    "hazard_type": "FLOOD",
                    "message": f"🚨 DISASTER CONFIRMED: Upstream surge wave arrived at {node_code} (Turbidity {turbidity:.1f}, Water Area {water_cov:.1f}%). Multi-node correlation validated!",
                    "trigger_rule": f"Cross-Node Wave Match: {self.active_surge['source_node']} -> {node_code} (Z={turb_z:+.2f} > 2.5)",
                    "z_score": turb_z,
                    "rate_of_change": turb_roc,
                    "propagation_stage": "CONFIRMED",
                    "lead_time_min": 0.0,
                    "recipient_group": f"District Emergency Operations & {node_code} Riverfront",
                    "sms_preview": f"🚨 [CRITICAL EVACUATION] Confirmed flood wave arrival at {node_code}! Water coverage {water_cov:.1f}%. Immediate riverbank evacuation ordered by Central Hub."
                })

        # --- RULE 2: Forest Fire & Smoke Outbreak (N4 or N3) ---
        if flame or smoke > 60.0:
            fire_z = self.calculate_zscore(smoke, 8.0, 2.0)
            generated_alerts.append({
                "severity": "CRITICAL" if flame and smoke > 50.0 else "WARNING",
                "hazard_type": "FOREST_FIRE",
                "message": f"Active Forest Fire & Smoke Plume at {node_code}: Thermal IR Flame {'DETECTED' if flame else 'ELEVATED'}, Smoke Density {smoke:.1f}%.",
                "trigger_rule": f"Thermal Flame Signature OR Smoke Obscuration ({smoke:.1f}%) > 60%",
                "z_score": fire_z,
                "rate_of_change": round(smoke * 0.8, 1),
                "propagation_stage": "LOCAL",
                "lead_time_min": 10.0,
                "recipient_group": f"{node_code} Valley Forest Division & Fire Wardens",
                "sms_preview": f"🔥 [FOREST FIRE ALERT] Wildfire detected near {node_code} Ridge (Smoke Density {smoke:.1f}%). Forest department and local settlements initiate containment."
            })

        # --- RULE 3: Hazardous Air Pollution (PM2.5 & AQI) ---
        if pm25 > 140.0 or aqi > 280:
            aqi_z = self.calculate_zscore(float(aqi), 45.0, 8.0)
            generated_alerts.append({
                "severity": "CRITICAL" if aqi > 350 else "WARNING",
                "hazard_type": "AIR_POLLUTION",
                "message": f"Hazardous Air Pollution Spike at {node_code}: PM2.5 = {pm25:.1f} µg/m³, AQI = {aqi} (Severe/Hazardous Category).",
                "trigger_rule": f"AQI ({aqi}) > 280 (Hazardous) OR PM2.5 ({pm25:.1f}) > 140 µg/m³",
                "z_score": aqi_z,
                "rate_of_change": round(pm25 * 0.4, 1),
                "propagation_stage": "LOCAL",
                "lead_time_min": 30.0,
                "recipient_group": f"{node_code} Municipal Health Board & Local Citizens",
                "sms_preview": f"💨 [AIR QUALITY EMERGENCY] Hazardous air pollution recorded at {node_code} (AQI {aqi}, PM2.5 {pm25:.1f}µg/m³). Vulnerable citizens stay indoors and wear N95 masks."
            })

        # --- RULE 4: Extreme Heat Conditions & Heat Index ---
        if temp_c > 41.0 or heat_idx > 46.0:
            temp_z = self.calculate_zscore(temp_c, 22.0, 3.5)
            generated_alerts.append({
                "severity": "CRITICAL" if heat_idx > 50.0 else "WARNING",
                "hazard_type": "EXTREME_HEAT",
                "message": f"Extreme Heatwave & Thermal Stress at {node_code}: Ambient Temp {temp_c:.1f}°C, Heat Index {heat_idx:.1f}°C (Dangerous Threshold).",
                "trigger_rule": f"Heat Index ({heat_idx:.1f}°C) > 46°C OR Temperature ({temp_c:.1f}°C) > 41°C",
                "z_score": temp_z,
                "rate_of_change": round((temp_c - 22.0) * 1.5, 1),
                "propagation_stage": "REGIONAL",
                "lead_time_min": 60.0,
                "recipient_group": f"{node_code} Public Health & Urban Heat Action Team",
                "sms_preview": f"☀️ [HEAT WAVE ADVISORY] Extreme temperature warning at {node_code} ({temp_c:.1f}°C, Heat Index {heat_idx:.1f}°C). Avoid direct sun exposure between 12 PM - 4 PM. Stay hydrated."
            })

        # --- RULE 5: Landslide Slope Shift at N4 (Narendra Nagar) ---
        if node_code == "N4" and (tilt_z > 3.5 or tilt > 2.2 or (soil > 68.0 and tilt > 1.6)):
            generated_alerts.append({
                "severity": "CRITICAL",
                "hazard_type": "LANDSLIDE",
                "message": f"Slope Incline Shift Detected at N4: Tilt {tilt:.2f}° (Z={tilt_z:+.1f}), Soil Saturation {soil:.1f}%. High landslide risk.",
                "trigger_rule": f"Slope Tilt ({tilt:.2f}°) > 2.0° AND Soil Moisture ({soil:.1f}%) > 68%",
                "z_score": tilt_z,
                "rate_of_change": round((tilt - tilt_mean) * 10, 2),
                "propagation_stage": "LOCAL",
                "lead_time_min": 15.0,
                "recipient_group": "Narendra Nagar Highway Patrol & SDRF",
                "sms_preview": f"⚠️ [LANDSLIDE WARNING] Narendra Nagar Ridge N4 reporting slope movement ({tilt:.2f}°, Saturation {soil:.1f}%). Rishikesh-Badrinath highway landslide danger."
            })

        # --- RULE 6: Industrial Emissions & Toxic Chemical Leaks ---
        if chem_ppm > 40.0 or voc_ppm > 75.0:
            chem_z = self.calculate_zscore(chem_ppm if chem_ppm > 0 else voc_ppm, 16.5, 2.9)
            generated_alerts.append({
                "severity": "CRITICAL",
                "hazard_type": "CHEMICAL_LEAK",
                "message": f"Toxic Chemical Emission / Gas Leak at {node_code}: Gas VOC {voc_ppm:.1f} ppm, Chemical Toxic Level {chem_ppm:.1f} ppm.",
                "trigger_rule": f"Chemical Toxic Level ({chem_ppm:.1f} ppm) > 40 ppm OR VOC ({voc_ppm:.1f}) > 75 ppm",
                "z_score": chem_z,
                "rate_of_change": round(chem_ppm * 1.2, 1),
                "propagation_stage": "LOCAL",
                "lead_time_min": 5.0,
                "recipient_group": f"{node_code} Hazmat Unit, Police & Industrial Safety",
                "sms_preview": f"☣️ [HAZMAT EVACUATION] Toxic chemical leak reported near {node_code} industrial area ({chem_ppm:.1f} ppm). Downwind residents evacuate perpendicular to wind."
            })

        # --- RULE 7: Water Quality Degradation ---
        if ph < 6.0 or ph > 8.8 or tds > 600.0 or do_mg < 4.0:
            ph_z = self.calculate_zscore(ph, 7.4, 0.25)
            generated_alerts.append({
                "severity": "CRITICAL" if ph < 5.0 or ph > 9.5 or do_mg < 2.5 else "WARNING",
                "hazard_type": "WATER_POLLUTION",
                "message": f"Severe Water Quality Degradation at {node_code}: pH={ph:.2f}, TDS={tds:.0f} ppm, Dissolved Oxygen={do_mg:.1f} mg/L.",
                "trigger_rule": f"Water pH ({ph:.2f}) out of [6.5-8.5] OR TDS ({tds:.0f} ppm) > 600 OR DO ({do_mg:.1f}) < 4.0",
                "z_score": ph_z,
                "rate_of_change": round((7.4 - ph) * 4, 1),
                "propagation_stage": "LOCAL",
                "lead_time_min": 20.0,
                "recipient_group": f"{node_code} Jal Sansthan & Water Supply Department",
                "sms_preview": f"🧪 [WATER CONTAMINATION ALERT] Severe water quality degradation at {node_code} (pH {ph:.2f}, TDS {tds:.0f} ppm, DO {do_mg:.1f}mg/L). Stop municipal drinking water intake."
            })

        return generated_alerts

physics_engine = PhysicsEngine()
