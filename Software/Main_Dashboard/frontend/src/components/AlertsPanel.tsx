import React, { useState } from 'react';
import { Alert, SMSLog } from '../types';
import { 
  AlertTriangle, 
  MessageSquare, 
  CheckCircle2, 
  ShieldAlert, 
  Send, 
  ChevronDown,
  ChevronRight,
  Radio,
  Clock,
  Zap,
  Activity,
  UserCheck,
  Shield
} from 'lucide-react';

interface AlertsPanelProps {
  alerts: Alert[];
  smsLogs: SMSLog[];
  onAcknowledgeAlert: (id: number) => void;
  onResolveAlert: (id: number) => void;
}

export const AlertsPanel: React.FC<AlertsPanelProps> = ({
  alerts,
  smsLogs,
  onAcknowledgeAlert,
  onResolveAlert,
}) => {
  const [activeTab, setActiveTab] = useState<'alerts' | 'sms'>('alerts');
  const [severityFilter, setSeverityFilter] = useState<'ALL' | 'CRITICAL' | 'WARNING'>('ALL');
  const [expandedAlertId, setExpandedAlertId] = useState<number | null>(null);

  const filteredAlerts = alerts.filter(a => {
    if (severityFilter === 'ALL') return true;
    return a.severity === severityFilter;
  });

  const getRecommendedAction = (hazardType: string, nodeCode: string) => {
    const h = (hazardType || '').toUpperCase();
    if (h.includes('FLOOD')) {
      return `Evacuate low-lying riverbanks near ${nodeCode} (elev < 370m). Deploy SDRF Unit 4 and activate local siren at Ghat stations.`;
    } else if (h.includes('FIRE') || h.includes('SMOKE')) {
      return `Dispatch Forest Fire Response Quick-Reaction Team to ${nodeCode} perimeter. Establish 50m firebreak and notify regional station.`;
    } else if (h.includes('SLOPE') || h.includes('LANDSLIDE')) {
      return `Halt vehicular traffic on NH-58 stretch near ${nodeCode}. Inspect retaining wall anchor pins and deploy slope stabilization team.`;
    } else if (h.includes('AIR') || h.includes('AQI')) {
      return `Issue public advisory for sensitive groups in ${nodeCode} sector. Restrict heavy diesel vehicle movement and monitor PM2.5.`;
    } else if (h.includes('WATER') || h.includes('CHEMICAL')) {
      return `Close raw water intake gates at downstream filtration plant. Initiate secondary chemical assay for industrial contaminant discharge.`;
    }
    return `Verify node ${nodeCode} primary sensor calibration and review multi-hop telemetry stream on LoRa Channel 14.`;
  };

  return (
    <div className="glass-panel p-4 rounded-xl flex flex-col gap-3 h-full border border-slate-200 dark:border-slate-800 font-sans">
      {/* Panel Header & Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-rose-500" />
          <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 font-sans">
            Disaster Incidents & Emergency SMS Dispatch
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Severity filter (only for alerts tab) */}
          {activeTab === 'alerts' && (
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-0.5 text-[11px] font-sans">
              <button
                onClick={() => setSeverityFilter('ALL')}
                className={`px-2 py-0.5 rounded transition font-medium ${severityFilter === 'ALL' ? 'bg-slate-700 text-white font-semibold' : 'text-slate-500 hover:text-slate-300'}`}
              >
                All ({alerts.length})
              </button>
              <button
                onClick={() => setSeverityFilter('CRITICAL')}
                className={`px-2 py-0.5 rounded transition font-medium ${severityFilter === 'CRITICAL' ? 'bg-rose-500 text-white font-semibold' : 'text-slate-500 hover:text-rose-400'}`}
              >
                Critical ({alerts.filter(a => a.severity === 'CRITICAL').length})
              </button>
              <button
                onClick={() => setSeverityFilter('WARNING')}
                className={`px-2 py-0.5 rounded transition font-medium ${severityFilter === 'WARNING' ? 'bg-amber-500 text-slate-950 font-semibold' : 'text-slate-500 hover:text-amber-400'}`}
              >
                Warning ({alerts.filter(a => a.severity === 'WARNING').length})
              </button>
            </div>
          )}

          {/* Tab Buttons */}
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-0.5 text-xs font-sans">
            <button
              onClick={() => setActiveTab('alerts')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded transition-all font-semibold ${
                activeTab === 'alerts'
                  ? 'bg-rose-500 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 font-medium'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              Incident Queue ({alerts.length})
            </button>
            <button
              onClick={() => setActiveTab('sms')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded transition-all font-semibold ${
                activeTab === 'sms'
                  ? 'bg-cyan-500 text-slate-950 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 font-medium'
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              SMS Broadcasts ({smsLogs.length})
            </button>
          </div>
        </div>
      </div>

      {/* Tab 1: Live Alerts View */}
      {activeTab === 'alerts' && (
        <div className="flex-1 overflow-y-auto pr-1">
          {filteredAlerts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-500 dark:text-slate-400 font-sans text-xs">
              <CheckCircle2 className="w-9 h-9 text-emerald-500/80 mb-2" />
              <span className="font-semibold text-slate-300 text-sm">All environmental parameters nominal</span>
              <span className="text-xs text-slate-500 mt-0.5">No critical threshold anomalies or flood wave triggers active</span>
            </div>
          ) : (
            <div className="space-y-2.5">
              {filteredAlerts.map((alert) => {
                const isCritical = alert.severity === 'CRITICAL';
                const isNew = alert.status === 'NEW';
                const isExpanded = expandedAlertId === alert.id;
                const recAction = getRecommendedAction(alert.hazard_type, alert.node_code);

                return (
                  <div
                    key={alert.id}
                    className={`rounded-xl border text-xs font-sans transition-all overflow-hidden ${
                      isCritical
                        ? 'bg-rose-50/70 dark:bg-rose-950/30 border-rose-300 dark:border-rose-600/50 shadow-sm'
                        : 'bg-amber-50/70 dark:bg-amber-950/20 border-amber-300 dark:border-amber-600/40'
                    }`}
                  >
                    {/* Header Row */}
                    <div 
                      onClick={() => setExpandedAlertId(isExpanded ? null : alert.id)}
                      className="p-3 cursor-pointer flex flex-wrap items-center justify-between gap-2 hover:bg-black/5 dark:hover:bg-white/5 transition"
                    >
                      <div className="flex items-center gap-2">
                        <button className="text-slate-400 hover:text-slate-200 p-0.5">
                          {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                        </button>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider ${
                            isCritical
                              ? 'bg-rose-600 text-white animate-pulse'
                              : 'bg-amber-500 text-slate-950 font-semibold'
                          }`}
                        >
                          {alert.severity}
                        </span>
                        <span className="text-cyan-700 dark:text-cyan-300 font-bold font-mono text-sm">{alert.node_code}</span>
                        <span className="text-slate-400 text-[10px]">•</span>
                        <span className="text-slate-800 dark:text-slate-200 font-semibold">{alert.hazard_type}</span>
                        <span className="text-slate-500 dark:text-slate-400 text-[11px] flex items-center gap-1 font-mono">
                          <Clock className="w-3 h-3" />
                          {new Date(alert.timestamp).toLocaleTimeString()}
                        </span>
                      </div>

                      {/* Status and Action Buttons */}
                      <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider ${
                            isNew
                              ? 'bg-rose-100 dark:bg-rose-900/80 text-rose-800 dark:text-rose-200 border border-rose-300 dark:border-rose-500'
                              : alert.status === 'ACKNOWLEDGED'
                              ? 'bg-amber-100 dark:bg-amber-900/80 text-amber-800 dark:text-amber-200 border border-amber-300 dark:border-amber-500'
                              : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-400'
                          }`}
                        >
                          {alert.status}
                        </span>

                        {isNew && (
                          <button
                            onClick={() => onAcknowledgeAlert(alert.id)}
                            className="px-2.5 py-1 rounded bg-amber-500 hover:bg-amber-600 text-slate-950 font-semibold text-[10px] transition shadow-sm"
                          >
                            Acknowledge
                          </button>
                        )}

                        {alert.status !== 'RESOLVED' && (
                          <button
                            onClick={() => onResolveAlert(alert.id)}
                            className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-[10px] transition shadow-sm"
                          >
                            Resolve
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Summary Message */}
                    <div className="px-3 pb-2.5 text-slate-800 dark:text-slate-200 font-sans text-xs leading-relaxed font-normal">
                      {alert.message}
                    </div>

                    {/* Expandable Incident Action & Evidence Drawer */}
                    {isExpanded && (
                      <div className="p-3 bg-white/80 dark:bg-slate-950/80 border-t border-slate-200 dark:border-slate-800/80 space-y-2.5 animate-fadeIn">
                        {/* Evidence Metrics */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                          <div className="bg-slate-50 dark:bg-slate-900/90 p-2 rounded border border-slate-200 dark:border-slate-800">
                            <span className="text-slate-500 dark:text-slate-400 block text-[10px] font-sans">Statistical Anomaly</span>
                            <span className="font-bold font-mono text-rose-500 text-xs">+{alert.z_score.toFixed(2)}σ dev</span>
                          </div>
                          <div className="bg-slate-50 dark:bg-slate-900/90 p-2 rounded border border-slate-200 dark:border-slate-800">
                            <span className="text-slate-500 dark:text-slate-400 block text-[10px] font-sans">Rate of Change</span>
                            <span className="font-bold font-mono text-amber-500 text-xs">+{alert.rate_of_change.toFixed(1)}/min</span>
                          </div>
                          <div className="bg-slate-50 dark:bg-slate-900/90 p-2 rounded border border-slate-200 dark:border-slate-800">
                            <span className="text-slate-500 dark:text-slate-400 block text-[10px] font-sans">Trigger Rule</span>
                            <span className="font-semibold text-cyan-400 text-xs truncate block font-sans">{alert.trigger_rule}</span>
                          </div>
                          <div className="bg-slate-50 dark:bg-slate-900/90 p-2 rounded border border-slate-200 dark:border-slate-800">
                            <span className="text-slate-500 dark:text-slate-400 block text-[10px] font-sans">Incident ID</span>
                            <span className="font-medium font-mono text-slate-300 text-xs">#INC-{alert.id.toString().padStart(4, '0')}</span>
                          </div>
                        </div>

                        {/* Standard Operating Procedure (SOP) Action Recommendation */}
                        <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-2.5 text-xs font-sans">
                          <div className="flex items-center gap-1.5 text-amber-400 font-semibold text-xs mb-1">
                            <Shield className="w-3.5 h-3.5" />
                            Recommended Incident Action (SOP)
                          </div>
                          <div className="text-slate-800 dark:text-amber-100/90 text-xs leading-relaxed font-normal">
                            {recAction}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Tab 2: GSM SMS Broadcast Log */}
      {activeTab === 'sms' && (
        <div className="flex-1 overflow-y-auto pr-1">
          {smsLogs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-500 dark:text-slate-400 font-mono text-xs">
              <MessageSquare className="w-9 h-9 text-slate-400 dark:text-slate-600 mb-2" />
              <span className="font-bold text-slate-300">No emergency SMS dispatches recorded</span>
              <span className="text-[11px] text-slate-500 mt-0.5">Automated SMS alerts trigger when anomaly severity exceeds 3.0σ</span>
            </div>
          ) : (
            <div className="space-y-2.5">
              {smsLogs.map((sms) => (
                <div
                  key={sms.id}
                  className="bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-xs font-mono shadow-sm"
                >
                  <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-1.5 mb-2">
                    <div className="flex items-center gap-2">
                      <Send className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
                      <span className="text-slate-900 dark:text-slate-200 font-bold">{sms.recipient_group}</span>
                      <span className="text-slate-500 dark:text-slate-400 text-[10px]">({sms.recipient_count} recipients)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-slate-500 dark:text-slate-400">
                        {new Date(sms.timestamp).toLocaleTimeString()}
                      </span>
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-600/40">
                        {sms.status}
                      </span>
                    </div>
                  </div>

                  {/* SMS Body */}
                  <div className="bg-white dark:bg-slate-950 p-2.5 rounded-lg border border-slate-200 dark:border-slate-800/80 text-slate-800 dark:text-cyan-200 font-sans text-xs leading-relaxed whitespace-pre-wrap shadow-inner font-medium">
                    {sms.message_body}
                  </div>

                  <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400 mt-2">
                    <span>Channel: {sms.channel}</span>
                    <span>Preview: {sms.phone_preview}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

