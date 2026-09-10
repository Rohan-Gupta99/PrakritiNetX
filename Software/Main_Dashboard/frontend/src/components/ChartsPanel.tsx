import React, { useState, useMemo } from 'react';
import { 
  ResponsiveContainer, 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  Tooltip, 
  Legend, 
  CartesianGrid, 
  ReferenceLine 
} from 'recharts';
import { Reading } from '../types';
import { LineChart as ChartIcon, Droplet, Activity, CloudRain, BatteryCharging } from 'lucide-react';

interface ChartsPanelProps {
  readings: Reading[];
}

export const ChartsPanel: React.FC<ChartsPanelProps> = ({ readings }) => {
  const [selectedMetric, setSelectedMetric] = useState<'turbidity' | 'water_level_m' | 'pm25' | 'temperature_c' | 'tilt_deg' | 'rain_rate' | 'battery_mv'>('turbidity');

  // Node Colors Map
  const nodeColors: Record<string, string> = {
    N1: '#06b6d4', // Cyan (Upstream Gauge)
    N2: '#6366f1', // Indigo (Devprayag)
    N3: '#f59e0b', // Amber (Rishikesh)
    N4: '#ec4899', // Pink (Narendra Nagar Ridge)
    N5: '#10b981', // Emerald (Downstream Plain)
  };

  // Process readings into wide multi-node format for synchronized time series
  const chartData = useMemo(() => {
    const timeBuckets: Record<string, Record<string, number | string>> = {};

    readings.forEach((r) => {
      const timeLabel = new Date(r.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      if (!timeBuckets[timeLabel]) {
        timeBuckets[timeLabel] = { time: timeLabel };
      }

      const code = r.node_code || `N${r.node_id}`;
      if (selectedMetric === 'turbidity') {
        timeBuckets[timeLabel][code] = r.turbidity;
      } else if (selectedMetric === 'water_level_m') {
        timeBuckets[timeLabel][code] = r.water_level_m ?? 2.1;
      } else if (selectedMetric === 'pm25') {
        timeBuckets[timeLabel][code] = r.pm25 ?? 22;
      } else if (selectedMetric === 'temperature_c') {
        timeBuckets[timeLabel][code] = r.temperature_c ?? 22;
      } else if (selectedMetric === 'tilt_deg') {
        timeBuckets[timeLabel][code] = r.tilt_deg ?? 0.45;
      } else if (selectedMetric === 'rain_rate') {
        timeBuckets[timeLabel][code] = r.rain_rate;
      } else if (selectedMetric === 'battery_mv') {
        timeBuckets[timeLabel][code] = r.battery_mv;
      }
    });

    return Object.values(timeBuckets).slice(-35);
  }, [readings, selectedMetric]);

  return (
    <div className="glass-panel p-4 rounded-xl flex flex-col gap-3 h-full font-sans text-xs">
      {/* Chart Header & Metric Selectors */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
        <div className="flex items-center gap-2">
          <ChartIcon className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
          <span className="text-sm font-bold text-slate-800 dark:text-slate-200">
            Multi-Hazard Valley Time Series
          </span>
        </div>

        {/* Metric Tabs */}
        <div className="flex flex-wrap items-center gap-1 bg-slate-100 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-lg p-1 text-xs font-sans">
          <button
            onClick={() => setSelectedMetric('turbidity')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded transition-all font-semibold ${
              selectedMetric === 'turbidity' 
                ? 'bg-cyan-500 text-slate-950 shadow-sm' 
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <Droplet className="w-3 h-3" />
            Turbidity
          </button>
          <button
            onClick={() => setSelectedMetric('water_level_m')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded transition-all font-semibold ${
              selectedMetric === 'water_level_m' 
                ? 'bg-cyan-500 text-slate-950 shadow-sm' 
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <Activity className="w-3 h-3" />
            Water Level (m)
          </button>
          <button
            onClick={() => setSelectedMetric('pm25')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded transition-all font-semibold ${
              selectedMetric === 'pm25' 
                ? 'bg-purple-500 text-white shadow-sm' 
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            Air (PM2.5)
          </button>
          <button
            onClick={() => setSelectedMetric('temperature_c')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded transition-all font-semibold ${
              selectedMetric === 'temperature_c' 
                ? 'bg-orange-500 text-white shadow-sm' 
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            Temp (°C)
          </button>
          <button
            onClick={() => setSelectedMetric('tilt_deg')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded transition-all font-semibold ${
              selectedMetric === 'tilt_deg' 
                ? 'bg-amber-500 text-slate-950 shadow-sm' 
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            Slope Tilt (°)
          </button>
          <button
            onClick={() => setSelectedMetric('rain_rate')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded transition-all font-semibold ${
              selectedMetric === 'rain_rate' 
                ? 'bg-cyan-500 text-slate-950 shadow-sm' 
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <CloudRain className="w-3 h-3" />
            Rain mm/hr
          </button>
          <button
            onClick={() => setSelectedMetric('battery_mv')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded transition-all font-semibold ${
              selectedMetric === 'battery_mv' 
                ? 'bg-emerald-500 text-slate-950 shadow-sm' 
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <BatteryCharging className="w-3 h-3" />
            Battery
          </button>
        </div>
      </div>

      {/* Recharts Canvas */}
      <div className="w-full h-56 min-h-[220px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" strokeOpacity={0.25} />
            <XAxis 
              dataKey="time" 
              stroke="#64748b" 
              fontSize={10} 
              tickLine={false} 
              fontFamily="monospace"
            />
            <YAxis 
              stroke="#64748b" 
              fontSize={10} 
              domain={selectedMetric === 'battery_mv' ? [3100, 3400] : [0, 'auto']}
              tickLine={false}
              fontFamily="monospace"
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'rgba(15, 23, 42, 0.95)',
                borderColor: '#475569',
                borderRadius: '8px',
                fontSize: '11px',
                fontFamily: 'monospace',
                color: '#f8fafc',
                boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.3)'
              }}
            />
            <Legend 
              wrapperStyle={{ fontSize: '11px', fontFamily: 'Inter, sans-serif', paddingTop: '6px' }} 
            />

            {/* Baseline threshold reference lines for Turbidity */}
            {selectedMetric === 'turbidity' && (
              <>
                <ReferenceLine y={18.5} stroke="#2563eb" strokeDasharray="3 3" label={{ value: 'Mean Baseline', fill: '#3b82f6', fontSize: 10, fontFamily: 'sans-serif' }} />
                <ReferenceLine y={65.0} stroke="#dc2626" strokeDasharray="4 4" label={{ value: '+3σ Hazard Threshold', fill: '#ef4444', fontSize: 10, fontFamily: 'sans-serif' }} />
              </>
            )}

            {/* Individual Node Lines */}
            <Line type="monotone" dataKey="N1" stroke={nodeColors.N1} strokeWidth={2.5} dot={false} name="N1 Upstream" />
            <Line type="monotone" dataKey="N2" stroke={nodeColors.N2} strokeWidth={2} dot={false} name="N2 Devprayag" />
            <Line type="monotone" dataKey="N3" stroke={nodeColors.N3} strokeWidth={2} dot={false} name="N3 Rishikesh" />
            {selectedMetric !== 'turbidity' && selectedMetric !== 'water_level_m' && (
              <Line type="monotone" dataKey="N4" stroke={nodeColors.N4} strokeWidth={2} dot={false} name="N4 Narendra N." />
            )}
            <Line type="monotone" dataKey="N5" stroke={nodeColors.N5} strokeWidth={2} dot={false} name="N5 Downstream" />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
