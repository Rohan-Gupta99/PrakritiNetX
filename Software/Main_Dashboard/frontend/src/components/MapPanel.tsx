import React, { useMemo, useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, Circle, Tooltip, ZoomControl, useMap } from 'react-leaflet';
import L from 'leaflet';
import { SensorNode, ActiveSurge, Reading } from '../types';
import { 
  Radio, 
  Droplet, 
  Flame, 
  Mountain, 
  Laptop, 
  AlertTriangle, 
  ShieldCheck,
  Satellite,
  Layers,
  Sparkles,
  Globe
} from 'lucide-react';

interface MapPanelProps {
  nodes: SensorNode[];
  selectedNodeId: number | null;
  onSelectNode: (nodeId: number) => void;
  activeSurge: ActiveSurge | null;
  latestReadings: Record<string, Reading>;
  theme?: 'dark' | 'light';
}

// Custom DivIcons for Leaflet
const createNodeIcon = (node: SensorNode, isSelected: boolean, isDark: boolean) => {
  let statusColor = '#10b981'; // Green
  let ringColor = 'rgba(16, 185, 129, 0.4)';
  let isAlert = node.status === 'ALERT';
  let isWarning = node.status === 'WARNING';

  if (node.node_code === 'HUB') {
    statusColor = '#06b6d4'; // Cyan for Laptop Hub
    ringColor = 'rgba(6, 182, 212, 0.4)';
  } else if (isAlert) {
    statusColor = '#ef4444'; // Red
    ringColor = 'rgba(239, 68, 68, 0.6)';
  } else if (isWarning) {
    statusColor = '#f59e0b'; // Amber
    ringColor = 'rgba(245, 158, 11, 0.5)';
  }

  const bgHex = isDark ? '#0f172a' : '#ffffff';
  const tagBg = isDark ? 'bg-slate-900/90 border-slate-700 text-slate-200' : 'bg-white/95 border-slate-300 text-slate-800';

  const iconHtml = `
    <div class="relative flex items-center justify-center cursor-pointer font-sans">
      ${isAlert ? `<div class="radar-ring" style="border: 2px solid ${statusColor}; width: 44px; height: 44px; top: -10px; left: -10px;"></div>` : ''}
      <div class="w-7 h-7 rounded-full flex items-center justify-center font-mono font-bold text-xs shadow-lg transition-transform ${isSelected ? 'scale-125 ring-2 ring-cyan-400' : 'hover:scale-110'}" 
           style="background-color: ${bgHex}; border: 2px solid ${statusColor}; box-shadow: 0 0 14px ${ringColor};">
        <span style="color: ${statusColor}">${node.node_code === 'HUB' ? 'HUB' : node.node_code}</span>
      </div>
      <div class="absolute -bottom-5 px-1.5 py-0.2 ${tagBg} text-[10px] font-sans font-medium rounded border whitespace-nowrap shadow-md">
        ${node.name.split(' ')[0]}
      </div>
    </div>
  `;

  return L.divIcon({
    html: iconHtml,
    className: 'custom-node-icon',
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -16]
  });
};

// Auto-resizer component to ensure Leaflet recalculates canvas size and renders all tiles seamlessly
const MapAutoResizer: React.FC = () => {
  const map = useMap();
  useEffect(() => {
    const handleResize = () => {
      map.invalidateSize();
    };

    handleResize();
    const t1 = setTimeout(handleResize, 100);
    const t2 = setTimeout(handleResize, 300);
    const t3 = setTimeout(handleResize, 800);

    const container = map.getContainer();
    let resizeObserver: ResizeObserver | null = null;
    if (container && window.ResizeObserver) {
      resizeObserver = new ResizeObserver(() => {
        map.invalidateSize();
      });
      resizeObserver.observe(container);
    }

    window.addEventListener('resize', handleResize);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      if (resizeObserver) resizeObserver.disconnect();
      window.removeEventListener('resize', handleResize);
    };
  }, [map]);

  return null;
};

export const MapPanel: React.FC<MapPanelProps> = ({
  nodes,
  selectedNodeId,
  onSelectNode,
  activeSurge,
  latestReadings,
  theme = 'dark',
}) => {
  const isDark = theme === 'dark';
  // Centered on Rishikesh / Alaknanda-Ganga Valley node cluster
  const centerPosition: [number, number] = [30.0869, 78.2676];

  // Satellite and map layer switcher state
  const [mapLayer, setMapLayer] = useState<'satellite' | 'terrain' | 'dark' | 'streets'>('satellite');
  const [showSatelliteRadar, setShowSatelliteRadar] = useState<boolean>(true);

  // River path coordinates (Alaknanda -> Ganga)
  const riverPolyline: [number, number][] = [
    [30.1600, 78.1950],
    [30.1450, 78.2100], // N1: Upstream Gauge
    [30.1250, 78.2250],
    [30.1100, 78.2400], // N2: Devprayag
    [30.0980, 78.2520],
    [30.0869, 78.2676], // N3: Rishikesh / HUB
    [30.0600, 78.2850],
    [30.0200, 78.3150],
    [29.9800, 78.3500], // N5: Downstream Plain
    [29.9400, 78.3800],
  ];

  // Mesh Network Links
  const meshLinks = useMemo(() => {
    const nodeMap = new Map(nodes.map(n => [n.node_code, [n.latitude, n.longitude] as [number, number]]));
    const links: { from: string; to: string; path: [number, number][]; rssi: number; active: boolean }[] = [];

    // Dynamically connect each node to its relay parent
    nodes.forEach(node => {
      if (node.relay_parent && node.relay_parent !== 'LOCAL') {
        const p1 = nodeMap.get(node.node_code);
        const p2 = nodeMap.get(node.relay_parent);
        if (p1 && p2) {
          links.push({
            from: node.node_code,
            to: node.relay_parent,
            path: [p1, p2],
            rssi: node.signal_rssi || -68,
            active: true
          });
        }
      }
    });

    return links;
  }, [nodes]);

  const isSurgeActive = activeSurge !== null && activeSurge.status !== 'RESOLVED';

  // Tile layer configurations (100% open source & free)
  const TILE_LAYERS = {
    satellite: {
      name: 'ESRI Satellite HD',
      url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      attribution: '&copy; <a href="https://www.esri.com/">Esri</a>, Earthstar Geographics'
    },
    terrain: {
      name: 'OpenTopoMap Terrain',
      url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
      attribution: 'Map data: &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>, SRTM | Map style: &copy; <a href="https://opentopomap.org">OpenTopoMap</a>'
    },
    dark: {
      name: 'CartoDB Dark Canvas',
      url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
      attribution: '&copy; <a href="https://carto.com/">CARTO</a>'
    },
    streets: {
      name: 'OpenStreetMap Streets',
      url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    }
  };

  return (
    <div className="relative w-full h-full min-h-[500px] rounded-2xl overflow-hidden glass-panel border border-slate-200 dark:border-slate-800 isolate shadow-lg flex flex-col font-sans">
      {/* 1. Wave Propagation Vector Floating Alert (Top-Left, only when hazard active) */}
      {isSurgeActive && activeSurge && (
        <div className="absolute top-3 left-3 z-[1000] backdrop-blur-md px-3.5 py-2.5 rounded-xl border border-rose-500/60 bg-slate-950/90 text-xs shadow-2xl flex flex-col gap-1 max-w-[290px] animate-pulse font-sans">
          <div className="flex items-center justify-between text-rose-400 font-semibold text-xs">
            <span className="flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4" />
              Hydrodynamic Flood Wave
            </span>
            <span className="font-mono text-[11px] font-medium text-slate-200 bg-rose-950 px-1.5 py-0.2 rounded border border-rose-800">~3.5 m/s</span>
          </div>
          <div className="text-[11px] text-slate-300">
            Origin: <span className="text-cyan-300 font-semibold font-mono">{activeSurge.source_node}</span> • Turbidity Z: <span className="text-rose-300 font-mono font-semibold">+{activeSurge.turb_z.toFixed(1)}σ</span>
          </div>
          <div className="text-[11px] text-slate-400">
            N3 Rishikesh ETA: <span className="text-amber-300 font-mono font-bold">{activeSurge.target_n3?.travel_time_min?.toFixed(0) || 44} min</span>
          </div>
        </div>
      )}

      {/* 2. Bottom Layer Switcher Toolbar (Clean Title Case and Inter typography) */}
      <div className="absolute bottom-3 right-3 z-[1000] flex items-center gap-1.5 backdrop-blur-md p-1.5 rounded-xl border shadow-2xl bg-slate-900/90 border-slate-700/80 text-xs font-sans">
        <button
          onClick={() => setMapLayer('satellite')}
          className={`flex items-center gap-1 px-2.5 py-1 rounded-lg transition-all ${
            mapLayer === 'satellite'
              ? 'bg-cyan-500 text-slate-950 font-semibold shadow-md shadow-cyan-500/40'
              : 'text-slate-300 hover:text-white hover:bg-slate-800 font-medium'
          }`}
          title="High-Resolution Open Earth Observation Satellite Imagery (ESRI World Imagery)"
        >
          <Satellite className="w-3.5 h-3.5" />
          <span>Satellite</span>
        </button>

        <button
          onClick={() => setMapLayer('terrain')}
          className={`flex items-center gap-1 px-2.5 py-1 rounded-lg transition-all ${
            mapLayer === 'terrain'
              ? 'bg-cyan-500 text-slate-950 font-semibold shadow-md shadow-cyan-500/40'
              : 'text-slate-300 hover:text-white hover:bg-slate-800 font-medium'
          }`}
          title="OpenTopoMap Topographic Contours & Elevation Hillshading"
        >
          <Mountain className="w-3.5 h-3.5" />
          <span>Terrain</span>
        </button>

        <button
          onClick={() => setMapLayer('dark')}
          className={`flex items-center gap-1 px-2.5 py-1 rounded-lg transition-all ${
            mapLayer === 'dark'
              ? 'bg-cyan-500 text-slate-950 font-semibold shadow-md shadow-cyan-500/40'
              : 'text-slate-300 hover:text-white hover:bg-slate-800 font-medium'
          }`}
          title="CartoDB Dark Matter Minimal Canvas"
        >
          <Globe className="w-3.5 h-3.5" />
          <span>Dark Canvas</span>
        </button>

        <button
          onClick={() => setMapLayer('streets')}
          className={`flex items-center gap-1 px-2.5 py-1 rounded-lg transition-all ${
            mapLayer === 'streets'
              ? 'bg-cyan-500 text-slate-950 font-semibold shadow-md shadow-cyan-500/40'
              : 'text-slate-300 hover:text-white hover:bg-slate-800 font-medium'
          }`}
          title="Standard OpenStreetMap Vector & Roads"
        >
          <Layers className="w-3.5 h-3.5" />
          <span>Streets</span>
        </button>

        <div className="h-4 w-px bg-slate-700 mx-0.5" />

        {/* Satellite Radar Stream Toggle */}
        <button
          onClick={() => setShowSatelliteRadar(!showSatelliteRadar)}
          className={`flex items-center gap-1 px-2 py-1 rounded-lg transition-all ${
            showSatelliteRadar
              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 font-semibold'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800 font-medium'
          }`}
          title="Toggle INSAT-3DR / Radar Precipitation Overlay"
        >
          <Sparkles className={`w-3.5 h-3.5 ${showSatelliteRadar ? 'text-emerald-400 animate-spin-slow' : ''}`} />
          <span className="hidden sm:inline">INSAT Radar</span>
        </button>
      </div>

      {/* 3. Leaflet Map Canvas */}
      <MapContainer
        center={centerPosition}
        zoom={11}
        zoomControl={false}
        scrollWheelZoom={true}
        className="w-full h-full flex-1"
        style={{ height: '100%', width: '100%', minHeight: '500px' }}
      >
        {/* Dynamic Resize Observer */}
        <MapAutoResizer />

        {/* Zoom Control at Bottom Left */}
        <ZoomControl position="bottomleft" />

        {/* Dynamic Tile Layer according to user selection */}
        <TileLayer
          key={mapLayer}
          attribution={TILE_LAYERS[mapLayer].attribution}
          url={TILE_LAYERS[mapLayer].url}
          maxZoom={19}
        />

        {/* River Valley Polyline */}
        <Polyline
          positions={riverPolyline}
          pathOptions={{
            color: isSurgeActive ? '#0284c7' : '#2563eb',
            weight: isSurgeActive ? 5 : 4,
            opacity: 0.9,
            className: isSurgeActive ? 'animated-river-surge' : '',
          }}
        >
          <Tooltip sticky direction="center">
            <span className="font-mono text-xs font-semibold text-blue-600">Alaknanda - Ganga Riverbed</span>
          </Tooltip>
        </Polyline>

        {/* Mesh Links */}
        {meshLinks.map((link, idx) => (
          <Polyline
            key={`mesh-${idx}`}
            positions={link.path}
            pathOptions={{
              color: link.rssi > -70 ? '#10b981' : link.rssi > -75 ? '#06b6d4' : '#f59e0b',
              weight: 1.8,
              opacity: mapLayer === 'satellite' ? 0.85 : 0.75,
              dashArray: '4, 6',
            }}
          />
        ))}

        {/* Synthetic INSAT Satellite Convective Radar Cells */}
        {showSatelliteRadar && (
          <>
            <Circle
              center={[30.1450, 78.2100]}
              radius={7000}
              pathOptions={{
                color: '#38bdf8',
                fillColor: '#0284c7',
                fillOpacity: 0.22,
                weight: 1.5,
                dashArray: '3, 6'
              }}
            >
              <Tooltip>
                <span className="font-mono text-xs font-bold text-sky-700">INSAT Convective Cell: High Hydrological Discharge</span>
              </Tooltip>
            </Circle>
            <Circle
              center={[30.0869, 78.2676]}
              radius={5500}
              pathOptions={{
                color: '#f59e0b',
                fillColor: '#d97706',
                fillOpacity: 0.15,
                weight: 1,
              }}
            >
              <Tooltip>
                <span className="font-mono text-xs font-bold text-amber-700">Thermal LST Anomaly: 24.5°C Surface Valley Vector</span>
              </Tooltip>
            </Circle>
          </>
        )}

        {/* Node Markers */}
        {nodes.map((node) => {
          const isSelected = selectedNodeId === node.id;
          const icon = createNodeIcon(node, isSelected, isDark);
          const reading = latestReadings[node.node_code];

          return (
            <Marker
              key={node.id}
              position={[node.latitude, node.longitude]}
              icon={icon}
              eventHandlers={{
                click: () => onSelectNode(node.id),
              }}
            >
              <Popup className="custom-popup">
                <div className="font-sans text-xs p-1 text-slate-800">
                  <div className="font-semibold flex items-center gap-1.5 border-b pb-1 mb-1.5">
                    <span className="text-cyan-600 font-bold font-mono">{node.node_code}</span>
                    <span className="text-slate-900">{node.name}</span>
                  </div>
                  <div className="space-y-1 text-[11px]">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500">Status:</span>
                      <span className={`font-semibold uppercase text-[10px] px-1 rounded ${node.status === 'ALERT' ? 'bg-rose-100 text-rose-700' : node.status === 'WARNING' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                        {node.status}
                      </span>
                    </div>
                    {reading && (
                      <>
                        <div className="flex justify-between items-center">
                          <span className="text-slate-500">Water Level:</span>
                          <span className="font-mono font-medium">{reading.water_level_m?.toFixed(2) ?? '2.10'} m</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-slate-500">Turbidity:</span>
                          <span className="font-mono font-medium">{reading.turbidity?.toFixed(1) ?? '18.5'} NTU</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-slate-500">Flame Sensor:</span>
                          <span className="font-mono font-medium">{reading.flame_detected ? 'DETECTED' : 'CLEAR'}</span>
                        </div>
                      </>
                    )}
                    <div className="flex justify-between items-center border-t pt-1 mt-1 text-[10px] text-slate-500 font-mono">
                      <span>Vbat: {node.battery_mv} mV</span>
                      <span>RSSI: {node.signal_rssi} dBm</span>
                    </div>
                  </div>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
};
