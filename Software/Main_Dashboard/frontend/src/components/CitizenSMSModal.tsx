import React, { useState } from 'react';
import { 
  Send, AlertTriangle, ShieldAlert, Users, Radio, 
  CheckCircle2, X, MessageSquare, Flame, Droplets, Wind, Sun, Mountain, Waves, Sparkles
} from 'lucide-react';
import { api } from '../services/api';
import { SMSLog } from '../types';

interface CitizenSMSModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSMSSent?: (newSms: SMSLog) => void;
}

interface PresetTemplate {
  id: string;
  name: string;
  hazard: string;
  icon: any;
  color: string;
  group: string;
  body: string;
}

const PRESET_TEMPLATES: PresetTemplate[] = [
  {
    id: 'flood',
    name: 'Flash Flood Evacuation',
    hazard: 'FLOOD',
    icon: Droplets,
    color: 'text-cyan-400 border-cyan-500/30 bg-cyan-500/10',
    group: 'Devprayag Riverside Residents',
    body: '🚨 [CRITICAL FLOOD WARNING] Rising water surge detected upstream at Devprayag (N1). High crest expected at downstream ghats within 40 mins. Evacuate immediately to higher ground! / सावधान: देवप्रयाग में जलस्तर अचानक बढ़ा है। 40 मिनट में बाढ़ की संभावना, सुरक्षित स्थानों पर जाएं।'
  },
  {
    id: 'fire',
    name: 'Forest Fire & Smoke',
    hazard: 'FOREST_FIRE',
    icon: Flame,
    color: 'text-amber-400 border-amber-500/30 bg-amber-500/10',
    group: 'Narendra Nagar Slope Settlements',
    body: '🔥 [WILDFIRE WARNING] Active fire and thick smoke detected on Ridge Slope (N4). Air quality critical (AQI >300). Residents avoid valley paths, stay indoors with windows closed. / चेतावनी: जंगल में आग और घना धुआं। बाहर न निकलें।'
  },
  {
    id: 'air',
    name: 'Hazardous Air Pollution',
    hazard: 'AIR_POLLUTION',
    icon: Wind,
    color: 'text-purple-400 border-purple-500/30 bg-purple-500/10',
    group: 'Rishikesh Pilgrims & Ghat Dwellers',
    body: '💨 [AIR QUALITY WARNING] Hazardous particulate levels (PM2.5 > 200 µg/m³) recorded across valley. Elderly and children must wear masks and avoid outdoor exertion. / वायु प्रदूषण चेतावनी: हवा की गुणवत्ता अत्यधिक खराब। मास्क पहनें।'
  },
  {
    id: 'heat',
    name: 'Extreme Heatwave Advisory',
    hazard: 'EXTREME_HEAT',
    icon: Sun,
    color: 'text-orange-400 border-orange-500/30 bg-orange-500/10',
    group: 'All Riverbank Community Wards',
    body: '🌡️ [HEAT ADVISORY] Heat Index has exceeded 44°C in valley corridor. High risk of dehydration and heat stroke. Drink adequate fluids and avoid direct sun from 11 AM - 4 PM. / भीषण गर्मी चेतावनी: अत्यधिक तापमान, धूप से बचें और खूब पानी पिएं।'
  },
  {
    id: 'landslide',
    name: 'Landslide Precursor Warning',
    hazard: 'LANDSLIDE',
    icon: Mountain,
    color: 'text-yellow-400 border-yellow-500/30 bg-yellow-500/10',
    group: 'Narendra Nagar Slope Settlements',
    body: '⛰️ [SLOPE INSTABILITY ALERT] Sensor N4 detected soil saturation (>90%) and tilt rate acceleration. High landslide hazard on NH-58 corridor. Avoid travel along hillside roads. / भूस्खलन चेतावनी: नरेंद्र नगर में ढलान अस्थिर, पहाड़ी मार्गों पर आवाजाही रोकें।'
  },
  {
    id: 'chemical',
    name: 'Industrial Chemical Leak',
    hazard: 'CHEMICAL_LEAK',
    icon: AlertTriangle,
    color: 'text-rose-400 border-rose-500/30 bg-rose-500/10',
    group: 'Shivpuri Adventure & Rafting Camps',
    body: '☣️ [CHEMICAL HAZARD] Elevated toxic VOC gas emissions detected near Shivpuri (N3). Stay indoors, seal ventilators, and await SDRF clearance. / रासायनिक रिसाव चेतावनी: जहरीली गैस की सूचना, घरों के अंदर रहें।'
  },
  {
    id: 'water',
    name: 'Water Quality Degradation',
    hazard: 'WATER_POLLUTION',
    icon: Waves,
    color: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10',
    group: 'Devprayag Riverside Residents',
    body: '🚰 [WATER CONTAMINATION ALERT] Critical pH drop (pH < 5.2) and elevated TDS detected in river stream. Do NOT use raw river water for drinking or cattle. / जल प्रदूषण चेतावनी: नदी का पानी दूषित, पीने हेतु प्रयोग न करें।'
  }
];

const RECIPIENT_GROUPS = [
  { name: 'Devprayag Riverside Residents', count: 640, desc: '640 riverfront households and local shops' },
  { name: 'Rishikesh Pilgrims & Ghat Dwellers', count: 1250, desc: '1,250 pilgrims, ashrams, and ghat visitors' },
  { name: 'Narendra Nagar Slope Settlements', count: 420, desc: '420 hill slope homes near vulnerable fault zones' },
  { name: 'Shivpuri Adventure & Rafting Camps', count: 310, desc: '310 riverside campsite operators and tourists' },
  { name: 'Uttarakhand SDRF & District Disaster Control', count: 25, desc: '25 quick-reaction field rescue commanders' },
  { name: 'All Riverbank Community Wards', count: 2645, desc: '2,645 total registered citizens across all 5 sectors' }
];

export const CitizenSMSModal: React.FC<CitizenSMSModalProps> = ({
  isOpen,
  onClose,
  onSMSSent
}) => {
  const [selectedGroup, setSelectedGroup] = useState(RECIPIENT_GROUPS[0].name);
  const [customPhone, setCustomPhone] = useState('');
  const [hazardType, setHazardType] = useState('FLOOD');
  const [messageBody, setMessageBody] = useState(PRESET_TEMPLATES[0].body);
  const [isSending, setIsSending] = useState(false);
  const [successStatus, setSuccessStatus] = useState<string | null>(null);

  if (!isOpen) return null;

  const currentGroupObj = RECIPIENT_GROUPS.find(g => g.name === selectedGroup) || { count: 1 };
  const recipientCount = selectedGroup === 'Custom Phone Number' ? 1 : currentGroupObj.count;

  const handleApplyPreset = (tpl: PresetTemplate) => {
    setHazardType(tpl.hazard);
    setSelectedGroup(tpl.group);
    setMessageBody(tpl.body);
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageBody.trim()) return;

    setIsSending(true);
    setSuccessStatus(null);

    try {
      const payload = {
        recipient_group: selectedGroup,
        phone_numbers: selectedGroup === 'Custom Phone Number' && customPhone ? customPhone : `+91 98112-XXXXX (+${recipientCount - 1} citizens)`,
        message_body: messageBody,
        hazard_type: hazardType,
        recipient_count: recipientCount
      };

      const result = await api.sendCitizenSMS(payload);
      setSuccessStatus(`Successfully dispatched SMS to ${recipientCount.toLocaleString()} local citizens via GSM Gateway!`);
      if (onSMSSent) {
        onSMSSent(result);
      }
      setTimeout(() => {
        setSuccessStatus(null);
      }, 4000);
    } catch (err: any) {
      alert('Failed to dispatch SMS: ' + (err.response?.data?.detail || err.message));
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn font-sans">
      <div className="relative w-full max-w-3xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] z-[100000]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 shadow-inner">
              <Radio className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                  Emergency Citizen SMS Dispatch
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    GSM Edge Gateway Ready
                  </span>
                </h2>
              </div>
              <p className="text-xs text-slate-400">
                Broadcast instant multi-hazard alerts & evacuation instructions to local populations without internet dependency.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5 text-sm">
          {/* Success Banner */}
          {successStatus && (
            <div className="p-3.5 bg-emerald-500/20 border border-emerald-500/40 rounded-xl text-emerald-300 flex items-center space-x-3 text-xs animate-bounce">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
              <div className="font-semibold">{successStatus}</div>
            </div>
          )}

          {/* Quick Presets */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                Quick Multi-Hazard Templates (Bilingual EN / HI)
              </span>
              <span className="text-xs text-slate-400">Click to load verified alert text</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {PRESET_TEMPLATES.map((tpl) => {
                const Icon = tpl.icon;
                return (
                  <button
                    key={tpl.id}
                    type="button"
                    onClick={() => handleApplyPreset(tpl)}
                    className={`p-2.5 rounded-xl border text-left flex flex-col justify-between transition-all hover:scale-[1.02] ${tpl.color}`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <Icon className="w-4 h-4" />
                      <span className="text-[10px] font-bold font-mono px-1.5 py-0.5 rounded bg-black/30">
                        {tpl.hazard}
                      </span>
                    </div>
                    <span className="text-xs font-semibold leading-tight line-clamp-1">
                      {tpl.name}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSend} className="space-y-4">
            {/* Recipient Selection */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-cyan-400" />
                  Target Community Group / Ward
                </label>
                <select
                  value={selectedGroup}
                  onChange={(e) => setSelectedGroup(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800/90 border border-slate-700 rounded-xl text-slate-200 focus:outline-none focus:border-cyan-500 transition-colors text-xs font-medium"
                >
                  {RECIPIENT_GROUPS.map((g) => (
                    <option key={g.name} value={g.name}>
                      {g.name} ({g.count.toLocaleString()} recipients)
                    </option>
                  ))}
                  <option value="Custom Phone Number">Custom Phone Number / Single Warden</option>
                </select>
                <p className="text-xs text-slate-400 mt-1">
                  {RECIPIENT_GROUPS.find(g => g.name === selectedGroup)?.desc || 'Deliver directly to a single field commander'}
                </p>
              </div>

              {selectedGroup === 'Custom Phone Number' ? (
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Custom Recipient Mobile (+91...)
                  </label>
                  <input
                    type="text"
                    value={customPhone}
                    onChange={(e) => setCustomPhone(e.target.value)}
                    placeholder="+91 98765 43210"
                    className="w-full px-3 py-2 bg-slate-800/90 border border-slate-700 rounded-xl text-slate-200 focus:outline-none focus:border-cyan-500 font-mono text-xs"
                    required
                  />
                  <p className="text-xs text-slate-400 mt-1">Direct SMS to individual mobile device</p>
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                    <ShieldAlert className="w-4 h-4 text-amber-400" />
                    Hazard Priority Classification
                  </label>
                  <select
                    value={hazardType}
                    onChange={(e) => setHazardType(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-800/90 border border-slate-700 rounded-xl text-slate-200 focus:outline-none focus:border-cyan-500 text-xs font-medium"
                  >
                    <option value="FLOOD">🌊 FLASH FLOOD / RISING WATER</option>
                    <option value="FOREST_FIRE">🔥 FOREST WILDFIRE & SMOKE</option>
                    <option value="AIR_POLLUTION">💨 HAZARDOUS AIR POLLUTION (AQI)</option>
                    <option value="EXTREME_HEAT">🌡️ EXTREME HEATWAVE</option>
                    <option value="LANDSLIDE">⛰️ LANDSLIDE / SLOPE PRECURSOR</option>
                    <option value="CHEMICAL_LEAK">☣️ INDUSTRIAL CHEMICAL / VOC</option>
                    <option value="WATER_POLLUTION">🚰 WATER QUALITY DEGRADATION</option>
                    <option value="GENERAL_ALERT">📢 GENERAL ADVISORY</option>
                  </select>
                  <p className="text-xs text-slate-400 mt-1">Priority queue tier for GSM cell tower broadcast</p>
                </div>
              )}
            </div>

            {/* Message Body */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <MessageSquare className="w-4 h-4 text-emerald-400" />
                  SMS Message Text (English + Hindi recommended)
                </label>
                <div className="text-xs text-slate-400 flex items-center gap-2">
                  <span>Chars: <strong className="font-mono text-slate-200">{messageBody.length}</strong></span>
                  <span>Parts: <strong className="font-mono text-cyan-400">{Math.ceil(messageBody.length / 160) || 1}</strong></span>
                </div>
              </div>
              <textarea
                value={messageBody}
                onChange={(e) => setMessageBody(e.target.value)}
                rows={4}
                required
                className="w-full px-3.5 py-2.5 bg-slate-800/90 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500 text-xs leading-relaxed font-sans transition-colors resize-none"
                placeholder="Type emergency alert text here..."
              />
            </div>

            {/* Gateway & Dispatch Footer */}
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-slate-800">
              <div className="flex items-center space-x-2 text-xs text-slate-400 bg-slate-800/60 px-3 py-1.5 rounded-lg border border-slate-700/50">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                <span>Modem: <strong className="text-slate-200">SIM7600G-H Edge Modem</strong> (Offline Standalone Enabled)</span>
              </div>

              <div className="flex items-center space-x-3 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={isSending || !messageBody.trim()}
                  className="flex-1 sm:flex-initial px-5 py-2.5 bg-gradient-to-r from-red-600 via-amber-600 to-red-600 hover:from-red-500 hover:to-amber-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-red-900/30 flex items-center justify-center space-x-2 disabled:opacity-50 transition-all hover:scale-[1.02] active:scale-[0.98]"
                >
                  {isSending ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Broadcasting SMS...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      <span>Broadcast SMS to {recipientCount.toLocaleString()} Citizens</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
