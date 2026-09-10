export interface SensorNode {
  id: number;
  node_code: string;
  name: string;
  hazard_type: string;
  latitude: number;
  longitude: number;
  elevation_m: number;
  river_km: number;
  battery_mv: number;
  battery_pct: number;
  signal_rssi: number;
  signal_snr: number;
  status: 'ONLINE' | 'WARNING' | 'ALERT' | 'OFFLINE';
  relay_parent: string;
  hop_count: number;
  last_seen: string;
}

export interface Reading {
  id: number;
  node_id: number;
  node_code?: string;
  timestamp: string;
  
  // 1. Flood & Water Levels
  turbidity: number;
  turbulence: number;
  water_coverage: number;
  rain_rate: number;
  water_level_m?: number;
  
  // 2. Forest Fire & Smoke
  flame_detected?: boolean;
  smoke_density_pct?: number;
  
  // 3. Hazardous Air Pollution
  pm25?: number;
  pm10?: number;
  aqi?: number;
  
  // 4. Extreme Heat Conditions
  temperature_c?: number;
  humidity_pct?: number;
  heat_index_c?: number;
  
  // 5. Landslide Precursors
  accel_x: number;
  accel_y: number;
  accel_z: number;
  tilt_deg: number;
  soil_moisture: number;
  geophone_peak_v?: number;
  
  // 6. Industrial Emissions & Chemical Leaks
  gas_voc_ppm?: number;
  chemical_leak_ppm?: number;
  
  // 7. Water Quality Degradation
  water_ph?: number;
  water_tds_ppm?: number;
  water_do_mg_l?: number;
  
  // Derived Stats
  turbidity_z: number;
  turbidity_roc: number;
  water_coverage_z: number;
  water_coverage_roc: number;
  battery_mv: number;
  flags: number;
}

export interface Alert {
  id: number;
  timestamp: string;
  node_id: number;
  node_code: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  hazard_type: 'FLOOD' | 'LANDSLIDE' | 'FOREST_FIRE' | 'AIR_POLLUTION' | 'EXTREME_HEAT' | 'CHEMICAL_LEAK' | 'WATER_POLLUTION' | 'WILDFIRE' | 'HARDWARE' | string;
  message: string;
  trigger_rule: string;
  z_score: number;
  rate_of_change: number;
  propagation_stage: 'LOCAL' | 'PROPAGATING' | 'CONFIRMED';
  lead_time_min: number;
  status: 'NEW' | 'ACKNOWLEDGED' | 'RESOLVED';
  acknowledged_at?: string;
  resolved_at?: string;
}

export interface SendSMSRequest {
  recipient_group: string;
  phone_numbers: string;
  message_body: string;
  hazard_type?: string;
  recipient_count?: number;
}

export interface LoRaPacket {
  id: number;
  timestamp: string;
  node_id: number;
  node_code: string;
  msg_type: number;
  raw_hex: string;
  byte_length: number;
  primary_reading: number;
  rate_of_change: number;
  battery_mv: number;
  health_flags: number;
  crc8: number;
  is_valid: boolean;
}

export interface SMSLog {
  id: number;
  timestamp: string;
  alert_id?: number;
  recipient_group: string;
  recipient_count: number;
  phone_preview: string;
  message_body: string;
  status: 'QUEUED' | 'SENT' | 'CONFIRMED' | 'FAILED';
  channel: string;
}

export interface BaselineStats {
  node_code: string;
  metric_name: string;
  rolling_mean: number;
  rolling_std: number;
  sample_count: number;
  last_updated: string;
}

export interface CreateNodeRequest {
  node_code: string;
  name: string;
  hazard_type: string;
  latitude: number;
  longitude: number;
  elevation_m: number;
  river_km: number;
  battery_mv?: number;
  relay_parent?: string;
  hop_count?: number;
}

export interface TravelTimeInfo {
  from_node: string;
  to_node: string;
  distance_km: number;
  distance_m: number;
  velocity_mps: number;
  travel_time_sec: number;
  travel_time_min: number;
  travel_time_hours: number;
  tolerance_window_sec: number;
}

export interface CorrelationAnalytics {
  upstream_node: string;
  downstream_node: string;
  metric: string;
  correlation: number;
  confidence_pct: number;
  sample_points: number;
  status: string;
}

export interface ActiveSurge {
  source_node: string;
  detected_at: number;
  initial_turbidity: number;
  turb_z: number;
  target_n2: TravelTimeInfo;
  target_n3: TravelTimeInfo;
  target_n5: TravelTimeInfo;
  status: 'PROPAGATING' | 'CONFIRMED' | 'RESOLVED';
}

export interface SystemHealth {
  cpu_percent: number;
  memory_percent: number;
  db_size_kb: number;
  total_packets_received: number;
  active_alerts_count: number;
  nodes_online: number;
  simulation_state: string;
  speed_multiplier: number;
  event_phase_sec?: number;
  active_surge?: ActiveSurge | null;
}
