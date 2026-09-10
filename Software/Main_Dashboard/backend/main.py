import asyncio
import datetime
import os
import psutil
from typing import List, Optional
from contextlib import asynccontextmanager

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Depends, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.encoders import jsonable_encoder
from sqlalchemy.orm import Session

from database import (
    init_db, SessionLocal, NodeModel, ReadingModel, AlertModel,
    PacketModel, SMSLogModel, BaselineStatsModel
)
from models import (
    NodeSchema, ReadingSchema, AlertSchema, PacketSchema,
    SMSLogSchema, BaselineSchema, SystemHealthSchema, TriggerEventRequest,
    SendSMSRequest, CreateNodeRequest
)
from simulator import simulator
from physics_engine import physics_engine

# Database dependency
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# WebSocket Connection Manager
class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast(self, message: dict):
        disconnected = []
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except Exception:
                disconnected.append(connection)
        for dead_conn in disconnected:
            self.disconnect(dead_conn)

manager = ConnectionManager()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize SQLite database with seed data
    init_db()

    # Link simulator broadcaster to active WebSocket connections
    async def forward_broadcast(msg: dict):
        await manager.broadcast(msg)

    simulator.set_broadcast_callback(forward_broadcast)

    # Start simulation task in background
    sim_task = asyncio.create_task(simulator.run_loop())
    print("[EIN HUB] Environmental Intelligence Network Hub initialized on http://localhost:8000")

    yield

    # Teardown
    simulator.is_running = False
    sim_task.cancel()


app = FastAPI(
    title="Environmental Intelligence Network - Central Hub API",
    description="Local Central Hub backend for Himalayan river valley disaster prediction, LoRa mesh ingestion, and physics-based early warning.",
    version="2.0.0",
    lifespan=lifespan
)

# Enable CORS for React frontend (localhost:5173 and any local port)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health_check():
    return {
        "status": "ONLINE",
        "service": "Environmental Intelligence Network Hub",
        "timestamp": datetime.datetime.utcnow().isoformat()
    }


@app.get("/api/nodes", response_model=List[NodeSchema])
def get_all_nodes(db: Session = Depends(get_db)):
    return db.query(NodeModel).order_by(NodeModel.id).all()


@app.post("/api/nodes", response_model=NodeSchema)
async def create_node(req: CreateNodeRequest, db: Session = Depends(get_db)):
    code = req.node_code.strip().upper()
    existing = db.query(NodeModel).filter(NodeModel.node_code == code).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"Node with code '{code}' already exists.")

    battery_mv = req.battery_mv or 3300
    battery_pct = round(max(0.0, min(100.0, (battery_mv - 3000) / (3350 - 3000) * 100)), 1)
    
    new_node = NodeModel(
        node_code=code,
        name=req.name.strip(),
        hazard_type=req.hazard_type,
        latitude=req.latitude,
        longitude=req.longitude,
        elevation_m=req.elevation_m,
        river_km=req.river_km,
        battery_mv=battery_mv,
        battery_pct=battery_pct,
        signal_rssi=-65,
        signal_snr=10.5,
        status="ONLINE",
        relay_parent=req.relay_parent or "HUB",
        hop_count=req.hop_count or 1,
        last_seen=datetime.datetime.utcnow()
    )
    db.add(new_node)
    db.flush()

    # Pre-seed baseline statistics for the new node
    is_landslide = "landslide" in (req.hazard_type or "").lower()
    baselines = [
        BaselineStatsModel(node_code=code, metric_name="turbidity", rolling_mean=0.0 if is_landslide else 18.5, rolling_std=3.2, sample_count=4320),
        BaselineStatsModel(node_code=code, metric_name="turbulence", rolling_mean=0.0 if is_landslide else 12.0, rolling_std=2.4, sample_count=4320),
        BaselineStatsModel(node_code=code, metric_name="water_coverage", rolling_mean=0.0 if is_landslide else 39.0, rolling_std=4.1, sample_count=4320),
        BaselineStatsModel(node_code=code, metric_name="rain_rate", rolling_mean=0.2, rolling_std=0.8, sample_count=4320),
        BaselineStatsModel(node_code=code, metric_name="water_level_m", rolling_mean=0.0 if is_landslide else 2.1, rolling_std=0.35, sample_count=4320),
        BaselineStatsModel(node_code=code, metric_name="tilt_deg", rolling_mean=0.45 if is_landslide else 0.2, rolling_std=0.15, sample_count=4320),
        BaselineStatsModel(node_code=code, metric_name="soil_moisture", rolling_mean=34.0 if is_landslide else 28.0, rolling_std=3.8, sample_count=4320),
        BaselineStatsModel(node_code=code, metric_name="pm25", rolling_mean=22.0, rolling_std=4.5, sample_count=4320),
        BaselineStatsModel(node_code=code, metric_name="aqi", rolling_mean=45.0, rolling_std=8.0, sample_count=4320),
        BaselineStatsModel(node_code=code, metric_name="temperature_c", rolling_mean=22.0, rolling_std=3.5, sample_count=4320),
        BaselineStatsModel(node_code=code, metric_name="heat_index_c", rolling_mean=24.0, rolling_std=4.0, sample_count=4320),
        BaselineStatsModel(node_code=code, metric_name="gas_voc_ppm", rolling_mean=16.5, rolling_std=2.9, sample_count=4320),
        BaselineStatsModel(node_code=code, metric_name="chemical_leak_ppm", rolling_mean=0.0, rolling_std=0.5, sample_count=4320),
        BaselineStatsModel(node_code=code, metric_name="water_ph", rolling_mean=7.4, rolling_std=0.25, sample_count=4320),
        BaselineStatsModel(node_code=code, metric_name="water_tds_ppm", rolling_mean=145.0, rolling_std=18.0, sample_count=4320),
        BaselineStatsModel(node_code=code, metric_name="smoke_density_pct", rolling_mean=8.0, rolling_std=2.0, sample_count=4320),
    ]
    db.add_all(baselines)

    # Initial Reading
    now = datetime.datetime.utcnow()
    initial_reading = ReadingModel(
        node_id=new_node.id,
        timestamp=now,
        turbidity=0.0 if is_landslide else 18.5,
        turbulence=0.0 if is_landslide else 12.0,
        water_coverage=0.0 if is_landslide else 39.0,
        rain_rate=0.0,
        water_level_m=0.0 if is_landslide else 2.1,
        flame_detected=False,
        smoke_density_pct=8.0,
        pm25=22.0,
        pm10=45.0,
        aqi=42,
        temperature_c=22.0,
        humidity_pct=60.0,
        heat_index_c=24.0,
        accel_x=0.0,
        accel_y=0.0,
        accel_z=1.0,
        tilt_deg=0.45 if is_landslide else 0.2,
        soil_moisture=34.0 if is_landslide else 28.0,
        geophone_peak_v=0.03,
        gas_voc_ppm=16.5,
        chemical_leak_ppm=0.0,
        water_ph=7.4,
        water_tds_ppm=145.0,
        water_do_mg_l=8.2,
        turbidity_z=0.0,
        turbidity_roc=0.0,
        water_coverage_z=0.0,
        water_coverage_roc=0.0,
        battery_mv=battery_mv,
        flags=0x06
    )
    db.add(initial_reading)

    # Register in in-memory simulator and physics engine
    simulator.node_states[code] = {
        "turbidity": 0.0 if is_landslide else 18.5,
        "turbulence": 0.0 if is_landslide else 12.0,
        "water_coverage": 0.0 if is_landslide else 39.0,
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
        "tilt_deg": 0.45 if is_landslide else 0.2,
        "soil_moisture": 34.0 if is_landslide else 28.0,
        "geophone_peak_v": 0.03,
        "gas_voc_ppm": 16.5,
        "chemical_leak_ppm": 0.0,
        "water_ph": 7.4,
        "water_tds_ppm": 145.0,
        "water_do_mg_l": 8.2,
        "battery_mv": battery_mv,
        "battery_pct": battery_pct
    }
    physics_engine.NODE_RIVER_KM[code] = req.river_km

    db.commit()
    db.refresh(new_node)

    # Broadcast new node to all connected clients
    node_dict = NodeSchema.from_orm(new_node).dict()
    await manager.broadcast({
        "type": "NEW_NODE",
        "node": jsonable_encoder(node_dict)
    })

    return new_node


@app.get("/api/nodes/{node_id}", response_model=NodeSchema)
def get_node_by_id(node_id: int, db: Session = Depends(get_db)):
    node = db.query(NodeModel).filter(NodeModel.id == node_id).first()
    if not node:
        raise HTTPException(status_code=404, detail="Node not found")
    return node


@app.get("/api/readings", response_model=List[ReadingSchema])
def get_recent_readings(
    node_code: Optional[str] = None,
    limit: int = Query(default=150, le=1000),
    db: Session = Depends(get_db)
):
    query = db.query(ReadingModel).join(NodeModel)
    if node_code:
        query = query.filter(NodeModel.node_code == node_code)
    return query.order_by(ReadingModel.timestamp.desc()).limit(limit).all()[::-1]


@app.get("/api/alerts", response_model=List[AlertSchema])
def get_alerts(
    status: Optional[str] = None,
    limit: int = Query(default=50, le=200),
    db: Session = Depends(get_db)
):
    query = db.query(AlertModel)
    if status:
        query = query.filter(AlertModel.status == status)
    return query.order_by(AlertModel.timestamp.desc()).limit(limit).all()


@app.post("/api/alerts/{alert_id}/ack")
def acknowledge_alert(alert_id: int, db: Session = Depends(get_db)):
    alert = db.query(AlertModel).filter(AlertModel.id == alert_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    alert.status = "ACKNOWLEDGED"
    alert.acknowledged_at = datetime.datetime.utcnow()
    db.commit()
    return {"status": "ACKNOWLEDGED", "alert_id": alert_id}


@app.post("/api/alerts/{alert_id}/resolve")
def resolve_alert(alert_id: int, db: Session = Depends(get_db)):
    alert = db.query(AlertModel).filter(AlertModel.id == alert_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    alert.status = "RESOLVED"
    alert.resolved_at = datetime.datetime.utcnow()
    db.commit()
    return {"status": "RESOLVED", "alert_id": alert_id}


@app.get("/api/packets", response_model=List[PacketSchema])
def get_recent_packets(limit: int = Query(default=50, le=200), db: Session = Depends(get_db)):
    return db.query(PacketModel).order_by(PacketModel.timestamp.desc()).limit(limit).all()


@app.get("/api/sms", response_model=List[SMSLogSchema])
def get_sms_logs(limit: int = Query(default=50, le=200), db: Session = Depends(get_db)):
    return db.query(SMSLogModel).order_by(SMSLogModel.timestamp.desc()).limit(limit).all()


@app.get("/api/baselines", response_model=List[BaselineSchema])
def get_baselines(node_code: Optional[str] = None, db: Session = Depends(get_db)):
    query = db.query(BaselineStatsModel)
    if node_code:
        query = query.filter(BaselineStatsModel.node_code == node_code)
    return query.all()


@app.get("/api/system/health", response_model=SystemHealthSchema)
def get_system_health(db: Session = Depends(get_db)):
    host_cpu = psutil.cpu_percent() if hasattr(psutil, "cpu_percent") else 12.5
    host_mem = psutil.virtual_memory().percent if hasattr(psutil, "virtual_memory") else 44.0

    db_path = db.bind.url.database
    db_size_kb = os.path.getsize(db_path) / 1024.0 if os.path.exists(db_path) else 0.0

    active_alerts = db.query(AlertModel).filter(AlertModel.status != "RESOLVED").count()
    total_packets = db.query(PacketModel).count()
    online_nodes = db.query(NodeModel).filter(NodeModel.status != "OFFLINE").count()

    return {
        "cpu_percent": round(host_cpu, 1),
        "memory_percent": round(host_mem, 1),
        "db_size_kb": round(db_size_kb, 1),
        "total_packets_received": total_packets,
        "active_alerts_count": active_alerts,
        "nodes_online": online_nodes,
        "simulation_state": simulator.active_event or "IDLE_MONITORING",
        "speed_multiplier": simulator.speed_multiplier,
        "active_surge": physics_engine.active_surge
    }


@app.get("/api/correlation")
def get_correlation_analytics():
    return {
        "correlation_n1_n2": physics_engine.compute_cross_correlation("N1", "N2", "turbidity"),
        "correlation_n1_n3": physics_engine.compute_cross_correlation("N1", "N3", "turbidity"),
        "correlation_n1_n5": physics_engine.compute_cross_correlation("N1", "N5", "turbidity"),
        "travel_time_n1_n2": physics_engine.calculate_travel_time("N1", "N2"),
        "travel_time_n1_n3": physics_engine.calculate_travel_time("N1", "N3"),
        "travel_time_n1_n5": physics_engine.calculate_travel_time("N1", "N5"),
        "active_surge": physics_engine.active_surge
    }


@app.post("/api/sms/send", response_model=SMSLogSchema)
async def send_citizen_sms(req: SendSMSRequest, db: Session = Depends(get_db)):
    """
    Dispatches an emergency warning / evacuation SMS to local community groups,
    civic wardens, or SDRF units via the laptop's simulated GSM/cellular edge gateway.
    """
    now = datetime.datetime.utcnow()
    
    # Calculate recipient count based on group or provided count
    group_counts = {
        "Devprayag Riverside Residents": 640,
        "Rishikesh Pilgrims & Ghat Dwellers": 1250,
        "Narendra Nagar Slope Settlements": 420,
        "Shivpuri Adventure & Rafting Camps": 310,
        "Uttarakhand SDRF & District Disaster Control": 25,
        "All Riverbank Community Wards": 2645
    }
    count = req.recipient_count if req.recipient_count and req.recipient_count > 1 else group_counts.get(req.recipient_group, 540)
    
    phone_preview = req.phone_numbers if req.phone_numbers and "+" in req.phone_numbers else f"+91 98112-XXXXX (+{count-1} citizens)"
    
    sms_obj = SMSLogModel(
        timestamp=now,
        alert_id=None,
        recipient_group=req.recipient_group,
        recipient_count=count,
        phone_preview=phone_preview,
        message_body=req.message_body,
        status="SENT",
        channel="GSM_LORA_GATEWAY"
    )
    db.add(sms_obj)
    db.commit()
    db.refresh(sms_obj)

    # Broadcast to frontend dashboard over WebSocket
    await manager.broadcast({
        "type": "NEW_SMS",
        "sms": {
            "id": sms_obj.id,
            "timestamp": sms_obj.timestamp.isoformat(),
            "recipient_group": sms_obj.recipient_group,
            "recipient_count": sms_obj.recipient_count,
            "phone_preview": sms_obj.phone_preview,
            "message_body": sms_obj.message_body,
            "status": sms_obj.status,
            "channel": sms_obj.channel
        }
    })

    return sms_obj


@app.post("/api/simulate/event")
def trigger_simulation_event(req: TriggerEventRequest):
    evt = req.event_type.lower()
    if evt in ["flood", "flash_flood"]:
        simulator.trigger_flood_event(speed=req.speed_multiplier)
        return {"status": "SUCCESS", "event": "FLOOD_SURGE_TRIGGERED", "speed": simulator.speed_multiplier}
    elif evt in ["fire", "forest_fire"]:
        simulator.trigger_fire_event(speed=req.speed_multiplier)
        return {"status": "SUCCESS", "event": "FOREST_FIRE_TRIGGERED", "speed": simulator.speed_multiplier}
    elif evt in ["air", "air_pollution", "smog"]:
        simulator.trigger_air_hazard_event(speed=req.speed_multiplier)
        return {"status": "SUCCESS", "event": "AIR_POLLUTION_TRIGGERED", "speed": simulator.speed_multiplier}
    elif evt in ["heat", "heatwave", "extreme_heat"]:
        simulator.trigger_heat_wave_event(speed=req.speed_multiplier)
        return {"status": "SUCCESS", "event": "EXTREME_HEAT_TRIGGERED", "speed": simulator.speed_multiplier}
    elif evt in ["landslide", "slope_instability"]:
        simulator.trigger_landslide_event(speed=req.speed_multiplier)
        return {"status": "SUCCESS", "event": "LANDSLIDE_TRIGGERED", "speed": simulator.speed_multiplier}
    elif evt in ["chemical", "chemical_leak", "industrial_emission"]:
        simulator.trigger_chemical_leak_event(speed=req.speed_multiplier)
        return {"status": "SUCCESS", "event": "CHEMICAL_LEAK_TRIGGERED", "speed": simulator.speed_multiplier}
    elif evt in ["water", "water_quality", "water_pollution"]:
        simulator.trigger_water_pollution_event(speed=req.speed_multiplier)
        return {"status": "SUCCESS", "event": "WATER_POLLUTION_TRIGGERED", "speed": simulator.speed_multiplier}
    elif evt == "reset":
        simulator.reset_simulation()
        return {"status": "SUCCESS", "event": "RESET_COMPLETED"}
    elif evt == "pause":
        simulator.pause()
        return {"status": "SUCCESS", "event": "SIMULATION_PAUSED"}
    elif evt == "resume":
        simulator.resume()
        return {"status": "SUCCESS", "event": "SIMULATION_RESUMED"}
    elif evt == "speed" and req.speed_multiplier:
        simulator.set_speed(req.speed_multiplier)
        return {"status": "SUCCESS", "speed": simulator.speed_multiplier}
    else:
        raise HTTPException(status_code=400, detail=f"Invalid event type: {req.event_type}")


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        # Send initial full state upon connection
        db = SessionLocal()
        try:
            nodes = [NodeSchema.from_orm(n).dict() for n in db.query(NodeModel).all()]
            recent_alerts = [AlertSchema.from_orm(a).dict() for a in db.query(AlertModel).order_by(AlertModel.timestamp.desc()).limit(10).all()]
            recent_packets = [PacketSchema.from_orm(p).dict() for p in db.query(PacketModel).order_by(PacketModel.timestamp.desc()).limit(15).all()]
            recent_sms = [SMSLogSchema.from_orm(s).dict() for s in db.query(SMSLogModel).order_by(SMSLogModel.timestamp.desc()).limit(10).all()]
            
            initial_payload = jsonable_encoder({
                "type": "INITIAL_STATE",
                "nodes": nodes,
                "recent_alerts": recent_alerts,
                "recent_packets": recent_packets,
                "recent_sms": recent_sms,
                "active_surge": physics_engine.active_surge,
                "simulation_state": simulator.active_event or "IDLE_MONITORING",
                "speed_multiplier": simulator.speed_multiplier
            })
            await websocket.send_json(initial_payload)
        finally:
            db.close()

        # Keep listening for client commands (e.g. trigger event from UI over WS)
        while True:
            data = await websocket.receive_json()
            if "action" in data:
                action = data["action"]
                speed = data.get("speed")
                if action == "TRIGGER_FLOOD":
                    simulator.trigger_flood_event(speed=speed)
                elif action == "TRIGGER_FIRE":
                    simulator.trigger_fire_event(speed=speed)
                elif action == "TRIGGER_AIR":
                    simulator.trigger_air_hazard_event(speed=speed)
                elif action == "TRIGGER_HEAT":
                    simulator.trigger_heat_wave_event(speed=speed)
                elif action == "TRIGGER_LANDSLIDE":
                    simulator.trigger_landslide_event(speed=speed)
                elif action == "TRIGGER_CHEMICAL":
                    simulator.trigger_chemical_leak_event(speed=speed)
                elif action == "TRIGGER_WATER":
                    simulator.trigger_water_pollution_event(speed=speed)
                elif action == "RESET":
                    simulator.reset_simulation()
                elif action == "PAUSE":
                    simulator.pause()
                elif action == "RESUME":
                    simulator.resume()
                elif action == "SET_SPEED":
                    simulator.set_speed(float(data.get("speed", 1.0)))

    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception as e:
        print(f"[WS ERROR] {e}")
        manager.disconnect(websocket)
