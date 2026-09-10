import React from 'react';
import { SMSLog, Alert } from '../types';
import { 
  Send, 
  CheckCircle2, 
  Radio, 
  Cpu, 
  Zap, 
  ShieldAlert, 
  Smartphone, 
  Users,
  MessageSquare,
  ArrowRight
} from 'lucide-react';

interface AlertSMSPipelineProps {
  smsLogs: SMSLog[];
  alerts: Alert[];
  onOpenSMSModal: () => void;
  theme?: 'dark' | 'light';
}

export const AlertSMSPipeline: React.FC<AlertSMSPipelineProps> = ({
  smsLogs,
  alerts,
  onOpenSMSModal,
  theme = 'dark'
}) => {
  const isDark = theme === 'dark';
  const hasAlerts = alerts.filter(a => a.status !== 'RESOLVED').length > 0;
  const hasSentSms = smsLogs.length > 0;

  const PIPELINE_STEPS = [
    { id: 1, name: '1. Sensor Probe', desc: 'Radar & Optical Probe', icon: Radio, status: 'RECEIVED' },
    { id: 2, name: '2. LoRaWAN Mesh', desc: '865 MHz ISM Network', icon: Radio, status: 'PROCESSED' },
    { id: 3, name: '3. Edge AI', desc: 'Baseline Z-Scores', icon: Cpu, status: 'CLASSIFIED' },
    { id: 4, name: '4. Risk Engine', desc: 'Hydraulic Wave Model', icon: Zap, status: 'CLASSIFIED' },
    { id: 5, name: '5. Alert Engine', desc: 'Threshold Verification', icon: ShieldAlert, status: hasAlerts ? 'ALERT GENERATED' : 'MONITORING' },
    { id: 6, name: '6. GSM Gateway', desc: 'Cellular Broadcast', icon: Smartphone, status: hasSentSms ? 'SMS DISPATCHED' : 'STANDBY' },
    { id: 7, name: '7. Citizens & SDRF', desc: 'Villages & Wardens', icon: Users, status: hasSentSms ? 'DELIVERED' : 'STANDBY' },
  ];

  return (
    <div className={`p-4 rounded-xl border ${
      isDark ? 'bg-slate-900/80 border-slate-800' : 'bg-white border-slate-200 shadow-xs'
    } text-xs font-sans flex flex-col gap-3 h-full`}>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
        <div className="flex items-center gap-2">
          <Smartphone className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
          <span className="font-bold text-sm text-slate-900 dark:text-slate-100">
            Emergency Alert & Citizen SMS Workflow Pipeline
          </span>
        </div>

        <button
          onClick={onOpenSMSModal}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold text-xs text-white bg-gradient-to-r from-amber-600 to-red-600 hover:from-amber-500 hover:to-red-500 border border-amber-400/40 shadow-sm transition-all"
        >
          <Send className="w-3.5 h-3.5" />
          <span>Manual Emergency Broadcast</span>
        </button>
      </div>

      {/* Visual Pipeline Stepper */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
        {PIPELINE_STEPS.map((step) => {
          const IconComp = step.icon;
          const isFinished = step.status === 'RECEIVED' || step.status === 'PROCESSED' || step.status === 'CLASSIFIED' || (hasAlerts && step.id <= 5) || (hasSentSms && step.id >= 6);

          return (
            <div
              key={step.id}
              className={`p-2.5 rounded-xl border flex flex-col justify-between transition-all ${
                isFinished
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-400/60 text-emerald-900 dark:text-emerald-200 shadow-xs'
                  : isDark ? 'bg-slate-950 border-slate-800 text-slate-400' : 'bg-slate-50 border-slate-200 text-slate-600'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <IconComp className={`w-3.5 h-3.5 ${isFinished ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`} />
                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                  isFinished ? 'bg-emerald-600 text-white' : 'bg-slate-200 dark:bg-slate-800 text-slate-500'
                }`}>
                  {isFinished ? '✓ OK' : 'IDLE'}
                </span>
              </div>
              <div className="font-bold text-[11px] truncate text-slate-900 dark:text-slate-100">{step.name}</div>
              <div className="text-[10px] text-slate-500 truncate">{step.desc}</div>
              <div className={`text-[9px] font-bold tracking-wider mt-1 pt-1 border-t border-slate-200 dark:border-slate-800/80 ${
                isFinished ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-400'
              }`}>
                {step.status}
              </div>
            </div>
          );
        })}
      </div>

      {/* Recent Dispatches Log Table */}
      <div className="flex-1 flex flex-col gap-1.5 min-h-[160px]">
        <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
          <span className="flex items-center gap-1.5">
            <MessageSquare className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
            Citizen SMS Transmission Records (<span className="font-mono">{smsLogs.length}</span>)
          </span>
          <span className="text-[10px] text-slate-500 font-medium">GSM Edge Gateway</span>
        </div>

        {smsLogs.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-slate-500 text-xs border border-dashed border-slate-300 dark:border-slate-800 rounded-xl">
            <Smartphone className="w-8 h-8 text-slate-400 dark:text-slate-600 mb-1" />
            <p>No emergency SMS broadcasts sent yet. Automated warning SMS fires when hazard <span className="font-mono font-semibold text-slate-700 dark:text-slate-300">Z &gt; 3.0σ</span>.</p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto space-y-2 max-h-[220px] pr-1">
            {smsLogs.map((sms) => (
              <div
                key={sms.id}
                className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/70 flex flex-col gap-1.5 shadow-xs"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800 pb-1 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-900 dark:text-slate-100">{sms.recipient_group}</span>
                    <span className="text-[11px] text-slate-500">(<span className="font-mono font-medium">{sms.recipient_count}</span> local citizens)</span>
                  </div>
                  <div className="flex items-center gap-2 text-[11px]">
                    <span className="text-slate-500 font-mono">{new Date(sms.timestamp).toLocaleTimeString()}</span>
                    <span className="px-2 py-0.5 rounded-full font-bold text-[10px] bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-600/50">
                      ✓ {sms.status}
                    </span>
                  </div>
                </div>

                <div className="bg-white dark:bg-slate-900 p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 text-xs font-sans text-slate-800 dark:text-slate-200 leading-relaxed">
                  {sms.message_body}
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-500">
                  <span>Routing: <strong className="font-mono text-slate-700 dark:text-slate-300">{sms.channel}</strong></span>
                  <span>Broadcast Preview: <strong className="font-mono text-slate-700 dark:text-slate-300">{sms.phone_preview}</strong></span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
