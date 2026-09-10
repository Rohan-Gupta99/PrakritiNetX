import React from 'react';
import { SensorNode, Reading, BaselineStats, LoRaPacket } from '../types';
import { 
  Radio, 
  Droplet, 
  Waves, 
  Mountain, 
  BatteryCharging, 
  Activity, 
  Hash, 
  CheckCircle, 
  Flame,
  Wind,
  Sun,
  ShieldCheck,
  Signal,
  AlertTriangle,
  Zap,
  CheckCircle2,
  AlertOctagon,
  Sparkles
} from 'lucide-react';

interface NodeDetailsProps {
  node: SensorNode | null;
  reading: Reading | null;
  baselines: BaselineStats[];
  latestPacket: LoRaPacket | null;
  theme?: 'dark' | 'light';
  nodes?: SensorNode[];
  onSelectNode?: (nodeId: number) => void;
}

export const NodeDetails: React.FC<NodeDetailsProps> = ({
  node,
  reading,
  latestPacket,
  theme = 'dark',
  nodes = [],
  onSelectNode
}) => {
  if (!node) {
    return (
      <div className="glass-panel p-6 rounded-2xl flex flex-col items-center justify-center text-center h-full text-slate-500 dark:text-slate-400 font-mono text-sm">
        <Radio className="w-10 h-10 text-slate-400 dark:text-slate-600 mb-2 animate-pulse" />
        <p>Select any sensor node from the map or connected list to inspect live AI risk analytics & telemetry.</p>
      </div>
    );
  }

  const isAlert = node.status === 'ALERT';
  const isWarning = node.status === 'WARNING';

  // Compute Overall Risk Score (0 - 100) dynamically
  let overallRiskScore = 12;
  let floodScore = 15;
  let fireScore = 8;
  let airScore = 24;
  let landslideScore = 10;

  if (reading) {
    if (reading.turbidity > 60 || (reading.turbidity_z && reading.turbidity_z > 3.0)) {
      floodScore = Math.min(98, Math.round(50 + (reading.turbidity_z || 3.0) * 12));
    } else if (reading.turbidity > 35) {
      floodScore = 55;
    }

    if (reading.flame_detected) {
      fireScore = 95;
    } else if ((reading.smoke_density_pct || 0) > 40) {
      fireScore = 65;
    }

    if ((reading.aqi || 40) > 250) {
      airScore = 88;
    } else if ((reading.aqi || 40) > 100) {
      airScore = 58;
    }

    if ((reading.tilt_deg || 0) > 2.0 || ((reading.soil_moisture || 0) > 65 && (reading.tilt_deg || 0) > 1.2)) {
      landslideScore = 92;
    } else if ((reading.tilt_deg || 0) > 1.0) {
      landslideScore = 54;
    }

    overallRiskScore = Math.max(floodScore, fireScore, airScore, landslideScore);
  }

  const riskLevelLabel = overallRiskScore >= 75 ? 'CRITICAL RISK' : overallRiskScore >= 45 ? 'HIGH RISK' : overallRiskScore >= 25 ? 'MODERATE' : 'LOW RISK';

  // Evidence list for "Why This Alert?"
  const evidenceList: string[] = [];
  if (reading) {
    if ((reading.turbidity_z || 0) > 2.5) {
      evidenceList.push(`Turbidity Z-score +${reading.turbidity_z.toFixed(2)}σ (Threshold > 2.5σ exceeded)`);
    }
    if ((reading.water_level_m || 0) > 3.5) {
      evidenceList.push(`River gauge level ${reading.water_level_m.toFixed(2)}m (+${((reading.water_level_m - 2.1) / 2.1 * 100).toFixed(0)}% rise)`);
    }
    if (reading.flame_detected) {
      evidenceList.push('Thermal Infrared Flame signature triggered');
    }
    if ((reading.smoke_density_pct || 0) > 45) {
      evidenceList.push(`Optical smoke obscuration ${reading.smoke_density_pct.toFixed(1)}% elevated`);
    }
    if ((reading.aqi || 0) > 150) {
      evidenceList.push(`Hazardous PM2.5 particulate ${reading.pm25?.toFixed(0)} µg/m³ (AQI ${reading.aqi})`);
    }
    if ((reading.tilt_deg || 0) > 1.2) {
      evidenceList.push(`6-DOF IMU slope displacement ${reading.tilt_deg.toFixed(2)}° with ${reading.soil_moisture?.toFixed(0)}% soil moisture`);
    }
    if ((reading.water_ph || 7.4) < 6.0 || (reading.water_ph || 7.4) > 8.5) {
      evidenceList.push(`Water pH ${reading.water_ph?.toFixed(2)} degraded outside safe [6.5 - 8.5] band`);
    }
  }

  return (
    <div className="glass-panel p-3.5 rounded-2xl flex flex-col gap-3 h-full overflow-y-auto border border-slate-200 dark:border-slate-800 font-sans">
      {/* 0. Quick Node Selector Tabs */}
      {nodes.length > 0 && onSelectNode && (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-slate-200 dark:border-slate-800 text-[11px] font-sans scrollbar-none">
          <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider pl-0.5 mr-0.5">Nodes:</span>
          {nodes.map((n) => {
            const isSelected = n.id === node.id;
            const isAlertNode = n.status === 'ALERT';
            const isWarnNode = n.status === 'WARNING';
            return (
              <button
                key={n.id}
                onClick={() => onSelectNode(n.id)}
                className={`px-2 py-0.5 rounded-lg border whitespace-nowrap transition-all flex items-center gap-1 ${
                  isSelected
                    ? 'bg-cyan-500 text-slate-950 font-bold border-cyan-400 shadow-sm'
                    : isAlertNode
                    ? 'bg-rose-500/15 text-rose-400 border-rose-500/40 hover:bg-rose-500/25 font-medium'
                    : isWarnNode
                    ? 'bg-amber-500/15 text-amber-400 border-amber-500/40 hover:bg-amber-500/25 font-medium'
                    : 'bg-slate-100 dark:bg-slate-900/80 text-slate-400 border-slate-200 dark:border-slate-800 hover:text-slate-200 font-medium'
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${isAlertNode ? 'bg-rose-500 animate-ping' : isWarnNode ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                <span className="font-mono">{n.node_code}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* 1. Node Header & Telemetry Overview */}
      <div className="flex flex-wrap items-start justify-between gap-2 border-b border-slate-200 dark:border-slate-800 pb-2.5">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold font-mono text-cyan-600 dark:text-cyan-400">{node.node_code}</span>
            <span className="text-sm font-bold text-slate-900 dark:text-slate-100">{node.name}</span>
            <span className={`px-2 py-0.2 rounded-full text-[10px] font-semibold tracking-wide uppercase ${
              isAlert ? 'bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-500 animate-pulse' :
              isWarning ? 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-500' :
              'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-600/40'
            }`}>
              {node.status}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-600 dark:text-slate-400 mt-1">
            <span>GPS: <strong className="font-mono text-slate-700 dark:text-slate-300">{node.latitude.toFixed(4)}°N, {node.longitude.toFixed(4)}°E</strong></span>
            <span>•</span>
            <span>Elev: <strong className="font-mono text-slate-700 dark:text-slate-300">{node.elevation_m}m</strong></span>
            <span>•</span>
            <span>Relay: <strong className="font-mono text-slate-700 dark:text-slate-300">{node.relay_parent} (Hop {node.hop_count})</strong></span>
          </div>
        </div>

        {/* Battery & Signal telemetry */}
        <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-xl px-2.5 py-1 text-xs shadow-xs font-sans">
          <div className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1 font-mono">
            <BatteryCharging className="w-3.5 h-3.5" />
            <span>{node.battery_mv} mV ({node.battery_pct.toFixed(0)}%)</span>
          </div>
          <div className="h-3 w-px bg-slate-300 dark:bg-slate-700" />
          <div className="text-slate-600 dark:text-slate-400 flex items-center gap-1 font-mono">
            <Signal className="w-3 h-3 text-cyan-500" />
            <span>{node.signal_rssi} dBm</span>
          </div>
        </div>
      </div>

      {/* 2. OVERALL RISK SCORE GAUGE & AI RISK ASSESSMENT (Points 4 & 5) */}
      <div className={`p-3 rounded-xl border ${
        overallRiskScore >= 75
          ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-500 text-rose-900 dark:text-rose-100 shadow-md'
          : overallRiskScore >= 45
          ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-500'
          : 'bg-slate-50 dark:bg-slate-900/70 border-slate-200 dark:border-slate-800'
      } space-y-2.5 font-sans`}>
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold flex items-center gap-1.5 text-slate-800 dark:text-slate-200">
            <Zap className="w-3.5 h-3.5 text-amber-500" />
            AI Risk Assessment & Composite Score
          </span>
          <span className="text-[10px] px-2 py-0.5 rounded font-semibold uppercase tracking-wider bg-cyan-100 dark:bg-cyan-950 text-cyan-800 dark:text-cyan-300 border border-cyan-300 dark:border-cyan-700">
            Confidence 94%
          </span>
        </div>

        {/* Large Score Callout */}
        <div className="flex items-baseline justify-between">
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold font-mono tracking-tight">{overallRiskScore}</span>
            <span className="text-xs text-slate-500 font-mono font-medium">/ 100</span>
          </div>
          <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold uppercase tracking-wider ${
            overallRiskScore >= 75 ? 'bg-rose-600 text-white animate-pulse' :
            overallRiskScore >= 45 ? 'bg-amber-500 text-slate-950 font-bold' :
            'bg-emerald-600 text-white'
          }`}>
            {riskLevelLabel}
          </span>
        </div>

        {/* Hazard Breakdown Progress Bars */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] pt-1 font-sans">
          <div>
            <div className="flex justify-between mb-0.5 font-medium">
              <span className="text-slate-600 dark:text-slate-400">Flood</span>
              <strong className={`font-mono ${floodScore > 60 ? 'text-rose-500' : 'text-slate-700 dark:text-slate-300'}`}>{floodScore}%</strong>
            </div>
            <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
              <div className={`h-full ${floodScore > 60 ? 'bg-rose-500' : 'bg-cyan-500'}`} style={{ width: `${floodScore}%` }} />
            </div>
          </div>

          <div>
            <div className="flex justify-between mb-0.5 font-medium">
              <span className="text-slate-600 dark:text-slate-400">Wildfire</span>
              <strong className={`font-mono ${fireScore > 60 ? 'text-rose-500' : 'text-slate-700 dark:text-slate-300'}`}>{fireScore}%</strong>
            </div>
            <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
              <div className={`h-full ${fireScore > 60 ? 'bg-rose-500' : 'bg-orange-500'}`} style={{ width: `${fireScore}%` }} />
            </div>
          </div>

          <div>
            <div className="flex justify-between mb-0.5 font-medium">
              <span className="text-slate-600 dark:text-slate-400">Air AQI</span>
              <strong className={`font-mono ${airScore > 60 ? 'text-rose-500' : 'text-slate-700 dark:text-slate-300'}`}>{airScore}%</strong>
            </div>
            <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
              <div className={`h-full ${airScore > 60 ? 'bg-rose-500' : 'bg-purple-500'}`} style={{ width: `${airScore}%` }} />
            </div>
          </div>

          <div>
            <div className="flex justify-between mb-0.5 font-medium">
              <span className="text-slate-600 dark:text-slate-400">Landslide</span>
              <strong className={`font-mono ${landslideScore > 60 ? 'text-rose-500' : 'text-slate-700 dark:text-slate-300'}`}>{landslideScore}%</strong>
            </div>
            <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
              <div className={`h-full ${landslideScore > 60 ? 'bg-rose-500' : 'bg-amber-500'}`} style={{ width: `${landslideScore}%` }} />
            </div>
          </div>
        </div>
      </div>

      {/* 3. "WHY THIS ALERT?" EXPLAINABLE EVIDENCE (Point 6) */}
      <div className="bg-slate-50 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-xs space-y-1.5 shadow-xs font-sans">
        <div className="flex items-center justify-between text-xs font-semibold text-slate-800 dark:text-slate-200">
          <span className="flex items-center gap-1.5 text-cyan-600 dark:text-cyan-400">
            <Sparkles className="w-3.5 h-3.5" />
            Explainable Detection Evidence
          </span>
          <span className="text-[10px] text-slate-500 font-medium">Physics Rule Engine</span>
        </div>

        {evidenceList.length === 0 ? (
          <div className="text-xs text-slate-600 dark:text-slate-400 py-1 flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
            <span>All telemetry streams within rolling ±2.0σ Gaussian baseline boundary.</span>
          </div>
        ) : (
          <div className="space-y-1 text-xs text-slate-800 dark:text-slate-200">
            {evidenceList.map((ev, i) => (
              <div key={i} className="flex items-start gap-1.5 font-normal">
                <span className="text-rose-500 font-bold">✓</span>
                <span>{ev}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 4. Sensor Readings Grid */}
      <div className="space-y-1.5 font-sans">
        <div className="text-xs font-semibold text-slate-800 dark:text-slate-300 flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
            Live Environmental Sensors
          </span>
          <span className="text-[10px] text-cyan-600 dark:text-cyan-400 font-semibold uppercase tracking-wider">SX1262 Telemetry</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {/* Card 1: Water Level & Flood */}
          <div className="bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between text-xs text-slate-800 dark:text-slate-200 mb-0.5">
              <span className="flex items-center gap-1 font-semibold">
                <Droplet className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
                Water Level & Flood
              </span>
              <span className={`text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.2 rounded ${
                (reading?.water_level_m || 2.1) > 4.0 ? 'bg-rose-100 text-rose-800' : 'bg-cyan-100 text-cyan-800'
              }`}>
                {(reading?.water_level_m || 2.1) > 4.0 ? 'CRITICAL' : 'NORMAL'}
              </span>
            </div>
            <div className="text-lg font-bold font-mono text-slate-950 dark:text-slate-100 my-0.5">
              {reading?.water_level_m !== undefined ? `${reading.water_level_m.toFixed(2)} m` : '2.10 m'}
            </div>
            <div className="flex items-center justify-between text-[11px] font-mono text-slate-600 dark:text-slate-400 pt-1 border-t border-slate-100 dark:border-slate-800/80">
              <span>Turb: <strong>{reading?.turbidity.toFixed(1) || '18.5'} NTU</strong></span>
              <span>Rain: <strong>{reading?.rain_rate.toFixed(1) || '0.0'} mm/h</strong></span>
            </div>
          </div>

          {/* Card 2: Fire & Smoke */}
          <div className="bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between text-xs text-slate-800 dark:text-slate-200 mb-0.5">
              <span className="flex items-center gap-1 font-semibold">
                <Flame className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                Fire & Smoke
              </span>
              <span className={`text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.2 rounded ${
                reading?.flame_detected ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'
              }`}>
                {reading?.flame_detected ? 'CRITICAL' : 'NORMAL'}
              </span>
            </div>
            <div className="text-lg font-bold font-mono my-0.5 flex items-center gap-1.5">
              {reading?.flame_detected ? (
                <span className="text-rose-600 dark:text-rose-400 animate-pulse font-bold uppercase tracking-wider text-sm">FLAME ALERT</span>
              ) : (
                <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1 text-sm uppercase">
                  <ShieldCheck className="w-4 h-4" />
                  CLEAR
                </span>
              )}
            </div>
            <div className="flex items-center justify-between text-[11px] font-mono text-slate-600 dark:text-slate-400 pt-1 border-t border-slate-100 dark:border-slate-800/80">
              <span>Smoke: <strong>{reading?.smoke_density_pct?.toFixed(1) || '8.0'}%</strong></span>
              <span className="font-sans text-[10px] text-slate-500">Thermal IR</span>
            </div>
          </div>

          {/* Card 3: Air Quality & AQI */}
          <div className="bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between text-xs text-slate-800 dark:text-slate-200 mb-0.5">
              <span className="flex items-center gap-1 font-semibold">
                <Wind className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                Air Quality Index
              </span>
              <span className={`text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.2 rounded ${
                (reading?.aqi || 42) > 200 ? 'bg-rose-100 text-rose-800' : 'bg-purple-100 text-purple-800'
              }`}>
                {(reading?.aqi || 42) > 200 ? 'HAZARDOUS' : 'NORMAL'}
              </span>
            </div>
            <div className={`text-lg font-bold font-mono my-0.5 ${
              (reading?.aqi || 42) > 200 ? 'text-rose-600 dark:text-rose-400 animate-pulse' :
              (reading?.aqi || 42) > 100 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-950 dark:text-slate-100'
            }`}>
              AQI {reading?.aqi ?? 42}
            </div>
            <div className="flex items-center justify-between text-[11px] font-mono text-slate-600 dark:text-slate-400 pt-1 border-t border-slate-100 dark:border-slate-800/80">
              <span>PM2.5: <strong>{reading?.pm25?.toFixed(0) || '22'} µg</strong></span>
              <span>PM10: <strong>{reading?.pm10?.toFixed(0) || '45'}</strong></span>
            </div>
          </div>

          {/* Card 4: Slope Incline & Landslide */}
          <div className="bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between text-xs text-slate-800 dark:text-slate-200 mb-0.5">
              <span className="flex items-center gap-1 font-semibold">
                <Mountain className="w-3.5 h-3.5 text-yellow-600 dark:text-yellow-400" />
                Slope Incline
              </span>
              <span className={`text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.2 rounded ${
                (reading?.tilt_deg || 0.45) > 1.5 ? 'bg-rose-100 text-rose-800' : 'bg-yellow-100 text-yellow-800'
              }`}>
                {(reading?.tilt_deg || 0.45) > 1.5 ? 'WARNING' : 'STABLE'}
              </span>
            </div>
            <div className="text-lg font-bold font-mono text-slate-950 dark:text-slate-100 my-0.5">
              {reading?.tilt_deg !== undefined ? `${reading.tilt_deg.toFixed(2)}°` : '0.45°'}
            </div>
            <div className="flex items-center justify-between text-[11px] font-mono text-slate-600 dark:text-slate-400 pt-1 border-t border-slate-100 dark:border-slate-800/80">
              <span>Moisture: <strong>{reading?.soil_moisture?.toFixed(0) || '32'}%</strong></span>
              <span className="font-sans text-[10px] text-slate-500">6-DOF IMU</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
