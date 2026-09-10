import os
import datetime
from sqlalchemy import create_engine, Column, Integer, Float, String, Boolean, DateTime, Text, ForeignKey
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship

DB_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(DB_DIR, "ein_hub.db")
DATABASE_URL = f"sqlite:///{DB_PATH}"

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

class NodeModel(Base):
    __tablename__ = "nodes"

    id = Column(Integer, primary_key=True, index=True)
    node_code = Column(String(16), unique=True, index=True)  # N1, N2, N3, N4, N5, HUB
    name = Column(String(64))
    hazard_type = Column(String(32))  # flood, flood+fire, landslide, hub
    latitude = Column(Float)
    longitude = Column(Float)
    elevation_m = Column(Float)
    river_km = Column(Float, default=0.0)  # Distance along river valley from N1
    battery_mv = Column(Integer, default=3300)
    battery_pct = Column(Float, default=100.0)
    signal_rssi = Column(Integer, default=-65)  # dBm
    signal_snr = Column(Float, default=9.5)     # dB
    status = Column(String(16), default="ONLINE")  # ONLINE, WARNING, ALERT, OFFLINE
    relay_parent = Column(String(16), default="HUB")
    hop_count = Column(Integer, default=1)
    last_seen = Column(DateTime, default=datetime.datetime.utcnow)

    readings = relationship("ReadingModel", back_populates="node", cascade="all, delete-orphan")
    alerts = relationship("AlertModel", back_populates="node", cascade="all, delete-orphan")
    packets = relationship("PacketModel", back_populates="node", cascade="all, delete-orphan")


class ReadingModel(Base):
    __tablename__ = "readings"

    id = Column(Integer, primary_key=True, index=True)
    node_id = Column(Integer, ForeignKey("nodes.id"), index=True)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow, index=True)
    
    # 1. Rising Water Levels & Flash Flooding
    turbidity = Column(Float, default=15.0)       # 0-100 sediment index
    turbulence = Column(Float, default=12.0)      # 0-100 optical flow agitation
    water_coverage = Column(Float, default=38.0)  # 0-100% riverbed width fill
    rain_rate = Column(Float, default=0.0)        # mm/hr
    water_level_m = Column(Float, default=2.1)    # meters ultrasonic river gauge
    
    # 2. Forest Fires & Smoke Events
    flame_detected = Column(Boolean, default=False)
    smoke_density_pct = Column(Float, default=8.0) # 0-100% optical smoke obscuration
    
    # 3. Hazardous Air Pollution
    pm25 = Column(Float, default=22.0)            # ug/m3 PM2.5 particulate
    pm10 = Column(Float, default=45.0)            # ug/m3 PM10 particulate
    aqi = Column(Integer, default=42)             # Air Quality Index (0-500)
    
    # 4. Extreme Heat Conditions
    temperature_c = Column(Float, default=21.5)   # Ambient dry-bulb °C
    humidity_pct = Column(Float, default=62.0)    # Relative humidity %
    heat_index_c = Column(Float, default=24.5)    # Apparent thermal stress °C
    
    # 5. Landslide Precursors
    accel_x = Column(Float, default=0.0)
    accel_y = Column(Float, default=0.0)
    accel_z = Column(Float, default=1.0)
    tilt_deg = Column(Float, default=0.5)         # MPU6050 pitch/roll degrees
    soil_moisture = Column(Float, default=32.0)   # 0-100% capacitive moisture
    geophone_peak_v = Column(Float, default=0.05) # Peak analog geophone vibration V
    
    # 6. Industrial Emissions & Chemical Leaks
    gas_voc_ppm = Column(Float, default=18.0)     # Total VOC ppm
    chemical_leak_ppm = Column(Float, default=0.0)# Toxic leak ppm (NH3, H2S, Cl2)
    
    # 7. Water Quality Degradation
    water_ph = Column(Float, default=7.4)         # Acidity / Basicity (0-14)
    water_tds_ppm = Column(Float, default=145.0)  # Total Dissolved Solids ppm
    water_do_mg_l = Column(Float, default=8.2)    # Dissolved Oxygen mg/L
    
    # Derived statistical values at recording time
    turbidity_z = Column(Float, default=0.0)
    turbidity_roc = Column(Float, default=0.0)    # Rate of change per min
    water_coverage_z = Column(Float, default=0.0)
    water_coverage_roc = Column(Float, default=0.0)

    # Health & Radio
    battery_mv = Column(Integer, default=3300)
    flags = Column(Integer, default=6)            # Bitmask (0x02 Solar OK, 0x04 Radar Valid)

    node = relationship("NodeModel", back_populates="readings")


class BaselineStatsModel(Base):
    __tablename__ = "baseline_stats"

    id = Column(Integer, primary_key=True, index=True)
    node_code = Column(String(16), index=True)
    metric_name = Column(String(32), index=True)
    rolling_mean = Column(Float, default=20.0)
    rolling_std = Column(Float, default=3.5)
    sample_count = Column(Integer, default=5000)
    last_updated = Column(DateTime, default=datetime.datetime.utcnow)


class AlertModel(Base):
    __tablename__ = "alerts"

    id = Column(Integer, primary_key=True, index=True)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow, index=True)
    node_id = Column(Integer, ForeignKey("nodes.id"), index=True)
    node_code = Column(String(16))
    severity = Column(String(16), default="WARNING")  # INFO, WARNING, CRITICAL
    hazard_type = Column(String(32))                  # FLOOD, LANDSLIDE, WILDFIRE, HARDWARE
    message = Column(String(255))
    trigger_rule = Column(String(255))               # e.g. "Turbidity Z-Score 3.84 > 3.0"
    z_score = Column(Float, default=0.0)
    rate_of_change = Column(Float, default=0.0)
    propagation_stage = Column(String(32), default="LOCAL") # LOCAL, PROPAGATING, CONFIRMED
    lead_time_min = Column(Float, default=0.0)
    status = Column(String(16), default="NEW")        # NEW, ACKNOWLEDGED, RESOLVED
    acknowledged_at = Column(DateTime, nullable=True)
    resolved_at = Column(DateTime, nullable=True)

    node = relationship("NodeModel", back_populates="alerts")


class PacketModel(Base):
    __tablename__ = "packets"

    id = Column(Integer, primary_key=True, index=True)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow, index=True)
    node_id = Column(Integer, ForeignKey("nodes.id"), index=True)
    node_code = Column(String(16))
    msg_type = Column(Integer, default=1)           # 0x01 Routine, 0x02 Anomaly, 0x03 Battery, 0x04 Heartbeat
    raw_hex = Column(String(32))                    # 14 bytes = 28 hex chars
    byte_length = Column(Integer, default=14)
    primary_reading = Column(Integer, default=0)
    rate_of_change = Column(Integer, default=0)
    battery_mv = Column(Integer, default=3300)
    health_flags = Column(Integer, default=0)
    crc8 = Column(Integer, default=0)
    is_valid = Column(Boolean, default=True)

    node = relationship("NodeModel", back_populates="packets")


class SMSLogModel(Base):
    __tablename__ = "sms_log"

    id = Column(Integer, primary_key=True, index=True)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow, index=True)
    alert_id = Column(Integer, nullable=True)
    recipient_group = Column(String(64))  # e.g. "Devprayag SDRF & Village Wardens"
    recipient_count = Column(Integer, default=1)
    phone_preview = Column(String(128))   # "+91 98765-XXXXX (+41 others)"
    message_body = Column(Text)
    status = Column(String(16), default="SENT")  # QUEUED, SENT, CONFIRMED, FAILED
    channel = Column(String(32), default="GSM_LORA_GATEWAY")


def init_db():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        # Check if nodes exist
        if db.query(NodeModel).count() == 0:
            seed_nodes = [
                NodeModel(
                    id=1,
                    node_code="N1",
                    name="Upstream Gauge",
                    hazard_type="flood",
                    latitude=30.1450,
                    longitude=78.2100,
                    elevation_m=840.0,
                    river_km=0.0,
                    battery_mv=3310,
                    battery_pct=98.5,
                    signal_rssi=-72,
                    signal_snr=9.2,
                    status="ONLINE",
                    relay_parent="N2",
                    hop_count=3,
                    last_seen=datetime.datetime.utcnow()
                ),
                NodeModel(
                    id=2,
                    node_code="N2",
                    name="Devprayag Confluence",
                    hazard_type="flood",
                    latitude=30.1100,
                    longitude=78.2400,
                    elevation_m=620.0,
                    river_km=4.8,
                    battery_mv=3320,
                    battery_pct=99.0,
                    signal_rssi=-68,
                    signal_snr=10.1,
                    status="ONLINE",
                    relay_parent="N3",
                    hop_count=2,
                    last_seen=datetime.datetime.utcnow()
                ),
                NodeModel(
                    id=3,
                    node_code="N3",
                    name="Rishikesh Riverfront",
                    hazard_type="flood+fire",
                    latitude=30.0869,
                    longitude=78.2676,
                    elevation_m=372.0,
                    river_km=9.2,
                    battery_mv=3295,
                    battery_pct=95.0,
                    signal_rssi=-54,
                    signal_snr=12.4,
                    status="ONLINE",
                    relay_parent="HUB",
                    hop_count=1,
                    last_seen=datetime.datetime.utcnow()
                ),
                NodeModel(
                    id=4,
                    node_code="N4",
                    name="Narendra Nagar Ridge",
                    hazard_type="landslide",
                    latitude=30.0500,
                    longitude=78.3000,
                    elevation_m=1120.0,
                    river_km=13.5,
                    battery_mv=3305,
                    battery_pct=97.0,
                    signal_rssi=-65,
                    signal_snr=11.0,
                    status="ONLINE",
                    relay_parent="N3",
                    hop_count=2,
                    last_seen=datetime.datetime.utcnow()
                ),
                NodeModel(
                    id=5,
                    node_code="N5",
                    name="Downstream Plain",
                    hazard_type="flood",
                    latitude=29.9800,
                    longitude=78.3500,
                    elevation_m=285.0,
                    river_km=18.5,
                    battery_mv=3315,
                    battery_pct=98.0,
                    signal_rssi=-78,
                    signal_snr=8.5,
                    status="ONLINE",
                    relay_parent="HUB",
                    hop_count=1,
                    last_seen=datetime.datetime.utcnow()
                ),
                NodeModel(
                    id=6,
                    node_code="HUB",
                    name="Laptop Hub Base Station",
                    hazard_type="hub",
                    latitude=30.0869,
                    longitude=78.2676,
                    elevation_m=372.0,
                    river_km=9.2,
                    battery_mv=3400,
                    battery_pct=100.0,
                    signal_rssi=-30,
                    signal_snr=15.0,
                    status="ONLINE",
                    relay_parent="LOCAL",
                    hop_count=0,
                    last_seen=datetime.datetime.utcnow()
                )
            ]
            db.add_all(seed_nodes)

            # Pre-seed baseline statistics for all nodes
            for n in seed_nodes:
                if n.node_code == "HUB":
                    continue
                db.add_all([
                    BaselineStatsModel(node_code=n.node_code, metric_name="turbidity", rolling_mean=18.5, rolling_std=3.2, sample_count=4320),
                    BaselineStatsModel(node_code=n.node_code, metric_name="turbulence", rolling_mean=12.0, rolling_std=2.4, sample_count=4320),
                    BaselineStatsModel(node_code=n.node_code, metric_name="water_coverage", rolling_mean=39.0, rolling_std=4.1, sample_count=4320),
                    BaselineStatsModel(node_code=n.node_code, metric_name="rain_rate", rolling_mean=0.2, rolling_std=0.8, sample_count=4320),
                    BaselineStatsModel(node_code=n.node_code, metric_name="water_level_m", rolling_mean=2.1, rolling_std=0.35, sample_count=4320),
                    BaselineStatsModel(node_code=n.node_code, metric_name="tilt_deg", rolling_mean=0.45, rolling_std=0.15, sample_count=4320),
                    BaselineStatsModel(node_code=n.node_code, metric_name="soil_moisture", rolling_mean=34.0, rolling_std=3.8, sample_count=4320),
                    BaselineStatsModel(node_code=n.node_code, metric_name="pm25", rolling_mean=22.0, rolling_std=4.5, sample_count=4320),
                    BaselineStatsModel(node_code=n.node_code, metric_name="aqi", rolling_mean=45.0, rolling_std=8.0, sample_count=4320),
                    BaselineStatsModel(node_code=n.node_code, metric_name="temperature_c", rolling_mean=22.0, rolling_std=3.5, sample_count=4320),
                    BaselineStatsModel(node_code=n.node_code, metric_name="heat_index_c", rolling_mean=24.0, rolling_std=4.0, sample_count=4320),
                    BaselineStatsModel(node_code=n.node_code, metric_name="gas_voc_ppm", rolling_mean=16.5, rolling_std=2.9, sample_count=4320),
                    BaselineStatsModel(node_code=n.node_code, metric_name="chemical_leak_ppm", rolling_mean=0.0, rolling_std=0.5, sample_count=4320),
                    BaselineStatsModel(node_code=n.node_code, metric_name="water_ph", rolling_mean=7.4, rolling_std=0.25, sample_count=4320),
                    BaselineStatsModel(node_code=n.node_code, metric_name="water_tds_ppm", rolling_mean=145.0, rolling_std=18.0, sample_count=4320),
                    BaselineStatsModel(node_code=n.node_code, metric_name="smoke_density_pct", rolling_mean=8.0, rolling_std=2.0, sample_count=4320),
                ])
            db.commit()
    finally:
        db.close()
