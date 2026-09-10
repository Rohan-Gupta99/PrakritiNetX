import React, { useState, useEffect } from 'react';
import { 
  X, 
  PlusCircle, 
  Radio, 
  Droplet, 
  Flame, 
  Mountain, 
  Wind, 
  Sun, 
  AlertOctagon, 
  Waves, 
  Compass, 
  Layers, 
  BatteryCharging, 
  Sparkles,
  Check,
  AlertCircle
} from 'lucide-react';
import { SensorNode, CreateNodeRequest } from '../types';
import { api } from '../services/api';

interface AddNodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  existingNodes: SensorNode[];
  onNodeAdded: (newNode: SensorNode) => void;
}

interface HotspotPreset {
  name: string;
  nodeCode: string;
  hazardType: string;
  lat: number;
  lng: number;
  elevation: number;
  riverKm: number;
  relayParent: string;
}

const PRESETS: HotspotPreset[] = [
  {
    name: 'Karnaprayag Confluence',
    nodeCode: 'N6',
    hazardType: 'flood',
    lat: 30.2580,
    lng: 79.2180,
    elevation: 790,
    riverKm: 28.5,
    relayParent: 'N5'
  },
  {
    name: 'Rudraprayag Sangam',
    nodeCode: 'N7',
    hazardType: 'flood+fire',
    lat: 30.2840,
    lng: 78.9810,
    elevation: 895,
    riverKm: 34.0,
    relayParent: 'N2'
  },
  {
    name: 'Chamoli Valley Slope',
    nodeCode: 'N8',
    hazardType: 'landslide',
    lat: 30.4070,
    lng: 79.3240,
    elevation: 1150,
    riverKm: 45.0,
    relayParent: 'N4'
  },
  {
    name: 'Uttarkashi Gorge',
    nodeCode: 'N9',
    hazardType: 'flood',
    lat: 30.7268,
    lng: 78.4354,
    elevation: 1158,
    riverKm: 52.0,
    relayParent: 'HUB'
  },
  {
    name: 'Tehri Outflow Channel',
    nodeCode: 'N10',
    hazardType: 'water',
    lat: 30.3780,
    lng: 78.4800,
    elevation: 720,
    riverKm: 22.0,
    relayParent: 'N3'
  },
  {
    name: 'Shivpuri Rapid',
    nodeCode: 'N11',
    hazardType: 'flood',
    lat: 30.1340,
    lng: 78.3880,
    elevation: 430,
    riverKm: 12.0,
    relayParent: 'N1'
  }
];

export const AddNodeModal: React.FC<AddNodeModalProps> = ({
  isOpen,
  onClose,
  existingNodes,
  onNodeAdded
}) => {
  // Determine next suggested node code
  const getNextCode = () => {
    const existingNumbers = existingNodes
      .map(n => {
        const match = n.node_code.match(/^N(\d+)$/i);
        return match ? parseInt(match[1], 10) : 0;
      })
      .filter(n => n > 0);
    const maxNum = existingNumbers.length > 0 ? Math.max(...existingNumbers) : 5;
    return `N${maxNum + 1}`;
  };

  const [nodeCode, setNodeCode] = useState<string>('');
  const [name, setName] = useState<string>('');
  const [hazardType, setHazardType] = useState<string>('flood');
  const [latitude, setLatitude] = useState<string>('30.2580');
  const [longitude, setLongitude] = useState<string>('79.2180');
  const [elevation, setElevation] = useState<string>('790');
  const [riverKm, setRiverKm] = useState<string>('28.5');
  const [relayParent, setRelayParent] = useState<string>('HUB');
  const [hopCount, setHopCount] = useState<number>(1);
  const [batteryMv, setBatteryMv] = useState<number>(3300);

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      const next = getNextCode();
      setNodeCode(next);
      setName('');
      setHazardType('flood');
      setLatitude('30.2580');
      setLongitude('79.2180');
      setElevation('790');
      setRiverKm('28.5');
      setRelayParent('HUB');
      setHopCount(1);
      setBatteryMv(3300);
      setErrorMsg(null);
      setSuccessMsg(null);
    }
  }, [isOpen, existingNodes]);

  if (!isOpen) return null;

  const applyPreset = (preset: HotspotPreset) => {
    setNodeCode(preset.nodeCode);
    setName(preset.name);
    setHazardType(preset.hazardType);
    setLatitude(preset.lat.toFixed(4));
    setLongitude(preset.lng.toFixed(4));
    setElevation(preset.elevation.toString());
    setRiverKm(preset.riverKm.toString());
    setRelayParent(preset.relayParent);
    setErrorMsg(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!nodeCode.trim()) {
      setErrorMsg('Node code is required (e.g. N6).');
      return;
    }
    if (!name.trim()) {
      setErrorMsg('Node name / location description is required.');
      return;
    }

    const latNum = parseFloat(latitude);
    const lngNum = parseFloat(longitude);
    const elevNum = parseFloat(elevation);
    const riverKmNum = parseFloat(riverKm);

    if (isNaN(latNum) || isNaN(lngNum)) {
      setErrorMsg('Valid GPS Latitude and Longitude are required.');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload: CreateNodeRequest = {
        node_code: nodeCode.trim().toUpperCase(),
        name: name.trim(),
        hazard_type: hazardType,
        latitude: latNum,
        longitude: lngNum,
        elevation_m: isNaN(elevNum) ? 500 : elevNum,
        river_km: isNaN(riverKmNum) ? 10.0 : riverKmNum,
        battery_mv: batteryMv,
        relay_parent: relayParent || 'HUB',
        hop_count: hopCount
      };

      const createdNode = await api.createNode(payload);
      setSuccessMsg(`Node ${createdNode.node_code} (${createdNode.name}) successfully provisioned and active on mesh!`);
      onNodeAdded(createdNode);

      setTimeout(() => {
        onClose();
      }, 1200);
    } catch (err: any) {
      console.error(err);
      const detail = err.response?.data?.detail || 'Failed to provision node. Please check your inputs.';
      setErrorMsg(detail);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
      <div 
        className="relative w-full max-w-2xl bg-white dark:bg-[#0c1222] border border-slate-300 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] font-sans text-slate-900 dark:text-slate-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-gradient-to-r from-slate-100 via-white to-slate-100 dark:from-slate-900 dark:via-slate-950 dark:to-slate-900">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-cyan-100 dark:bg-cyan-950/80 border border-cyan-300 dark:border-cyan-600/50 text-cyan-600 dark:text-cyan-400 shadow-sm">
              <PlusCircle className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                Provision New LoRa Sensor Node
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-100 dark:bg-cyan-900/60 text-cyan-800 dark:text-cyan-300 border border-cyan-300 dark:border-cyan-700 font-bold">
                  EDGE MESH
                </span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Register a telemetry station into the real-time early warning network
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-4 text-xs font-sans">
          {/* Quick Valley Hotspot Presets */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              Quick Valley Presets (Click to Auto-fill)
            </label>
            <div className="flex flex-wrap gap-1.5">
              {PRESETS.map((p) => (
                <button
                  type="button"
                  key={p.name}
                  onClick={() => applyPreset(p)}
                  className="px-2.5 py-1 rounded-lg border border-slate-300 dark:border-slate-800 bg-slate-100 dark:bg-slate-900 hover:bg-cyan-50 dark:hover:bg-cyan-950/50 hover:border-cyan-400 dark:hover:border-cyan-600 text-slate-800 dark:text-slate-300 text-xs transition-all flex items-center gap-1.5 shadow-xs font-medium"
                >
                  <span className="font-bold font-mono text-cyan-600 dark:text-cyan-400">{p.nodeCode}</span>
                  <span>{p.name.split(' ')[0]}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Row 1: Node Identification */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1 text-xs">
                Node Code *
              </label>
              <input
                type="text"
                value={nodeCode}
                onChange={(e) => setNodeCode(e.target.value.toUpperCase())}
                placeholder="e.g. N6"
                required
                className="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-bold font-mono text-xs focus:outline-none focus:ring-2 focus:ring-cyan-500"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1 text-xs">
                Node Name / Valley Location *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Karnaprayag Confluence Station"
                required
                className="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-semibold text-xs focus:outline-none focus:ring-2 focus:ring-cyan-500"
              />
            </div>
          </div>

          {/* Hazard Category Selection */}
          <div>
            <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1.5 text-xs">
              Primary Hazard Monitoring Capabilities
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { id: 'flood', label: 'Flash Flood', icon: Droplet, color: 'text-cyan-500 border-cyan-500' },
                { id: 'flood+fire', label: 'Flood & Fire', icon: Flame, color: 'text-orange-500 border-orange-500' },
                { id: 'landslide', label: 'Landslide IMU', icon: Mountain, color: 'text-amber-500 border-amber-500' },
                { id: 'air', label: 'Air AQI Laser', icon: Wind, color: 'text-purple-500 border-purple-500' },
                { id: 'heat', label: 'Heat Index', icon: Sun, color: 'text-red-500 border-red-500' },
                { id: 'chemical', label: 'Chemical Toxic', icon: AlertOctagon, color: 'text-rose-500 border-rose-500' },
                { id: 'water', label: 'Water Quality', icon: Waves, color: 'text-emerald-500 border-emerald-500' },
              ].map((h) => {
                const IconComponent = h.icon;
                const isSelected = hazardType === h.id;
                return (
                  <button
                    type="button"
                    key={h.id}
                    onClick={() => setHazardType(h.id)}
                    className={`p-2 rounded-xl border text-left flex items-center gap-2 transition-all ${
                      isSelected
                        ? `bg-slate-100 dark:bg-slate-800 font-bold shadow-sm ${h.color}`
                        : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700'
                    }`}
                  >
                    <IconComponent className="w-4 h-4 flex-shrink-0" />
                    <span className="text-xs truncate font-medium">{h.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Geospatial Coordinates */}
          <div className="p-3 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2.5">
            <div className="flex items-center gap-1.5 text-slate-800 dark:text-slate-200 font-semibold text-xs">
              <Compass className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
              <span>Geospatial Coordinates & Topography</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div>
                <label className="block text-slate-500 dark:text-slate-400 text-[11px] mb-0.5">
                  Latitude (°N)
                </label>
                <input
                  type="number"
                  step="0.0001"
                  value={latitude}
                  onChange={(e) => setLatitude(e.target.value)}
                  className="w-full px-2.5 py-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 font-mono text-slate-900 dark:text-slate-100 text-xs"
                />
              </div>

              <div>
                <label className="block text-slate-500 dark:text-slate-400 text-[11px] mb-0.5">
                  Longitude (°E)
                </label>
                <input
                  type="number"
                  step="0.0001"
                  value={longitude}
                  onChange={(e) => setLongitude(e.target.value)}
                  className="w-full px-2.5 py-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 font-mono text-slate-900 dark:text-slate-100 text-xs"
                />
              </div>

              <div>
                <label className="block text-slate-500 dark:text-slate-400 text-[11px] mb-0.5">
                  Elevation (m MSL)
                </label>
                <input
                  type="number"
                  step="1"
                  value={elevation}
                  onChange={(e) => setElevation(e.target.value)}
                  className="w-full px-2.5 py-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 font-mono text-slate-900 dark:text-slate-100 text-xs"
                />
              </div>

              <div>
                <label className="block text-slate-500 dark:text-slate-400 text-[11px] mb-0.5">
                  River Distance (km)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={riverKm}
                  onChange={(e) => setRiverKm(e.target.value)}
                  className="w-full px-2.5 py-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 font-mono text-slate-900 dark:text-slate-100 text-xs"
                />
              </div>
            </div>
          </div>

          {/* LoRa Mesh Topology */}
          <div className="p-3 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2.5">
            <div className="flex items-center gap-1.5 text-slate-800 dark:text-slate-200 font-semibold text-xs">
              <Layers className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
              <span>LoRa Mesh Network Routing</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div>
                <label className="block text-slate-500 dark:text-slate-400 text-[11px] mb-0.5">
                  Relay Parent Node
                </label>
                <select
                  value={relayParent}
                  onChange={(e) => setRelayParent(e.target.value)}
                  className="w-full px-2.5 py-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 font-mono text-slate-900 dark:text-slate-100 text-xs"
                >
                  <option value="HUB">HUB (Laptop Gateway)</option>
                  {existingNodes.filter(n => n.node_code !== 'HUB').map((n) => (
                    <option key={n.node_code} value={n.node_code}>
                      {n.node_code} - {n.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-500 dark:text-slate-400 text-[11px] mb-0.5">
                  Mesh Hop Count
                </label>
                <select
                  value={hopCount}
                  onChange={(e) => setHopCount(parseInt(e.target.value, 10))}
                  className="w-full px-2.5 py-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 font-mono text-slate-900 dark:text-slate-100 text-xs"
                >
                  <option value={1}>1 Hop (Direct to Hub/Parent)</option>
                  <option value={2}>2 Hops</option>
                  <option value={3}>3 Hops</option>
                  <option value={4}>4 Hops</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-500 dark:text-slate-400 text-[11px] mb-0.5">
                  Initial Battery (mV)
                </label>
                <input
                  type="number"
                  step="10"
                  min="3000"
                  max="3350"
                  value={batteryMv}
                  onChange={(e) => setBatteryMv(parseInt(e.target.value, 10))}
                  className="w-full px-2.5 py-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 font-mono text-slate-900 dark:text-slate-100 text-xs"
                />
              </div>
            </div>
          </div>

          {/* Feedback messages */}
          {errorMsg && (
            <div className="p-2.5 rounded-lg bg-rose-50 dark:bg-rose-950/80 border border-rose-300 dark:border-rose-700 text-rose-800 dark:text-rose-300 flex items-center gap-2 text-xs">
              <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-500" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/80 border border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-300 flex items-center gap-2 text-xs">
              <Check className="w-4 h-4 flex-shrink-0 text-emerald-500" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Footer Actions */}
          <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-semibold transition-colors text-xs"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-2 px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-white font-bold shadow-lg shadow-emerald-900/30 transition-all hover:scale-105 active:scale-95 disabled:opacity-50 text-xs"
            >
              {isSubmitting ? (
                <>
                  <Radio className="w-4 h-4 animate-spin" />
                  <span>Deploying to Mesh...</span>
                </>
              ) : (
                <>
                  <PlusCircle className="w-4 h-4" />
                  <span>Deploy & Activate Node</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
