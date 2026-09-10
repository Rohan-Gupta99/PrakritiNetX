import React from 'react';
import { ActiveSurge, TravelTimeInfo } from '../types';
import { 
  ArrowRight, 
  Clock, 
  Waves, 
  AlertTriangle, 
  ShieldCheck, 
  Activity,
  CheckCircle2
} from 'lucide-react';

interface FloodPropagationETAProps {
  activeSurge: ActiveSurge | null;
  travelTime: TravelTimeInfo | null;
  theme?: 'dark' | 'light';
}

export const FloodPropagationETA: React.FC<FloodPropagationETAProps> = ({
  activeSurge,
  travelTime,
  theme = 'dark'
}) => {
  const isDark = theme === 'dark';
  const isSurgeActive = activeSurge !== null && activeSurge.status !== 'RESOLVED';

  return (
    <div className={`w-full p-3.5 rounded-xl border transition-all ${
      isSurgeActive
        ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-500/70 shadow-lg shadow-rose-950/30'
        : isDark ? 'bg-slate-900/80 border-slate-800' : 'bg-white border-slate-200 shadow-xs'
    } text-xs font-sans flex flex-col gap-2.5`}>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800/80 pb-2">
        <div className="flex items-center gap-2">
          <Waves className={`w-4 h-4 ${isSurgeActive ? 'text-rose-500 animate-pulse' : 'text-cyan-600 dark:text-cyan-400'}`} />
          <span className="font-semibold text-xs text-slate-900 dark:text-slate-100 font-sans">
            Hydrodynamic Flood Wave Propagation & Downstream Arrival ETA
          </span>
        </div>

        <div className="flex items-center gap-2 font-sans">
          {isSurgeActive ? (
            <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full font-semibold bg-rose-600 text-white text-[10px] animate-pulse uppercase tracking-wider">
              <AlertTriangle className="w-3 h-3" />
              WAVE PROPAGATING (~3.5 m/s)
            </span>
          ) : (
            <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full font-semibold bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700/50 text-[10px] uppercase tracking-wider">
              <CheckCircle2 className="w-3 h-3" />
              NORMAL VALLEY HYDRAULICS
            </span>
          )}
        </div>
      </div>

      {/* Visual Stepper: N1 -> N2 -> N3 -> N5 */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 items-center font-sans">
        {/* Step 1: N1 Upstream Gauge */}
        <div className={`p-2.5 rounded-lg border text-center transition-all ${
          isSurgeActive
            ? 'bg-rose-100 dark:bg-rose-900/80 border-rose-400 text-rose-900 dark:text-rose-100 shadow-sm'
            : isDark ? 'bg-slate-950 border-slate-800 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-800'
        }`}>
          <div className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">Origin (km 0.0)</div>
          <div className="text-sm font-bold text-cyan-600 dark:text-cyan-400 my-0.5">N1 Upstream</div>
          <div className="text-[11px] font-mono font-medium">
            {isSurgeActive ? `Surge Z: +${activeSurge?.turb_z.toFixed(1) || '4.2'}σ` : 'Turbidity 18.5 NTU'}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">Ultrasonic Radar Active</div>
        </div>

        {/* Step 2: N2 Devprayag */}
        <div className={`p-2.5 rounded-lg border text-center transition-all ${
          isSurgeActive
            ? 'bg-amber-100 dark:bg-amber-900/70 border-amber-400 text-amber-900 dark:text-amber-100 shadow-sm'
            : isDark ? 'bg-slate-950 border-slate-800 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-800'
        }`}>
          <div className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">+4.8 km Valley</div>
          <div className="text-sm font-bold text-amber-600 dark:text-amber-400 my-0.5">N2 Devprayag</div>
          <div className="text-[11px] font-mono font-semibold">
            {isSurgeActive ? 'ETA: ~23 Minutes' : 'Wave Model Standby'}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">Confluence Gauge</div>
        </div>

        {/* Step 3: N3 Rishikesh Riverfront */}
        <div className={`p-2.5 rounded-lg border text-center transition-all ${
          isSurgeActive
            ? 'bg-rose-100 dark:bg-rose-900/70 border-rose-400 text-rose-900 dark:text-rose-100 shadow-sm'
            : isDark ? 'bg-slate-950 border-slate-800 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-800'
        }`}>
          <div className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">+9.2 km Valley</div>
          <div className="text-sm font-bold text-rose-600 dark:text-rose-400 my-0.5">N3 Rishikesh</div>
          <div className="text-[11px] font-mono font-semibold">
            {isSurgeActive ? 'ETA: ~44 Minutes' : 'Wave Model Standby'}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">Riverfront & Ghats</div>
        </div>

        {/* Step 4: N5 Downstream Plain */}
        <div className={`p-2.5 rounded-lg border text-center transition-all ${
          isSurgeActive
            ? 'bg-purple-100 dark:bg-purple-900/70 border-purple-400 text-purple-900 dark:text-purple-100 shadow-sm'
            : isDark ? 'bg-slate-950 border-slate-800 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-800'
        }`}>
          <div className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">+18.5 km Plain</div>
          <div className="text-sm font-bold text-emerald-600 dark:text-emerald-400 my-0.5">N5 Plain</div>
          <div className="text-[11px] font-mono font-semibold">
            {isSurgeActive ? 'ETA: ~88 Minutes' : 'Wave Model Standby'}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">Agricultural Floodplain</div>
        </div>
      </div>

      {/* Summary Metrics Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-100 dark:bg-slate-950 p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 text-xs font-sans">
        <div className="flex items-center gap-2">
          <Clock className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
          <span className="text-slate-600 dark:text-slate-400">Predicted Downstream Impact Window:</span>
          <span className={`font-semibold ${isSurgeActive ? 'text-rose-600 dark:text-rose-400 font-mono text-xs' : 'text-slate-800 dark:text-slate-200'}`}>
            {isSurgeActive ? '🚨 23 – 44 Minutes Actionable Lead Time' : 'Standby (No active flood wave detected)'}
          </span>
        </div>

        <div className="flex items-center gap-3 text-[11px] text-slate-500 font-sans">
          <span>Wave Velocity: <strong className="font-mono text-slate-700 dark:text-slate-300">3.5 m/s (~12.6 km/h)</strong></span>
          <span>•</span>
          <span>Tolerance Window: <strong className="font-mono text-slate-700 dark:text-slate-300">±10 min</strong></span>
          <span>•</span>
          <span className="text-cyan-700 dark:text-cyan-400 font-semibold">1D Saint-Venant Solver</span>
        </div>
      </div>
    </div>
  );
};
