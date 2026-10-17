'use client';

import { useState, useEffect, useRef } from 'react';
import {
  ShieldAlert,
  PhoneCall,
  Share2,
  Volume2,
  VolumeX,
  Zap,
  X,
  Check,
  AlertTriangle,
  HeartPulse,
  Flame,
  Shield,
  LifeBuoy,
  MessageCircle,
} from 'lucide-react';
import { EmergencyContact, ActiveLocation } from '@/types';
import { generateSosMessage } from '@/lib/geoUtils';

interface EmergencyModalProps {
  isOpen: boolean;
  onClose: () => void;
  userLocation: ActiveLocation;
}

const EMERGENCY_CONTACTS: EmergencyContact[] = [
  {
    id: 'national-112',
    name: 'National Emergency Helpline',
    number: '112',
    category: 'police',
    description: 'Unified 24x7 emergency response for Police, Fire, and Ambulance.',
    badge: 'Single Emergency Number',
    urgent: true,
  },
  {
    id: 'kolkata-police-100',
    name: 'Kolkata Police Control Room',
    number: '100',
    category: 'police',
    description: 'Direct police assistance, crowd emergency, and Lalbazar control.',
    badge: 'Kolkata Police',
    urgent: true,
  },
  {
    id: 'medical-108',
    name: 'Ambulance & Medical Emergency',
    number: '108',
    category: 'medical',
    description: 'Govt. 24x7 emergency medical service & hospital transit.',
    badge: 'Fast Dispatch',
    urgent: true,
  },
  {
    id: 'fire-101',
    name: 'Fire & Rescue Services',
    number: '101',
    category: 'fire',
    description: 'Fire control room for electrical short-circuits & pandal safety.',
    badge: 'Fire Control',
  },
  {
    id: 'women-1091',
    name: 'Women Safety Helpline',
    number: '1091',
    category: 'women_child',
    description: 'Dedicated women helpline & Kolkata Police "Themis" mobile patrols.',
    badge: 'Confidential 24x7',
    urgent: true,
  },
  {
    id: 'child-1098',
    name: 'Childline Helpline',
    number: '1098',
    category: 'women_child',
    description: 'For lost children, child emergencies, and reunification desks.',
    badge: 'Lost Child Help',
  },
  {
    id: 'traffic-1073',
    name: 'Kolkata Traffic Police Helpline',
    number: '1073',
    category: 'helpline',
    description: 'Live traffic congestion, road diversions, and towed vehicle inquiry.',
    badge: 'Traffic Desk',
  },
  {
    id: 'lalbazar-landline',
    name: 'Lalbazar HQ Direct Line',
    number: '03322143230',
    category: 'police',
    description: 'Central Police HQ landline switchboard for Durga Puja festival.',
    badge: 'HQ Landline',
  },
  {
    id: 'disaster-1070',
    name: 'State Disaster Management Desk',
    number: '1070',
    category: 'helpline',
    description: 'West Bengal Disaster Management Department toll-free desk.',
    badge: 'Disaster Desk',
  },
];

export default function EmergencyModal({
  isOpen,
  onClose,
  userLocation,
}: EmergencyModalProps) {
  const [copied, setCopied] = useState(false);
  const [isSirenPlaying, setIsSirenPlaying] = useState(false);
  const [isStrobeActive, setIsStrobeActive] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const oscillatorRef = useRef<OscillatorNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Stop siren & strobe on unmount or close
  useEffect(() => {
    if (!isOpen) {
      stopSiren();
      setIsStrobeActive(false);
    }
    return () => {
      stopSiren();
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isOpen]);

  // Audio Siren generator using Web Audio API (zero dependencies, works 100% offline)
  const toggleSiren = () => {
    if (isSirenPlaying) {
      stopSiren();
    } else {
      startSiren();
    }
  };

  const startSiren = () => {
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AudioCtx();
      audioContextRef.current = ctx;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(600, ctx.currentTime);

      gain.gain.setValueAtTime(0.8, ctx.currentTime);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();

      oscillatorRef.current = osc;
      gainNodeRef.current = gain;
      setIsSirenPlaying(true);

      // Alternating frequency pattern for loud European/Indian emergency siren
      let high = true;
      intervalRef.current = setInterval(() => {
        if (oscillatorRef.current && audioContextRef.current) {
          const now = audioContextRef.current.currentTime;
          oscillatorRef.current.frequency.exponentialRampToValueAtTime(
            high ? 960 : 540,
            now + 0.35
          );
          high = !high;
        }
      }, 400);
    } catch (e) {
      console.warn('AudioContext not allowed yet:', e);
    }
  };

  const stopSiren = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (oscillatorRef.current) {
      try {
        oscillatorRef.current.stop();
        oscillatorRef.current.disconnect();
      } catch {
        // Ignore
      }
      oscillatorRef.current = null;
    }
    if (audioContextRef.current) {
      try {
        audioContextRef.current.close();
      } catch {
        // Ignore
      }
      audioContextRef.current = null;
    }
    setIsSirenPlaying(false);
  };

  // SOS Location Share Handler
  const handleShareSos = async () => {
    const text = generateSosMessage(userLocation.lat, userLocation.lng);

    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: '🚨 EMERGENCY SOS - Pujo Parikrama',
          text,
        });
        return;
      } catch {
        // Fallback to whatsapp / clipboard if user cancels or unsupported
      }
    }

    // Direct WhatsApp link fallback
    const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
    window.open(whatsappUrl, '_blank');

    // Also copy to clipboard
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch {
      // Ignore
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      {/* Strobe screen overlay if activated */}
      {isStrobeActive && (
        <div className="fixed inset-0 z-[10000] pointer-events-none animate-pulse bg-red-600/60" />
      )}

      <div className="bg-slate-900 border-2 border-red-500/80 rounded-3xl w-full max-w-lg max-h-[92vh] flex flex-col shadow-2xl overflow-hidden relative">
        {/* Header Banner */}
        <div className="bg-gradient-to-r from-red-700 via-rose-700 to-amber-600 px-5 py-4 flex items-center justify-between text-white shadow-md">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center animate-bounce">
              <ShieldAlert className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold tracking-tight">SOS & Emergency Hub</h2>
              <p className="text-xs text-rose-100 font-medium">
                100% Offline Accessible • One-Tap Direct Dial
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close emergency modal"
            className="w-9 h-9 rounded-full bg-black/30 hover:bg-black/50 flex items-center justify-center text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4">
          {/* Live SOS Location Card */}
          <div className="bg-gradient-to-br from-red-950/70 to-slate-900 border border-red-500/40 rounded-2xl p-4 shadow-inner">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-red-500/20 text-red-400 border border-red-500/30">
                  <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
                  Live GPS Coordinates
                </span>
                <p className="text-sm font-semibold text-white mt-1">
                  {userLocation.address || 'Active Kolkata Coordinates'}
                </p>
                <p className="text-xs text-red-300 font-mono">
                  {userLocation.lat.toFixed(5)}, {userLocation.lng.toFixed(5)}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                onClick={handleShareSos}
                className="w-full py-2.5 px-3 rounded-xl font-bold text-xs bg-red-600 hover:bg-red-500 active:scale-95 text-white flex items-center justify-center gap-2 shadow-lg shadow-red-900/40 transition-all"
              >
                <Share2 className="w-4 h-4" />
                <span>Share My SOS Location</span>
              </button>

              <a
                href={`https://api.whatsapp.com/send?text=${encodeURIComponent(
                  generateSosMessage(userLocation.lat, userLocation.lng)
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-2.5 px-3 rounded-xl font-bold text-xs bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white flex items-center justify-center gap-2 shadow-lg transition-all"
              >
                <MessageCircle className="w-4 h-4" />
                <span>WhatsApp SOS Link</span>
              </a>
            </div>

            {copied && (
              <p className="text-[11px] text-emerald-400 mt-2 text-center flex items-center justify-center gap-1">
                <Check className="w-3.5 h-3.5" />
                SOS message & Google Maps link copied to clipboard!
              </p>
            )}
          </div>

          {/* Quick Siren & Strobe Flashlight Tools */}
          <div className="grid grid-cols-2 gap-2.5">
            <button
              onClick={toggleSiren}
              className={`py-3 px-3 rounded-2xl border text-xs font-semibold flex flex-col items-center justify-center gap-1.5 transition-all active:scale-95 ${
                isSirenPlaying
                  ? 'bg-red-600 border-red-400 text-white animate-pulse shadow-lg shadow-red-700/50'
                  : 'bg-slate-800/80 border-slate-700 text-slate-200 hover:bg-slate-800'
              }`}
            >
              {isSirenPlaying ? (
                <>
                  <VolumeX className="w-5 h-5 text-white animate-bounce" />
                  <span>STOP LOUD SIREN</span>
                </>
              ) : (
                <>
                  <Volume2 className="w-5 h-5 text-red-400" />
                  <span>Sound Alarm Siren</span>
                </>
              )}
            </button>

            <button
              onClick={() => setIsStrobeActive(!isStrobeActive)}
              className={`py-3 px-3 rounded-2xl border text-xs font-semibold flex flex-col items-center justify-center gap-1.5 transition-all active:scale-95 ${
                isStrobeActive
                  ? 'bg-amber-600 border-amber-400 text-white animate-pulse shadow-lg'
                  : 'bg-slate-800/80 border-slate-700 text-slate-200 hover:bg-slate-800'
              }`}
            >
              <Zap className={`w-5 h-5 ${isStrobeActive ? 'text-white' : 'text-amber-400'}`} />
              <span>{isStrobeActive ? 'Stop Strobe Light' : 'Screen Strobe Flare'}</span>
            </button>
          </div>

          {/* Emergency Telephone Directory */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Tap to Call Directly (Offline)
              </h3>
              <span className="text-[10px] text-amber-400 font-medium">Free Calls</span>
            </div>

            <div className="space-y-2">
              {EMERGENCY_CONTACTS.map((contact) => {
                const getIcon = () => {
                  switch (contact.category) {
                    case 'police':
                      return <Shield className="w-4 h-4 text-sky-400" />;
                    case 'medical':
                      return <HeartPulse className="w-4 h-4 text-emerald-400" />;
                    case 'fire':
                      return <Flame className="w-4 h-4 text-orange-400" />;
                    case 'women_child':
                      return <AlertTriangle className="w-4 h-4 text-rose-400" />;
                    default:
                      return <LifeBuoy className="w-4 h-4 text-amber-400" />;
                  }
                };

                return (
                  <a
                    key={contact.id}
                    href={`tel:${contact.number}`}
                    className={`block p-3 rounded-2xl border transition-all hover:scale-[1.01] active:scale-[0.98] ${
                      contact.urgent
                        ? 'bg-slate-900 border-red-500/30 hover:border-red-500/60'
                        : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-slate-800 flex items-center justify-center shrink-0">
                          {getIcon()}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="text-sm font-semibold text-white">
                              {contact.name}
                            </h4>
                            {contact.badge && (
                              <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-300 font-medium">
                                {contact.badge}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-400 line-clamp-1">
                            {contact.description}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 bg-red-600/20 text-red-400 px-3 py-1.5 rounded-xl border border-red-500/30 shrink-0 font-bold text-sm">
                        <PhoneCall className="w-3.5 h-3.5" />
                        <span>{contact.number}</span>
                      </div>
                    </div>
                  </a>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
          <span>In heavy pandal crowd: Stay calm, hold hands, stay with crowd flow.</span>
          <button
            onClick={onClose}
            className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-medium"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
