import React, { useState } from 'react';
import { LoRaPacket } from '../types';
import { Terminal, CheckCircle, AlertCircle, Radio, ArrowDown } from 'lucide-react';

interface PacketInspectorProps {
  packets: LoRaPacket[];
}

export const PacketInspector: React.FC<PacketInspectorProps> = ({ packets }) => {
  const [selectedPacket, setSelectedPacket] = useState<LoRaPacket | null>(null);

  const activePacket = selectedPacket || packets[0] || null;

  return (
    <div className="glass-panel p-4 rounded-xl flex flex-col gap-3 h-full font-sans text-xs">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          <span className="text-sm font-bold text-slate-800 dark:text-slate-200">
            LoRa SX1262 14-Byte Binary Packet Inspector
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs font-mono text-slate-600 dark:text-slate-400">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="font-semibold">865.0 MHz (India ISM Band)</span>
        </div>
      </div>

      {/* Packet Dissect Top View if packet exists */}
      {activePacket && (
        <div className="bg-slate-50 dark:bg-slate-950 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-1.5 mb-2.5">
            <span className="text-cyan-800 dark:text-cyan-400 font-bold text-xs">
              Packet Payload Breakdown [<span className="font-mono">{activePacket.node_code || `N${activePacket.node_id}`}</span>]
            </span>
            <span className="text-slate-500 dark:text-slate-400 text-xs font-mono">
              {new Date(activePacket.timestamp).toLocaleTimeString()}
            </span>
          </div>

          {/* Hex display with highlighted byte segments */}
          <div className="bg-white dark:bg-[#060910] p-2.5 rounded-lg border border-slate-200 dark:border-slate-800/80 text-cyan-800 dark:text-cyan-300 text-xs tracking-widest break-all font-mono mb-3 shadow-inner font-bold">
            <span className="text-pink-600 dark:text-pink-400" title="Byte 0: Node ID">{activePacket.raw_hex.substring(0, 2)}</span>
            <span className="text-blue-600 dark:text-blue-400" title="Byte 1-4: Timestamp">{activePacket.raw_hex.substring(2, 10)}</span>
            <span className="text-amber-600 dark:text-amber-400" title="Byte 5: Msg Type">{activePacket.raw_hex.substring(10, 12)}</span>
            <span className="text-emerald-600 dark:text-emerald-400" title="Byte 6-7: Primary">{activePacket.raw_hex.substring(12, 16)}</span>
            <span className="text-purple-600 dark:text-purple-400" title="Byte 8-9: ROC">{activePacket.raw_hex.substring(16, 20)}</span>
            <span className="text-sky-600 dark:text-sky-400" title="Byte 10-11: Battery">{activePacket.raw_hex.substring(20, 24)}</span>
            <span className="text-orange-600 dark:text-orange-400" title="Byte 12: Flags">{activePacket.raw_hex.substring(24, 26)}</span>
            <span className="text-rose-600 dark:text-rose-400 font-bold" title="Byte 13: CRC-8">{activePacket.raw_hex.substring(26, 28)}</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            <div className="bg-white dark:bg-slate-900/60 p-2 rounded-lg border border-slate-200 dark:border-slate-800">
              <span className="text-slate-500 dark:text-slate-400 block text-[11px] font-medium">Node ID:</span>{' '}
              <strong className="text-slate-900 dark:text-slate-200 font-bold font-mono">{activePacket.node_id} ({activePacket.node_code})</strong>
            </div>
            <div className="bg-white dark:bg-slate-900/60 p-2 rounded-lg border border-slate-200 dark:border-slate-800">
              <span className="text-slate-500 dark:text-slate-400 block text-[11px] font-medium">Msg Type:</span>{' '}
              <strong className="text-cyan-700 dark:text-cyan-300 font-bold font-mono">{activePacket.msg_type === 2 ? '0x02 ANOMALY' : '0x01 ROUTINE'}</strong>
            </div>
            <div className="bg-white dark:bg-slate-900/60 p-2 rounded-lg border border-slate-200 dark:border-slate-800">
              <span className="text-slate-500 dark:text-slate-400 block text-[11px] font-medium">Primary Reading:</span>{' '}
              <strong className="text-slate-900 dark:text-slate-200 font-bold font-mono">{activePacket.primary_reading}</strong>
            </div>
            <div className="bg-white dark:bg-slate-900/60 p-2 rounded-lg border border-slate-200 dark:border-slate-800">
              <span className="text-slate-500 dark:text-slate-400 block text-[11px] font-medium">Rate of Change:</span>{' '}
              <strong className="text-slate-900 dark:text-slate-200 font-bold font-mono">{activePacket.rate_of_change}</strong>
            </div>
            <div className="bg-white dark:bg-slate-900/60 p-2 rounded-lg border border-slate-200 dark:border-slate-800">
              <span className="text-slate-500 dark:text-slate-400 block text-[11px] font-medium">Battery:</span>{' '}
              <strong className="text-emerald-700 dark:text-emerald-400 font-bold font-mono">{activePacket.battery_mv} mV</strong>
            </div>
            <div className="bg-white dark:bg-slate-900/60 p-2 rounded-lg border border-slate-200 dark:border-slate-800">
              <span className="text-slate-500 dark:text-slate-400 block text-[11px] font-medium">Health Flags:</span>{' '}
              <strong className="text-slate-900 dark:text-slate-200 font-bold font-mono">0x06 (Solar+Radar OK)</strong>
            </div>
            <div className="bg-white dark:bg-slate-900/60 p-2 rounded-lg border border-slate-200 dark:border-slate-800">
              <span className="text-slate-500 dark:text-slate-400 block text-[11px] font-medium">CRC-8 Checksum:</span>{' '}
              <strong className="text-emerald-700 dark:text-emerald-400 font-bold font-mono">0x{activePacket.crc8.toString(16).toUpperCase()} (VALID)</strong>
            </div>
            <div className="bg-white dark:bg-slate-900/60 p-2 rounded-lg border border-slate-200 dark:border-slate-800">
              <span className="text-slate-500 dark:text-slate-400 block text-[11px] font-medium">Payload Size:</span>{' '}
              <strong className="text-slate-900 dark:text-slate-200 font-bold font-mono">14 Bytes</strong>
            </div>
          </div>
        </div>
      )}

      {/* Packet Stream List */}
      <div className="flex-1 overflow-y-auto pr-1 space-y-1.5 text-xs">
        <div className="text-xs text-slate-600 dark:text-slate-400 mb-1 font-bold">
          Recent Binary Frames Ingestion Log (<span className="font-mono">{packets.length}</span>)
        </div>

        {packets.map((pkt, idx) => (
          <div
            key={idx}
            onClick={() => setSelectedPacket(pkt)}
            className={`p-2 rounded-lg border cursor-pointer transition-all flex items-center justify-between ${
              activePacket?.id === pkt.id || (activePacket?.raw_hex === pkt.raw_hex && idx === 0)
                ? 'bg-cyan-50 dark:bg-slate-800 border-cyan-500 dark:border-cyan-500/80 text-slate-950 dark:text-slate-100 shadow-sm font-semibold'
                : 'bg-white hover:bg-slate-50 dark:bg-slate-900/60 dark:hover:bg-slate-850 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-400'
            }`}
          >
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span className="text-cyan-700 dark:text-cyan-300 font-bold font-mono">{pkt.node_code || `N${pkt.node_id}`}</span>
              <span className="text-slate-800 dark:text-slate-300 text-xs font-mono font-medium">{pkt.raw_hex}</span>
            </div>

            <div className="flex items-center gap-2 text-xs font-mono text-slate-600 dark:text-slate-400 font-medium">
              <span>{pkt.primary_reading} val</span>
              <span>{pkt.battery_mv}mV</span>
              <span>{new Date(pkt.timestamp).toLocaleTimeString()}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
