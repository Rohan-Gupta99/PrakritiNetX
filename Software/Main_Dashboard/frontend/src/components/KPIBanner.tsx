import React from 'react';
import { 
  ShieldAlert, 
  AlertTriangle, 
  Layers, 
  Clock, 
  Server, 
  Activity,
  Zap,
  CheckCircle2
} from 'lucide-react';
import { SystemHealth, Alert, SensorNode } from '../types';

interface KPIBannerProps {
  systemHealth: SystemHealth | null;
  alerts: Alert[];
  nodes: SensorNode[];
  theme?: 'dark' | 'light';
}

export const KPIBanner: React.FC<KPIBannerProps> = ({
  systemHealth,
  alerts,
  nodes,
  theme = 'dark'
}) => {
  const isDark = theme === 'dark';

  const activeAlerts = alerts.filter(a => a.status !== 'RESOLVED');
  const criticalCount = activeAlerts.filter(a => a.severity === 'CRITICAL').length;
  const warningCount = activeAlerts.filter(a => a.severity === 'WARNING').length;

  const onlineNodes = nodes.filter(n => n.status !== 'OFFLINE').length;
  const totalNodes = nodes.length || 6;

  // Compute Overall System Risk Level
  let overallRisk: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL' = 'LOW';
  if (criticalCount > 0 || (systemHealth?.simulation_state && systemHealth.simulation_state !== 'IDLE_MONITORING')) {
    overallRisk = 'CRITICAL';
  } else if (warningCount > 0) {
    overallRisk = 'MODERATE';
  }

  return (
    <div className="w-full grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 font-sans text-xs">
      {/* 1. CRITICAL ALERTS */}
      <div className={`p-3 rounded-xl border flex flex-col justify-between transition-all ${
        criticalCount > 0
          ? 'bg-rose-500/15 border-rose-500 text-rose-500 dark:text-rose-400 shadow-md shadow-rose-950/40 animate-pulse'
          : isDark ? 'bg-slate-900/70 border-slate-800 text-slate-400' : 'bg-white border-slate-200 text-slate-600 shadow-xs'
      }`}>
        <div className="flex items-center justify-between text-[11px] font-semibold text-slate-700 dark:text-slate-300">
          <span>Critical Alerts</span>
          <ShieldAlert className={`w-4 h-4 ${criticalCount > 0 ? 'text-rose-500 animate-bounce' : 'text-slate-400'}`} />
        </div>
        <div className="mt-2 flex items-baseline justify-between">
          <span className={`text-2xl font-bold font-mono tracking-tight ${criticalCount > 0 ? 'text-rose-600 dark:text-rose-300' : 'text-slate-800 dark:text-slate-200'}`}>
            {criticalCount.toString().padStart(2, '0')}
          </span>
          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded font-sans uppercase tracking-wider ${
            criticalCount > 0 ? 'bg-rose-600 text-white font-bold' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
          }`}>
            {criticalCount > 0 ? 'ACTION REQ' : 'SECURE'}
          </span>
        </div>
      </div>

      {/* 2. WARNING ALERTS */}
      <div className={`p-3 rounded-xl border flex flex-col justify-between transition-all ${
        warningCount > 0 && criticalCount === 0
          ? 'bg-amber-500/15 border-amber-500 text-amber-600 dark:text-amber-400 shadow-sm'
          : isDark ? 'bg-slate-900/70 border-slate-800 text-slate-400' : 'bg-white border-slate-200 text-slate-600 shadow-xs'
      }`}>
        <div className="flex items-center justify-between text-[11px] font-semibold text-slate-700 dark:text-slate-300">
          <span>Warning Alerts</span>
          <AlertTriangle className={`w-4 h-4 ${warningCount > 0 ? 'text-amber-500' : 'text-slate-400'}`} />
        </div>
        <div className="mt-2 flex items-baseline justify-between">
          <span className={`text-2xl font-bold font-mono tracking-tight ${warningCount > 0 ? 'text-amber-600 dark:text-amber-300' : 'text-slate-800 dark:text-slate-200'}`}>
            {warningCount.toString().padStart(2, '0')}
          </span>
          <span className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold font-sans uppercase tracking-wider">
            {warningCount > 0 ? 'MONITOR' : 'NORMAL'}
          </span>
        </div>
      </div>

      {/* 3. NODES ONLINE */}
      <div className={`p-3 rounded-xl border flex flex-col justify-between ${
        isDark ? 'bg-slate-900/70 border-slate-800 text-slate-400' : 'bg-white border-slate-200 text-slate-600 shadow-xs'
      }`}>
        <div className="flex items-center justify-between text-[11px] font-semibold text-slate-700 dark:text-slate-300">
          <span>Nodes Online</span>
          <Layers className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
        </div>
        <div className="mt-2 flex items-baseline justify-between">
          <span className="text-2xl font-bold font-mono tracking-tight text-cyan-700 dark:text-cyan-300">
            {onlineNodes}/{totalNodes}
          </span>
          <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-700/50 px-1.5 py-0.5 rounded font-sans uppercase tracking-wider">
            {Math.round((onlineNodes / totalNodes) * 100)}% Mesh
          </span>
        </div>
      </div>

      {/* 4. DATA FRESHNESS */}
      <div className={`p-3 rounded-xl border flex flex-col justify-between ${
        isDark ? 'bg-slate-900/70 border-slate-800 text-slate-400' : 'bg-white border-slate-200 text-slate-600 shadow-xs'
      }`}>
        <div className="flex items-center justify-between text-[11px] font-semibold text-slate-700 dark:text-slate-300">
          <span>Data Freshness</span>
          <Clock className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
        </div>
        <div className="mt-2 flex items-baseline justify-between">
          <span className="text-2xl font-bold font-mono tracking-tight text-slate-900 dark:text-slate-100">
            {systemHealth?.speed_multiplier && systemHealth.speed_multiplier > 1.0 ? '0.4s' : '1.8s'}
          </span>
          <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-semibold flex items-center gap-1 font-sans uppercase tracking-wider">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
            LoRa Sync
          </span>
        </div>
      </div>

      {/* 5. GATEWAY STATUS */}
      <div className={`p-3 rounded-xl border flex flex-col justify-between ${
        isDark ? 'bg-slate-900/70 border-slate-800 text-slate-400' : 'bg-white border-slate-200 text-slate-600 shadow-xs'
      }`}>
        <div className="flex items-center justify-between text-[11px] font-semibold text-slate-700 dark:text-slate-300">
          <span>Gateway Status</span>
          <Server className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
        </div>
        <div className="mt-2 flex items-baseline justify-between">
          <span className="text-base font-bold font-sans text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5 uppercase">
            <CheckCircle2 className="w-4 h-4" />
            ONLINE
          </span>
          <span className="text-[10px] text-slate-500 font-semibold font-sans uppercase tracking-wider">
            EDGE HUB
          </span>
        </div>
      </div>

      {/* 6. OVERALL RISK */}
      <div className={`p-3 rounded-xl border flex flex-col justify-between transition-all ${
        overallRisk === 'CRITICAL'
          ? 'bg-rose-600 text-white border-rose-500 shadow-lg shadow-rose-950/50'
          : overallRisk === 'MODERATE'
          ? 'bg-amber-500 text-slate-950 border-amber-400'
          : 'bg-emerald-600 text-white border-emerald-500'
      }`}>
        <div className="flex items-center justify-between text-[11px] font-semibold opacity-90">
          <span>Overall Risk</span>
          <Activity className="w-4 h-4" />
        </div>
        <div className="mt-2 flex items-baseline justify-between">
          <span className="text-xl font-bold font-sans tracking-wide uppercase">
            {overallRisk}
          </span>
          <span className="text-[10px] font-semibold uppercase tracking-wider opacity-90">
            {overallRisk === 'CRITICAL' ? 'HAZARD SPIKE' : overallRisk === 'MODERATE' ? 'ELEVATED' : 'NOMINAL'}
          </span>
        </div>
      </div>
    </div>
  );
};
