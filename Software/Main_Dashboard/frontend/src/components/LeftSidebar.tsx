import React from 'react';
import { SensorNode, SystemHealth, Alert } from '../types';
import { 
  Droplet, 
  Mountain, 
  Flame, 
  Laptop, 
  Battery, 
  Wifi, 
  AlertTriangle, 
  Cpu, 
  Database,
  Radio,
  Wind,
  Sun,
  AlertOctagon,
  Waves
} from 'lucide-react';

interface LeftSidebarProps {
  nodes: SensorNode[];
  selectedNodeId: number | null;
  onSelectNode: (id: number) => void;
  systemHealth: SystemHealth | null;
  alerts: Alert[];
}

export const LeftSidebar: React.FC<LeftSidebarProps> = ({
  nodes,
  selectedNodeId,
  onSelectNode,
  systemHealth,
  alerts,
}) => {
  const activeAlerts = alerts.filter(a => a.status !== 'RESOLVED');
  const criticalCount = activeAlerts.filter(a => a.severity === 'CRITICAL').length;
  const warningCount = activeAlerts.filter(a => a.severity === 'WARNING').length;

  const getHazardIcon = (type: string) => {
    switch (type) {
      case 'flood':
        return <Droplet className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />;
      case 'flood+fire':
        return <Flame className="w-3.5 h-3.5 text-orange-600 dark:text-orange-400" />;
      case 'landslide':
        return <Mountain className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />;
      case 'air':
        return <Wind className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />;
      case 'heat':
        return <Sun className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />;
      case 'chemical':
        return <AlertOctagon className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />;
      case 'water':
        return <Waves className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />;
      case 'hub':
        return <Laptop className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />;
      default:
        return <Radio className="w-3.5 h-3.5 text-slate-600 dark:text-slate-400" />;
    }
  };

  return (
    <aside className="w-full flex flex-col gap-2.5 h-full font-sans">
      {/* Active Alerts Pill Counter */}
      <div className="glass-panel p-2.5 rounded-xl shadow-sm">
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-1.5">
            <AlertTriangle className={`w-3.5 h-3.5 ${criticalCount > 0 ? 'text-rose-500 animate-bounce' : 'text-slate-500 dark:text-slate-400'}`} />
            <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
              Active Alerts
            </span>
          </div>
          <span className="px-2 py-0.5 rounded-full text-xs font-mono font-bold bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700">
            {activeAlerts.length}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs font-sans">
          <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-900/50 rounded-lg p-1.5 flex items-center justify-between shadow-sm">
            <span className="text-rose-800 dark:text-rose-400 font-semibold text-[11px]">Critical</span>
            <span className="text-rose-900 dark:text-rose-200 font-bold font-mono text-sm">{criticalCount}</span>
          </div>
          <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-900/50 rounded-lg p-1.5 flex items-center justify-between shadow-sm">
            <span className="text-amber-800 dark:text-amber-400 font-semibold text-[11px]">Warning</span>
            <span className="text-amber-900 dark:text-amber-200 font-bold font-mono text-sm">{warningCount}</span>
          </div>
        </div>
      </div>

      {/* Sensor Node List */}
      <div className="glass-panel p-2.5 rounded-xl flex flex-col gap-1.5 shadow-sm">
        <div className="flex items-center justify-between pb-1.5 border-b border-slate-200 dark:border-slate-800 text-xs text-slate-800 dark:text-slate-400 font-bold">
          <span>Connected Nodes ({nodes.length})</span>
          <span>Status</span>
        </div>

        <div className="space-y-1.5">
          {nodes.map((node) => {
            const isSelected = selectedNodeId === node.id;
            const isAlert = node.status === 'ALERT';
            const isWarning = node.status === 'WARNING';

            return (
              <div
                key={node.id}
                onClick={() => onSelectNode(node.id)}
                className={`p-2 rounded-lg border cursor-pointer transition-all ${
                  isSelected
                    ? 'bg-cyan-50 dark:bg-cyan-950/60 border-cyan-500 dark:border-cyan-500 shadow-sm'
                    : 'bg-white hover:bg-slate-50 dark:bg-slate-900/50 dark:hover:bg-slate-850 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 shadow-xs'
                }`}
              >
                <div className="flex items-center justify-between mb-0.5">
                  <div className="flex items-center gap-1.5">
                    <div className="p-1 rounded-md bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xs">
                      {getHazardIcon(node.hazard_type)}
                    </div>
                    <div>
                      <div className="flex items-center gap-1">
                        <span className="text-xs font-bold font-mono text-slate-950 dark:text-slate-100">{node.node_code}</span>
                        <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate max-w-[120px]">{node.name}</span>
                      </div>
                    </div>
                  </div>

                  <span
                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                      isAlert
                        ? 'bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300 border border-rose-300 dark:border-rose-600 animate-pulse'
                        : isWarning
                        ? 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-600'
                        : 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700/50'
                    }`}
                  >
                    {node.status}
                  </span>
                </div>

                <div className="flex items-center justify-between text-[11px] font-mono text-slate-600 dark:text-slate-400 pt-1 border-t border-slate-100 dark:border-slate-800/60 font-medium">
                  <div className="flex items-center gap-1">
                    <Battery className={`w-3 h-3 ${node.battery_pct > 30 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`} />
                    <span>{node.battery_pct.toFixed(0)}%</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Wifi className="w-3 h-3 text-cyan-600 dark:text-cyan-400" />
                    <span>{node.signal_rssi} dBm</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Laptop Central Hub Health */}
      <div className="glass-panel p-2.5 rounded-xl text-xs font-sans space-y-2 shadow-sm">
        <div className="flex items-center justify-between text-slate-800 dark:text-slate-300 font-bold text-xs border-b border-slate-200 dark:border-slate-800 pb-1">
          <span className="flex items-center gap-1.5 text-cyan-600 dark:text-cyan-400">
            <Cpu className="w-3.5 h-3.5" />
            Central Gateway Hub
          </span>
          <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold uppercase tracking-wider">STANDALONE</span>
        </div>

        {/* CPU & Memory compact bars */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <div className="flex justify-between text-[11px] text-slate-600 dark:text-slate-400 mb-0.5 font-medium">
              <span>CPU Load</span>
              <span className="text-slate-900 dark:text-slate-200 font-bold font-mono">{systemHealth?.cpu_percent ?? 12.5}%</span>
            </div>
            <div className="w-full h-1 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-cyan-500 rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, systemHealth?.cpu_percent ?? 12.5)}%` }}
              />
            </div>
          </div>
          <div>
            <div className="flex justify-between text-[11px] text-slate-600 dark:text-slate-400 mb-0.5 font-medium">
              <span>RAM</span>
              <span className="text-slate-900 dark:text-slate-200 font-bold font-mono">{systemHealth?.memory_percent ?? 42.0}%</span>
            </div>
            <div className="w-full h-1 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-indigo-500 rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, systemHealth?.memory_percent ?? 42.0)}%` }}
              />
            </div>
          </div>
        </div>

        {/* Database & Packets Counter */}
        <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-200 dark:border-slate-800/80 text-[11px]">
          <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
            <Database className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <div>
              <div className="text-slate-900 dark:text-slate-200 font-bold font-mono">{systemHealth?.db_size_kb?.toFixed(0) || 48} KB</div>
              <div>SQLite Storage</div>
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
            <Radio className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
            <div>
              <div className="text-slate-900 dark:text-slate-200 font-bold font-mono">{systemHealth?.total_packets_received ?? 120} pkts</div>
              <div>LoRa Ingested</div>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
};
