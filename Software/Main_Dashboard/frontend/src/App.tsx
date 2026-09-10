import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Header } from './components/Header';
import { KPIBanner } from './components/KPIBanner';
import { MapPanel } from './components/MapPanel';
import { FloodPropagationETA } from './components/FloodPropagationETA';
import { NodeDetails } from './components/NodeDetails';
import { ChartsPanel } from './components/ChartsPanel';
import { AlertsPanel } from './components/AlertsPanel';
import { AlertSMSPipeline } from './components/AlertSMSPipeline';
import { NodeHealthTable } from './components/NodeHealthTable';
import { SystemHealthPage } from './components/SystemHealthPage';
import { PacketInspector } from './components/PacketInspector';
import { CitizenSMSModal } from './components/CitizenSMSModal';
import { AddNodeModal } from './components/AddNodeModal';
import { api } from './services/api';
import { useWebSocket } from './services/websocket';
import { 
  SensorNode, 
  Reading, 
  Alert, 
  LoRaPacket, 
  SMSLog, 
  BaselineStats, 
  SystemHealth,
  CorrelationAnalytics,
  TravelTimeInfo,
  ActiveSurge
} from './types';
import { 
  BarChart3, 
  ShieldAlert, 
  Terminal, 
  Activity,
  Cpu,
  Workflow
} from 'lucide-react';
import { hazardAudio } from './utils/audio';

export const App: React.FC = () => {
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    return (localStorage.getItem('ein_theme') as 'dark' | 'light') || 'dark';
  });

  const [isBuzzerMuted, setIsBuzzerMuted] = useState<boolean>(() => hazardAudio.getMuted());
  const [nodes, setNodes] = useState<SensorNode[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<number>(1);
  const [readings, setReadings] = useState<Reading[]>([]);
  const [latestReadings, setLatestReadings] = useState<Record<string, Reading>>({});
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [packets, setPackets] = useState<LoRaPacket[]>([]);
  const [smsLogs, setSmsLogs] = useState<SMSLog[]>([]);
  const [baselines, setBaselines] = useState<BaselineStats[]>([]);
  const [systemHealth, setSystemHealth] = useState<SystemHealth | null>(null);
  const [correlation, setCorrelation] = useState<CorrelationAnalytics | null>(null);
  const [travelTime, setTravelTime] = useState<TravelTimeInfo | null>(null);
  const [activeSurge, setActiveSurge] = useState<ActiveSurge | null>(null);
  const [bottomTab, setBottomTab] = useState<'charts' | 'alerts' | 'pipeline' | 'nodes' | 'diagnostics' | 'packets'>('charts');
  const [isSMSModalOpen, setIsSMSModalOpen] = useState<boolean>(false);
  const [isAddNodeModalOpen, setIsAddNodeModalOpen] = useState<boolean>(false);

  // Determine if there is an active hazard / disaster state
  const isHazardActive = Boolean(
    (systemHealth?.simulation_state && systemHealth.simulation_state !== 'IDLE_MONITORING') ||
    (systemHealth?.active_alerts_count || 0) > 0 ||
    (activeSurge !== null && activeSurge.status !== 'RESOLVED')
  );

  // Trigger or stop emergency hazard siren based on hazard state & mute status
  useEffect(() => {
    if (isHazardActive && !isBuzzerMuted) {
      hazardAudio.startAlarm();
    } else {
      hazardAudio.stopAlarm();
    }

    return () => {
      hazardAudio.stopAlarm();
    };
  }, [isHazardActive, isBuzzerMuted]);

  const handleToggleBuzzer = () => {
    const updatedMute = hazardAudio.toggleMute();
    setIsBuzzerMuted(updatedMute);
    if (updatedMute) {
      hazardAudio.stopAlarm();
    }
  };

  // Sync theme with document class and localStorage
  useEffect(() => {
    localStorage.setItem('ein_theme', theme);
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
    } else {
      document.documentElement.classList.add('light');
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  const handleToggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  // Load initial data via REST API
  const fetchInitialData = useCallback(async () => {
    try {
      const [
        nodesData,
        readingsData,
        alertsData,
        packetsData,
        smsData,
        baselinesData,
        healthData
      ] = await Promise.all([
        api.getNodes(),
        api.getReadings(undefined, 100),
        api.getAlerts(),
        api.getPackets(30),
        api.getSMSLogs(30),
        api.getBaselines(),
        api.getSystemHealth()
      ]);

      setNodes(nodesData);
      setReadings(readingsData);
      setAlerts(alertsData);
      setPackets(packetsData);
      setSmsLogs(smsData);
      setBaselines(baselinesData);
      setSystemHealth(healthData);

      // Populate latest readings dictionary
      const latestMap: Record<string, Reading> = {};
      readingsData.forEach(r => {
        const code = r.node_code || `N${r.node_id}`;
        latestMap[code] = r;
      });
      setLatestReadings(latestMap);
    } catch (err) {
      console.error('[PRAKRITINETX Error fetching initial data]', err);
    }
  }, []);

  useEffect(() => {
    fetchInitialData();
  }, [fetchInitialData]);

  // WebSocket live updates handler
  const handleWsMessage = useCallback((message: any) => {
    if (message.type === 'INITIAL_STATE') {
      if (message.nodes) setNodes(message.nodes);
      if (message.recent_alerts) setAlerts(message.recent_alerts);
      if (message.recent_packets) setPackets(message.recent_packets);
      if (message.recent_sms) setSmsLogs(message.recent_sms);
      if (message.active_surge) setActiveSurge(message.active_surge);
    } else if (message.type === 'NEW_SMS' && message.sms) {
      setSmsLogs(prev => [message.sms, ...prev]);
    } else if (message.type === 'NEW_NODE' && message.node) {
      setNodes(prev => {
        if (prev.some(n => n.node_code === message.node.node_code || n.id === message.node.id)) return prev;
        return [...prev, message.node];
      });
    } else if (message.type === 'CYCLE_UPDATE') {
      // 1. Update Telemetry
      if (message.telemetry && Array.isArray(message.telemetry)) {
        setReadings(prev => {
          const updated = [...prev, ...message.telemetry];
          return updated.slice(-150);
        });

        setLatestReadings(prev => {
          const updated = { ...prev };
          message.telemetry.forEach((t: Reading) => {
            updated[t.node_code || `N${t.node_id}`] = t;
          });
          return updated;
        });

        // Update nodes status and battery
        setNodes(prev => prev.map(n => {
          const match = message.telemetry.find((t: any) => t.node_code === n.node_code);
          if (match) {
            return {
              ...n,
              status: match.status || n.status,
              battery_mv: match.battery_mv || n.battery_mv,
              battery_pct: match.battery_pct || n.battery_pct,
              last_seen: match.timestamp || n.last_seen
            };
          }
          return n;
        }));
      }

      // 2. Update Packets
      if (message.recent_packets && Array.isArray(message.recent_packets)) {
        setPackets(prev => {
          const combined = [...message.recent_packets, ...prev];
          return combined.slice(0, 40);
        });
      }

      // 3. Update Alerts & SMS
      if (message.new_alerts && message.new_alerts.length > 0) {
        setAlerts(prev => [...message.new_alerts, ...prev]);
        api.getSMSLogs(30).then(setSmsLogs).catch(console.error);
      }

      // 4. Update System Health & Wave Physics
      if (message.system_health) setSystemHealth(message.system_health);
      if (message.correlation) setCorrelation(message.correlation);
      if (message.travel_time_estimate) setTravelTime(message.travel_time_estimate);
      if (message.active_surge !== undefined) setActiveSurge(message.active_surge);
    }
  }, []);

  const { isConnected, sendAction } = useWebSocket({
    url: 'ws://localhost:8000/ws',
    onMessage: handleWsMessage
  });

  // Multi-Hazard Scenario Trigger Handler
  const handleTriggerEvent = async (eventType: string, speed?: number) => {
    try {
      await api.triggerEvent(eventType, speed);
      const actionMap: Record<string, string> = {
        flood: 'TRIGGER_FLOOD',
        fire: 'TRIGGER_FIRE',
        air: 'TRIGGER_AIR',
        heat: 'TRIGGER_HEAT',
        landslide: 'TRIGGER_LANDSLIDE',
        chemical: 'TRIGGER_CHEMICAL',
        water: 'TRIGGER_WATER',
      };
      const action = actionMap[eventType] || 'TRIGGER_FLOOD';
      sendAction(action, { speed });
    } catch (e) {
      console.error(e);
    }
  };

  const handleReset = async () => {
    try {
      hazardAudio.stopAlarm();
      setActiveSurge(null);
      await api.triggerEvent('reset');
      sendAction('RESET');
      fetchInitialData();
    } catch (e) {
      console.error(e);
    }
  };

  const handlePause = async () => {
    try {
      await api.triggerEvent('pause');
      sendAction('PAUSE');
    } catch (e) {
      console.error(e);
    }
  };

  const handleResume = async () => {
    try {
      await api.triggerEvent('resume');
      sendAction('RESUME');
    } catch (e) {
      console.error(e);
    }
  };

  const handleSpeedChange = async (speed: number) => {
    try {
      await api.triggerEvent('speed', speed);
      sendAction('SET_SPEED', { speed });
    } catch (e) {
      console.error(e);
    }
  };

  const handleAcknowledgeAlert = async (id: number) => {
    try {
      await api.acknowledgeAlert(id);
      setAlerts(prev => prev.map(a => a.id === id ? { ...a, status: 'ACKNOWLEDGED' } : a));
    } catch (e) {
      console.error(e);
    }
  };

  const handleResolveAlert = async (id: number) => {
    try {
      await api.resolveAlert(id);
      setAlerts(prev => prev.map(a => a.id === id ? { ...a, status: 'RESOLVED' } : a));
    } catch (e) {
      console.error(e);
    }
  };

  const selectedNode = useMemo(() => {
    return nodes.find(n => n.id === selectedNodeId) || nodes[0] || null;
  }, [nodes, selectedNodeId]);

  const selectedNodeReading = useMemo(() => {
    if (!selectedNode) return null;
    return latestReadings[selectedNode.node_code] || null;
  }, [selectedNode, latestReadings]);

  const selectedNodePacket = useMemo(() => {
    if (!selectedNode) return null;
    return packets.find(p => p.node_id === selectedNode.id || p.node_code === selectedNode.node_code) || null;
  }, [selectedNode, packets]);

  const handleNodeAdded = (newNode: SensorNode) => {
    setNodes(prev => {
      if (prev.some(n => n.node_code === newNode.node_code || n.id === newNode.id)) return prev;
      return [...prev, newNode];
    });
    setSelectedNodeId(newNode.id);
  };

  const isDark = theme === 'dark';

  return (
    <div className={`min-h-screen flex flex-col transition-colors duration-300 ${
      isDark ? 'bg-[#070a10] text-slate-100' : 'bg-slate-100 text-slate-900'
    } overflow-x-hidden font-sans`}>
      {/* 1. Header Command Bar & Hazard Simulation Engine */}
      <Header
        systemHealth={systemHealth}
        isConnected={isConnected}
        theme={theme}
        isBuzzerMuted={isBuzzerMuted}
        isAlarmActive={isHazardActive}
        onToggleTheme={handleToggleTheme}
        onToggleBuzzer={handleToggleBuzzer}
        onTriggerEvent={handleTriggerEvent}
        onOpenSMSModal={() => setIsSMSModalOpen(true)}
        onOpenAddNodeModal={() => setIsAddNodeModalOpen(true)}
        onReset={handleReset}
        onPause={handlePause}
        onResume={handleResume}
        onSpeedChange={handleSpeedChange}
      />

      {/* 2. Modals */}
      <CitizenSMSModal
        isOpen={isSMSModalOpen}
        onClose={() => setIsSMSModalOpen(false)}
        onSMSSent={(newSms) => setSmsLogs(prev => [newSms, ...prev])}
      />

      <AddNodeModal
        isOpen={isAddNodeModalOpen}
        onClose={() => setIsAddNodeModalOpen(false)}
        existingNodes={nodes}
        onNodeAdded={handleNodeAdded}
      />

      {/* 3. Main Command Center Workspace */}
      <main className="flex-1 p-3 md:p-4 flex flex-col gap-3.5 max-w-[1920px] w-full mx-auto">
        {/* Quick Scan Operational KPI Banner */}
        <KPIBanner
          alerts={alerts}
          nodes={nodes}
          systemHealth={systemHealth}
          theme={theme}
        />

        {/* Primary Command Workspace (Hero Map 58-60% + Node Details 40-42%) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 items-stretch">
          {/* Left Column (7 cols): Map Hero Panel + Hydrodynamic River Valley Wave ETA Stepper */}
          <div className="lg:col-span-7 flex flex-col gap-3.5">
            <div className="min-h-[500px] flex-1">
              <MapPanel
                nodes={nodes}
                selectedNodeId={selectedNodeId}
                onSelectNode={setSelectedNodeId}
                activeSurge={activeSurge}
                latestReadings={latestReadings}
                theme={theme}
              />
            </div>

            {/* Hydrodynamic Wave Propagation & Downstream Lead-Time Card */}
            <FloodPropagationETA
              activeSurge={activeSurge}
              travelTime={travelTime}
              theme={theme}
            />
          </div>

          {/* Right Column (5 cols): Selected Node AI Risk Score, Telemetry, and Explainable Evidence */}
          <div className="lg:col-span-5 flex flex-col">
            <NodeDetails
              node={selectedNode}
              reading={selectedNodeReading}
              baselines={baselines}
              latestPacket={selectedNodePacket}
              theme={theme}
              nodes={nodes}
              onSelectNode={setSelectedNodeId}
            />
          </div>
        </div>

        {/* 4. Bottom Operations & Incident Center (Tabbed Navigation) */}
        <div className="w-full flex flex-col gap-2 mt-1">
          {/* Navigation Tab Bar */}
          <div className={`flex flex-wrap items-center justify-between border-b pb-1.5 px-1 font-sans text-xs gap-2 ${
            isDark ? 'border-slate-800' : 'border-slate-300'
          }`}>
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                onClick={() => setBottomTab('charts')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
                  bottomTab === 'charts'
                    ? 'bg-cyan-500 text-slate-950 font-bold shadow-md shadow-cyan-500/30'
                    : isDark ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-900 font-medium' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200 font-medium'
                }`}
              >
                <BarChart3 className="w-3.5 h-3.5" />
                <span>Sensor Trends</span>
              </button>

              <button
                onClick={() => setBottomTab('alerts')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
                  bottomTab === 'alerts'
                    ? 'bg-rose-500 text-white font-bold shadow-md shadow-rose-500/30'
                    : isDark ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-900 font-medium' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200 font-medium'
                }`}
              >
                <ShieldAlert className="w-3.5 h-3.5" />
                <span>Alerts & Incidents (<span className="font-mono">{alerts.filter(a => a.status !== 'RESOLVED').length}</span>)</span>
              </button>

              <button
                onClick={() => setBottomTab('pipeline')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
                  bottomTab === 'pipeline'
                    ? 'bg-emerald-500 text-slate-950 font-bold shadow-md shadow-emerald-500/30'
                    : isDark ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-900 font-medium' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200 font-medium'
                }`}
              >
                <Workflow className="w-3.5 h-3.5" />
                <span>Alert ➔ SMS Pipeline</span>
              </button>

              <button
                onClick={() => setBottomTab('nodes')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
                  bottomTab === 'nodes'
                    ? 'bg-cyan-500 text-slate-950 font-bold shadow-md shadow-cyan-500/30'
                    : isDark ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-900 font-medium' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200 font-medium'
                }`}
              >
                <Activity className="w-3.5 h-3.5" />
                <span>Node Health Matrix (<span className="font-mono">{nodes.length}</span>)</span>
              </button>

              <button
                onClick={() => setBottomTab('diagnostics')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
                  bottomTab === 'diagnostics'
                    ? 'bg-cyan-500 text-slate-950 font-bold shadow-md shadow-cyan-500/30'
                    : isDark ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-900 font-medium' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200 font-medium'
                }`}
              >
                <Cpu className="w-3.5 h-3.5" />
                <span>Gateway Diagnostics</span>
              </button>

              <button
                onClick={() => setBottomTab('packets')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
                  bottomTab === 'packets'
                    ? 'bg-indigo-500 text-white font-bold shadow-md shadow-indigo-500/30'
                    : isDark ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-900 font-medium' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200 font-medium'
                }`}
              >
                <Terminal className="w-3.5 h-3.5" />
                <span>LoRa 14-Byte Inspector</span>
              </button>
            </div>

            <div className={`hidden sm:flex items-center gap-2 text-xs font-medium ${
              isDark ? 'text-slate-500' : 'text-slate-500'
            }`}>
              <span>PRAKRITINETX Command Hub</span>
              <span>•</span>
              <span className="text-emerald-500 font-semibold">100% Offline Edge Operation</span>
            </div>
          </div>

          {/* Active Tab Panel Content */}
          <div className="w-full">
            {bottomTab === 'charts' && <ChartsPanel readings={readings} />}
            {bottomTab === 'alerts' && (
              <AlertsPanel
                alerts={alerts}
                smsLogs={smsLogs}
                onAcknowledgeAlert={handleAcknowledgeAlert}
                onResolveAlert={handleResolveAlert}
              />
            )}
            {bottomTab === 'pipeline' && (
              <AlertSMSPipeline
                smsLogs={smsLogs}
                alerts={alerts}
                onOpenSMSModal={() => setIsSMSModalOpen(true)}
                theme={theme}
              />
            )}
            {bottomTab === 'nodes' && (
              <NodeHealthTable
                nodes={nodes}
                selectedNodeId={selectedNodeId}
                onSelectNode={setSelectedNodeId}
                theme={theme}
              />
            )}
            {bottomTab === 'diagnostics' && (
              <SystemHealthPage
                systemHealth={systemHealth}
                nodes={nodes}
                theme={theme}
              />
            )}
            {bottomTab === 'packets' && <PacketInspector packets={packets} />}
          </div>
        </div>
      </main>
    </div>
  );
};

export default App;

