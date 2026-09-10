import React from 'react';
import { SensorNode } from '../types';
import { 
  Radio, 
  Battery, 
  Wifi, 
  Layers, 
  CheckCircle2, 
  AlertTriangle, 
  ShieldAlert,
  Server
} from 'lucide-react';

interface NodeHealthTableProps {
  nodes: SensorNode[];
  selectedNodeId: number | null;
  onSelectNode: (id: number) => void;
  theme?: 'dark' | 'light';
}

export const NodeHealthTable: React.FC<NodeHealthTableProps> = ({
  nodes,
  selectedNodeId,
  onSelectNode,
  theme = 'dark'
}) => {
  const isDark = theme === 'dark';

  return (
    <div className={`p-4 rounded-xl border ${
      isDark ? 'bg-slate-900/80 border-slate-800' : 'bg-white border-slate-200 shadow-xs'
    } text-xs font-sans flex flex-col gap-3 h-full`}>
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
          <span className="font-bold text-sm text-slate-900 dark:text-slate-100">
            LoRa Sensor Mesh Nodes & Network Connectivity Matrix
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <span>Total Nodes: <strong className="font-mono text-slate-700 dark:text-slate-300">{nodes.length}</strong></span>
          <span>•</span>
          <span className="text-emerald-600 dark:text-emerald-400 font-bold">100% Topology Health</span>
        </div>
      </div>

      {/* Structured Table */}
      <div className="flex-1 overflow-x-auto overflow-y-auto">
        <table className="w-full text-left border-collapse font-sans">
          <thead>
            <tr className={`border-b text-[11px] font-bold uppercase tracking-wider ${
              isDark ? 'border-slate-800 text-slate-400 bg-slate-950/60' : 'border-slate-200 text-slate-500 bg-slate-50'
            }`}>
              <th className="p-2.5">Node</th>
              <th className="p-2.5">Valley Location</th>
              <th className="p-2.5">Hazard Type</th>
              <th className="p-2.5">Status</th>
              <th className="p-2.5">Battery</th>
              <th className="p-2.5">Voltage</th>
              <th className="p-2.5">RSSI / SNR</th>
              <th className="p-2.5">Relay Parent</th>
              <th className="p-2.5">Hop</th>
              <th className="p-2.5">Last Seen</th>
              <th className="p-2.5">Packet Health</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60 text-xs">
            {nodes.map((node) => {
              const isSelected = selectedNodeId === node.id;
              const isAlert = node.status === 'ALERT';
              const isWarning = node.status === 'WARNING';

              return (
                <tr
                  key={node.id}
                  onClick={() => onSelectNode(node.id)}
                  className={`cursor-pointer transition-colors ${
                    isSelected
                      ? 'bg-cyan-50 dark:bg-cyan-950/50 font-semibold'
                      : isDark ? 'hover:bg-slate-800/60' : 'hover:bg-slate-50'
                  }`}
                >
                  <td className="p-2.5 font-bold font-mono text-cyan-600 dark:text-cyan-400">
                    {node.node_code}
                  </td>
                  <td className="p-2.5 font-semibold text-slate-900 dark:text-slate-100">
                    {node.name}
                  </td>
                  <td className="p-2.5 capitalize text-slate-600 dark:text-slate-400">
                    {node.hazard_type}
                  </td>
                  <td className="p-2.5">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                      isAlert
                        ? 'bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300 border border-rose-300 dark:border-rose-600 animate-pulse'
                        : isWarning
                        ? 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-600'
                        : 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700/50'
                    }`}>
                      {node.status}
                    </span>
                  </td>
                  <td className="p-2.5">
                    <div className="flex items-center gap-1.5 font-mono">
                      <Battery className={`w-3.5 h-3.5 ${node.battery_pct > 30 ? 'text-emerald-500' : 'text-rose-500'}`} />
                      <span>{node.battery_pct.toFixed(0)}%</span>
                    </div>
                  </td>
                  <td className="p-2.5 font-mono text-slate-600 dark:text-slate-400">
                    {node.battery_mv} mV
                  </td>
                  <td className="p-2.5 font-mono">
                    <span className="text-slate-900 dark:text-slate-100 font-semibold">{node.signal_rssi} dBm</span>
                    <span className="text-[11px] text-slate-500 ml-1">({node.signal_snr} dB)</span>
                  </td>
                  <td className="p-2.5 font-mono font-medium text-slate-700 dark:text-slate-300">
                    {node.relay_parent}
                  </td>
                  <td className="p-2.5">
                    <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-[10px] font-mono font-semibold">
                      Hop {node.hop_count}
                    </span>
                  </td>
                  <td className="p-2.5 font-mono text-slate-500 text-[11px]">
                    {node.last_seen ? new Date(node.last_seen).toLocaleTimeString() : 'Live'}
                  </td>
                  <td className="p-2.5">
                    <span className="text-emerald-600 dark:text-emerald-400 font-bold font-mono flex items-center gap-1 text-[11px]">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      99.6%
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
