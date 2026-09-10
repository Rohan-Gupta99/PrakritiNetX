import React, { useEffect, useState } from 'react';
import { 
  Activity, 
  Radio, 
  Play, 
  Pause, 
  Zap, 
  RotateCcw, 
  Clock, 
  Layers, 
  Sliders, 
  Mountain, 
  Sun, 
  Moon,
  Bell,
  BellRing,
  BellOff,
  PlusCircle,
  Server,
  Sparkles,
  ShieldCheck,
  Send
} from 'lucide-react';
import { SystemHealth } from '../types';

interface HeaderProps {
  systemHealth: SystemHealth | null;
  isConnected: boolean;
  theme: 'dark' | 'light';
  isBuzzerMuted: boolean;
  isAlarmActive: boolean;
  onToggleTheme: () => void;
  onToggleBuzzer: () => void;
  onTriggerEvent: (eventType: string, speed?: number) => void;
  onOpenSMSModal: () => void;
  onOpenAddNodeModal: () => void;
  onReset: () => void;
  onPause: () => void;
  onResume: () => void;
  onSpeedChange: (speed: number) => void;
}

export const Header: React.FC<HeaderProps> = ({
  systemHealth,
  isConnected,
  theme,
  isBuzzerMuted,
  isAlarmActive,
  onToggleTheme,
  onToggleBuzzer,
  onTriggerEvent,
  onOpenSMSModal,
  onOpenAddNodeModal,
  onReset,
  onPause,
  onResume,
  onSpeedChange,
}) => {
  const [currentTime, setCurrentTime] = useState<string>('');
  const [speed, setSpeed] = useState<number>(systemHealth?.speed_multiplier || 1.0);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [selectedScenario, setSelectedScenario] = useState<string>('flood');

  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString('en-US', { hour12: false }) + ' IST');
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (systemHealth?.speed_multiplier) {
      setSpeed(systemHealth.speed_multiplier);
    }
  }, [systemHealth?.speed_multiplier]);

  const handleSpeedClick = (newSpeed: number) => {
    setSpeed(newSpeed);
    onSpeedChange(newSpeed);
  };

  const handleTogglePause = () => {
    if (isPaused) {
      onResume();
      setIsPaused(false);
    } else {
      onPause();
      setIsPaused(true);
    }
  };

  // Determine system alert state
  const isFloodActive = systemHealth?.simulation_state === 'FLOOD';
  const isLandslideActive = systemHealth?.simulation_state === 'LANDSLIDE';
  const isFireActive = systemHealth?.simulation_state === 'FIRE';
  const isAirActive = systemHealth?.simulation_state === 'AIR';
  const isHeatActive = systemHealth?.simulation_state === 'HEAT';
  const isChemicalActive = systemHealth?.simulation_state === 'CHEMICAL';
  const isWaterActive = systemHealth?.simulation_state === 'WATER';
  const hasCriticalAlerts = (systemHealth?.active_alerts_count || 0) > 0;
  const isAnyDisaster = systemHealth?.simulation_state && systemHealth.simulation_state !== 'IDLE_MONITORING';

  const isDark = theme === 'dark';

  return (
    <header className={`w-full flex flex-col shadow-md z-30 transition-colors ${
      isDark 
        ? 'bg-[#080d18] border-b border-slate-800 text-slate-100' 
        : 'bg-white border-b border-slate-200 text-slate-900'
    }`}>
      {/* ========================================================================= */}
      {/* ROW 1: Command Center Identity, Live Health, Gateway, & Top Controls      */}
      {/* ========================================================================= */}
      <div className={`w-full px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 border-b ${
        isDark ? 'border-slate-800/80' : 'border-slate-200'
      }`}>
        {/* Left: Brand Identity & Subtitle */}
        <div className="flex items-center gap-3">
          <div className="relative flex items-center justify-center w-9 h-9 rounded-xl bg-cyan-950/60 border border-cyan-500/40 text-cyan-400 shadow-inner">
            <Radio className="w-4 h-4 animate-pulse" />
            <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${isConnected ? 'bg-emerald-400' : 'bg-rose-400'} opacity-75`}></span>
              <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${isConnected ? 'bg-emerald-500' : 'bg-rose-500'}`}></span>
            </span>
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h1 className={`text-base md:text-lg font-bold tracking-tight font-sans ${
                isDark ? 'text-cyan-400' : 'text-cyan-800'
              }`}>
                PRAKRITINETX
              </h1>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase tracking-wider font-sans ${
                isDark 
                  ? 'bg-cyan-950 text-cyan-300 border border-cyan-700/50' 
                  : 'bg-cyan-100 text-cyan-800 border border-cyan-300'
              }`}>
                Command Center v2.0
              </span>
            </div>
            <p className="text-xs font-sans text-slate-500 dark:text-slate-400 -mt-0.5 font-normal">
              Environmental Early Warning & Disaster Intelligence Network
            </p>
          </div>
        </div>

        {/* Center/Right: Live Command Indicators */}
        <div className="flex flex-wrap items-center gap-2.5 font-sans">
          {/* Status Pill */}
          <div className={`flex items-center gap-2 border rounded-lg px-2.5 py-1 text-xs transition-colors ${
            isDark ? 'bg-slate-900/90 border-slate-800 text-slate-300' : 'bg-slate-100 border-slate-300 text-slate-800'
          }`}>
            <span className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">System:</span>
            {isFloodActive || isFireActive || isAirActive || isChemicalActive || isWaterActive || hasCriticalAlerts ? (
              <span className="flex items-center gap-1.5 font-semibold text-rose-600 dark:text-rose-400 animate-pulse">
                <Activity className="w-3.5 h-3.5" />
                CRITICAL ALERT
              </span>
            ) : isLandslideActive || isHeatActive ? (
              <span className="flex items-center gap-1.5 font-semibold text-amber-600 dark:text-amber-400">
                <Mountain className="w-3.5 h-3.5" />
                WARNING ACTIVE
              </span>
            ) : (
              <span className="flex items-center gap-1.5 font-semibold text-emerald-600 dark:text-emerald-400">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                SYSTEM HEALTHY
              </span>
            )}
          </div>

          {/* Gateway Status Pill */}
          <div className={`hidden sm:flex items-center gap-1.5 border rounded-lg px-2.5 py-1 text-xs ${
            isDark ? 'bg-slate-900/90 border-slate-800 text-slate-300' : 'bg-slate-100 border-slate-300 text-slate-800'
          }`}>
            <Server className="w-3.5 h-3.5 text-emerald-500" />
            <span className="text-slate-400">Gateway: <strong className="text-emerald-600 dark:text-emerald-400 font-semibold uppercase">ONLINE</strong></span>
          </div>

          {/* Mesh Nodes Online */}
          <div className={`hidden sm:flex items-center gap-1.5 border rounded-lg px-2.5 py-1 text-xs ${
            isDark ? 'bg-slate-900/90 border-slate-800 text-slate-300' : 'bg-slate-100 border-slate-300 text-slate-800'
          }`}>
            <Layers className="w-3.5 h-3.5 text-indigo-500" />
            <span className="text-slate-400">Nodes: <strong className="text-indigo-600 dark:text-indigo-400 font-mono font-medium">{systemHealth?.nodes_online ?? 6}/6 Online</strong></span>
          </div>

          {/* IST Live Clock */}
          <div className={`flex items-center gap-1.5 border rounded-lg px-2.5 py-1 text-xs font-mono font-medium ${
            isDark ? 'bg-slate-900/90 border-slate-800 text-slate-200' : 'bg-slate-100 border-slate-300 text-slate-800'
          }`}>
            <Clock className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
            <span>{currentTime || '00:00:00 IST'}</span>
          </div>

          {/* Light / Dark Mode Toggle */}
          <button
            onClick={onToggleTheme}
            title={`Switch to ${isDark ? 'Light' : 'Dark'} Mode`}
            className={`p-2 rounded-lg border text-xs transition-all flex-shrink-0 ${
              isDark
                ? 'bg-slate-900 hover:bg-slate-800 text-amber-300 border-slate-700'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-300'
            }`}
          >
            {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-indigo-600" />}
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* ROW 2: Clear DEMO / SIMULATION MODE Bar with Multi-Hazard Controls       */}
      {/* ========================================================================= */}
      <div className={`w-full px-4 py-2 flex flex-wrap items-center justify-between gap-2.5 font-sans ${
        isDark ? 'bg-slate-950/80 border-b border-slate-800/60' : 'bg-slate-50 border-b border-slate-200'
      }`}>
        {/* Left: Simulation Mode Badge & Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Demo Mode Badge */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-950/50 border border-indigo-500/40 text-indigo-300 text-xs font-semibold">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>Simulation Mode</span>
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse ml-1" />
          </div>

          {/* Multi-Hazard Scenario Dropdown */}
          <select
            value={selectedScenario}
            onChange={(e) => setSelectedScenario(e.target.value)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border focus:outline-none transition-colors ${
              isDark
                ? 'bg-slate-900 text-slate-200 border-slate-700 hover:border-slate-600'
                : 'bg-white text-slate-800 border-slate-300 hover:border-slate-400'
            }`}
          >
            <option value="flood">🌊 1. Flash Flood Surge</option>
            <option value="fire">🔥 2. Forest Fire & Smoke</option>
            <option value="air">💨 3. Hazardous Air Pollution</option>
            <option value="heat">🌡️ 4. Extreme Heatwave</option>
            <option value="landslide">⛰️ 5. Landslide Precursor</option>
            <option value="chemical">☣️ 6. Industrial Chemical Leak</option>
            <option value="water">🚰 7. Water Quality Drop</option>
          </select>

          {/* Speed Multiplier */}
          <div className={`flex items-center gap-1 border rounded-lg p-1 text-xs flex-shrink-0 ${
            isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-300'
          }`}>
            <Sliders className={`w-3.5 h-3.5 ml-1 mr-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`} />
            {[1, 2, 5, 10].map((s) => (
              <button
                key={s}
                onClick={() => handleSpeedClick(s)}
                className={`px-2 py-0.5 rounded font-mono text-[11px] font-medium transition-all ${
                  speed === s
                    ? 'bg-cyan-500 text-slate-950 font-semibold shadow-xs'
                    : isDark 
                      ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-800' 
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                {s}x
              </button>
            ))}
          </div>

          {/* Play/Pause */}
          <button
            onClick={handleTogglePause}
            title={isPaused ? 'Resume Simulation' : 'Pause Simulation'}
            className={`p-1.5 rounded-lg border transition flex-shrink-0 ${
              isDark 
                ? 'bg-slate-900 hover:bg-slate-800 text-slate-200 border-slate-700' 
                : 'bg-white hover:bg-slate-100 text-slate-800 border-slate-300'
            }`}
          >
            {isPaused ? <Play className="w-4 h-4 text-emerald-500" /> : <Pause className="w-4 h-4 text-amber-500" />}
          </button>

          {/* Reset Scenario Button */}
          <button
            onClick={onReset}
            title="Reset Simulation State & Clear Alerts"
            className={`p-1.5 rounded-lg border transition flex-shrink-0 ${
              isDark 
                ? 'bg-slate-900 hover:bg-slate-800 text-slate-300 border-slate-700 hover:text-rose-300' 
                : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300 hover:text-rose-600'
            }`}
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          {/* Trigger Event Action */}
          <button
            onClick={() => onTriggerEvent(selectedScenario, speed)}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg font-semibold text-xs transition-all shadow-sm ${
              isAnyDisaster
                ? 'bg-rose-600 text-white animate-pulse shadow-rose-600/50'
                : 'bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white border border-cyan-400/40 shadow-cyan-500/20'
            }`}
          >
            <Zap className="w-3.5 h-3.5 text-amber-300 fill-amber-300" />
            <span>
              {isAnyDisaster ? `${systemHealth?.simulation_state} Active` : 'Simulate Hazard'}
            </span>
          </button>
        </div>

        {/* Right: Broadcast SMS, Buzzer Siren, & Add Node Button */}
        <div className="flex items-center gap-2">
          {/* Emergency Citizen SMS Dispatch Button */}
          <button
            onClick={onOpenSMSModal}
            title="Broadcast Emergency Warning / Evacuation SMS to local residents"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold text-xs text-white bg-gradient-to-r from-amber-600 via-red-600 to-amber-600 hover:from-amber-500 hover:to-red-500 border border-amber-400/40 shadow-xs transition-all"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Send Citizen SMS</span>
          </button>

          {/* Emergency Hazard Buzzer / Siren Button */}
          <button
            onClick={onToggleBuzzer}
            title={
              isAlarmActive && !isBuzzerMuted
                ? 'Disaster Siren is ALARMING (Click to Mute Buzzer)'
                : isBuzzerMuted
                ? 'Hazard Buzzer is MUTED (Click to Arm & Unmute)'
                : 'Hazard Buzzer is ARMED (Sounds automatically during any hazard)'
            }
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold text-xs border transition-all ${
              isAlarmActive && !isBuzzerMuted
                ? 'bg-rose-600 hover:bg-rose-700 text-white border-rose-400 animate-pulse shadow-rose-600/50'
                : isBuzzerMuted
                ? (isDark 
                    ? 'bg-slate-900 hover:bg-slate-800 text-slate-400 border-slate-700' 
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-600 border-slate-300')
                : (isDark
                    ? 'bg-slate-900 hover:bg-slate-800 text-emerald-400 border-emerald-500/40'
                    : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-300')
            }`}
          >
            {isAlarmActive && !isBuzzerMuted ? (
              <>
                <BellRing className="w-4 h-4 text-white animate-spin-slow" />
                <span className="uppercase">SIREN ON</span>
              </>
            ) : isBuzzerMuted ? (
              <>
                <BellOff className="w-4 h-4 text-slate-400" />
                <span className="text-[11px]">Buzzer Muted</span>
              </>
            ) : (
              <>
                <Bell className="w-4 h-4 text-emerald-400" />
                <span className="text-[11px]">Buzzer Armed</span>
              </>
            )}
          </button>

          {/* Add Sensor Node Button */}
          <button
            onClick={onOpenAddNodeModal}
            title="Deploy & provision a new LoRa mesh sensor node into the monitoring valley"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold text-xs text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 border border-emerald-400/40 shadow-xs transition-all"
          >
            <PlusCircle className="w-3.5 h-3.5 text-emerald-200" />
            <span>+ Add Node</span>
          </button>
        </div>
      </div>
    </header>
  );
};
