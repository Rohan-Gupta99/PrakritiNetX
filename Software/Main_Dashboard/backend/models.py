import datetime
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field

class NodeSchema(BaseModel):
    id: int
    node_code: str
    name: str
    hazard_type: str
    latitude: float
    longitude: float
    elevation_m: float
    river_km: float
    battery_mv: int
    battery_pct: float
    signal_rssi: int
    signal_snr: float
    status: str
    relay_parent: str
    hop_count: int
    last_seen: datetime.datetime

    class Config:
        from_attributes = True


class ReadingSchema(BaseModel):
    id: int
    node_id: int
    timestamp: datetime.datetime
    
    # 1. Rising Water & Flood
    turbidity: float
    turbulence: float
    water_coverage: float
    rain_rate: float
    water_level_m: float = 2.1
    
    # 2. Forest Fire & Smoke
    flame_detected: bool = False
    smoke_density_pct: float = 8.0
    
    # 3. Hazardous Air Pollution
    pm25: float = 22.0
    pm10: float = 45.0
    aqi: int = 42
    
    # 4. Extreme Heat Conditions
    temperature_c: float
    humidity_pct: float
    heat_index_c: float = 24.5
    
    # 5. Landslide Precursors
    accel_x: float
    accel_y: float
    accel_z: float
    tilt_deg: float
    soil_moisture: float
    geophone_peak_v: float
    
    # 6. Industrial Emissions & Chemical Leaks
    gas_voc_ppm: float
    chemical_leak_ppm: float = 0.0
    
    # 7. Water Quality Degradation
    water_ph: float = 7.4
    water_tds_ppm: float = 145.0
    water_do_mg_l: float = 8.2
    
    # Derived statistical values
    turbidity_z: float
    turbidity_roc: float
    water_coverage_z: float
    water_coverage_roc: float
    battery_mv: int
    flags: int

    class Config:
        from_attributes = True


class AlertSchema(BaseModel):
    id: int
    timestamp: datetime.datetime
    node_id: int
    node_code: str
    severity: str
    hazard_type: str
    message: str
    trigger_rule: str
    z_score: float
    rate_of_change: float
    propagation_stage: str
    lead_time_min: float
    status: str
    acknowledged_at: Optional[datetime.datetime] = None
    resolved_at: Optional[datetime.datetime] = None

    class Config:
        from_attributes = True


class PacketSchema(BaseModel):
    id: int
    timestamp: datetime.datetime
    node_id: int
    node_code: str
    msg_type: int
    raw_hex: str
    byte_length: int
    primary_reading: int
    rate_of_change: int
    battery_mv: int
    health_flags: int
    crc8: int
    is_valid: bool

    class Config:
        from_attributes = True


class SMSLogSchema(BaseModel):
    id: int
    timestamp: datetime.datetime
    alert_id: Optional[int] = None
    recipient_group: str
    recipient_count: int
    phone_preview: str
    message_body: str
    status: str
    channel: str

    class Config:
        from_attributes = True


class SendSMSRequest(BaseModel):
    recipient_group: str = Field(..., description="Target village / wardens / local citizen group")
    phone_numbers: str = Field(..., description="Phone number or masked count preview")
    message_body: str = Field(..., description="Disaster warning or evacuation SMS body")
    hazard_type: str = Field(default="GENERAL_ALERT", description="FLOOD | FIRE | AIR | HEAT | LANDSLIDE | CHEMICAL | WATER")
    recipient_count: Optional[int] = Field(default=1, description="Number of citizen recipients")


class CreateNodeRequest(BaseModel):
    node_code: str = Field(..., description="Unique node identifier, e.g. N6")
    name: str = Field(..., description="Descriptive name or valley location")
    hazard_type: str = Field(default="flood", description="flood | flood+fire | landslide | air | heat | chemical | water")
    latitude: float = Field(..., description="GPS Latitude")
    longitude: float = Field(..., description="GPS Longitude")
    elevation_m: float = Field(default=500.0, description="Elevation in meters")
    river_km: float = Field(default=10.0, description="Distance along river valley from origin km")
    battery_mv: Optional[int] = Field(default=3300, description="Battery voltage mV")
    relay_parent: Optional[str] = Field(default="HUB", description="Parent node in mesh tree")
    hop_count: Optional[int] = Field(default=1, description="Hop count to hub")


class BaselineSchema(BaseModel):
    node_code: str
    metric_name: str
    rolling_mean: float
    rolling_std: float
    sample_count: int
    last_updated: datetime.datetime

    class Config:
        from_attributes = True


class SystemHealthSchema(BaseModel):
    cpu_percent: float
    memory_percent: float
    db_size_kb: float
    total_packets_received: int
    active_alerts_count: int
    nodes_online: int
    simulation_state: str
    speed_multiplier: float
    active_surge: Optional[Dict[str, Any]] = None


class TriggerEventRequest(BaseModel):
    event_type: str = Field(..., description="flood | fire | landslide | chemical | air | heat | water | reset | pause | resume | speed")
    speed_multiplier: Optional[float] = Field(default=None, description="1.0, 2.0, 5.0, 10.0")


class WebSocketMessage(BaseModel):
    type: str
    data: Any
