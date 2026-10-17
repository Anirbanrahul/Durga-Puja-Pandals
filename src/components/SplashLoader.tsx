'use client';

import { useState, useEffect } from 'react';
import { Compass, Sparkles, MapPin, ShieldAlert, ArrowRight } from 'lucide-react';

interface SplashLoaderProps {
  onComplete?: () => void;
  minDuration?: number; // duration in ms
}

export default function SplashLoader({
  onComplete,
  minDuration = 1800,
}: SplashLoaderProps) {
  const [isVisible, setIsVisible] = useState(true);
  const [isFadingOut, setIsFadingOut] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);

  const steps = [
    'শারদোৎসবের আনন্দ ও আগমনী...',
    'Loading Kolkata Durga Puja Pandals...',
    'Calibrating Walking Routes & Distances...',
    'Ready for Parikrama & Adda!',
  ];

  useEffect(() => {
    // Step progression
    const stepInterval = setInterval(() => {
      setLoadingStep((prev) => (prev < steps.length - 1 ? prev + 1 : prev));
    }, minDuration / steps.length);

    // Fade out and finish
    const timer = setTimeout(() => {
      handleDismiss();
    }, minDuration);

    return () => {
      clearInterval(stepInterval);
      clearTimeout(timer);
    };
  }, [minDuration]);

  const handleDismiss = () => {
    setIsFadingOut(true);
    setTimeout(() => {
      setIsVisible(false);
      onComplete?.();
    }, 450);
  };

  if (!isVisible) return null;

  return (
    <div
      className={`fixed inset-0 z-[100000] bg-slate-950 text-white flex flex-col items-center justify-between p-6 select-none transition-opacity duration-500 ${
        isFadingOut ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
    >
      {/* Background Festive Ambient Glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-gradient-to-tr from-rose-700/30 via-amber-500/20 to-red-600/30 rounded-full blur-3xl pointer-events-none animate-pulse" />
      <div className="absolute bottom-10 right-10 w-64 h-64 bg-amber-500/15 rounded-full blur-2xl pointer-events-none" />

      {/* Top Header Branding */}
      <div className="w-full flex items-center justify-between pt-2 max-w-md relative z-10">
        <span className="text-[11px] font-bold tracking-widest uppercase text-amber-400/80">
          Kolkata Pujo 2026
        </span>
        <button
          onClick={handleDismiss}
          className="text-xs font-semibold px-3 py-1 rounded-full bg-slate-900/80 border border-amber-500/30 text-amber-300 hover:text-white hover:bg-slate-800 transition-colors flex items-center gap-1"
        >
          <span>Skip</span>
          <ArrowRight className="w-3 h-3" />
        </button>
      </div>

      {/* Center Festive Art & Divine Motif */}
      <div className="flex flex-col items-center text-center max-w-sm relative z-10 space-y-5 my-auto">
        {/* Animated Divine Idol / Trishul Badge */}
        <div className="relative group">
          <div className="absolute -inset-2 bg-gradient-to-r from-amber-500 via-rose-600 to-amber-500 rounded-3xl blur-xl opacity-75 animate-tilt animate-pulse" />
          <div className="relative w-28 h-28 rounded-3xl bg-slate-950 border-2 border-amber-400/60 p-4 shadow-2xl flex items-center justify-center flex-col">
            <svg
              className="w-16 h-16 text-amber-400 drop-shadow-[0_0_12px_rgba(245,158,11,0.6)] animate-bounce"
              viewBox="0 0 512 512"
              fill="currentColor"
            >
              {/* Trishul Path */}
              <path d="M256 60 L270 180 L290 190 L260 210 L256 420 L252 210 L222 190 L242 180 Z" fill="#f59e0b" />
              <path d="M222 190 C180 170 140 120 150 90 C160 85 180 110 200 160 C210 180 220 188 222 190 Z" fill="#fbbf24" />
              <path d="M290 190 C332 170 372 120 362 90 C352 85 332 110 312 160 C302 180 292 188 290 190 Z" fill="#fbbf24" />
              {/* Third Eye (Trinayan) */}
              <ellipse cx="256" cy="260" rx="14" ry="24" fill="#dc2626" />
              <circle cx="256" cy="260" r="5" fill="#fef08a" />
            </svg>
          </div>
        </div>

        {/* Bengali Festive Title */}
        <div className="space-y-1">
          <p className="text-sm font-semibold text-rose-400 tracking-wide">
            শারদোৎসবের শুভেচ্ছা
          </p>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-amber-400 to-rose-400">
            Pujo Parikrama
          </h1>
          <p className="text-xs text-amber-200/80 font-medium">
            &amp; Companion Web App
          </p>
        </div>

        {/* Feature Pills */}
        <div className="flex items-center justify-center gap-2 text-[11px] text-slate-300 font-medium flex-wrap pt-1">
          <span className="px-2.5 py-1 rounded-full bg-slate-900 border border-slate-800 flex items-center gap-1">
            <Compass className="w-3 h-3 text-amber-400" /> Live GPS &amp; Search
          </span>
          <span className="px-2.5 py-1 rounded-full bg-slate-900 border border-slate-800 flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-rose-400" /> 34+ Top Pandals
          </span>
          <span className="px-2.5 py-1 rounded-full bg-slate-900 border border-slate-800 flex items-center gap-1">
            <ShieldAlert className="w-3 h-3 text-red-400" /> Offline SOS
          </span>
        </div>

        {/* Loading Step Text & Progress Bar */}
        <div className="w-full max-w-xs space-y-2 pt-2">
          <div className="h-1.5 w-full bg-slate-900 rounded-full overflow-hidden border border-slate-800">
            <div
              className="h-full bg-gradient-to-r from-rose-600 to-amber-400 transition-all duration-300 ease-out"
              style={{
                width: `${((loadingStep + 1) / steps.length) * 100}%`,
              }}
            />
          </div>
          <p className="text-xs text-slate-400 font-medium h-5 transition-all">
            {steps[loadingStep]}
          </p>
        </div>
      </div>

      {/* Bottom Copyright Attribution */}
      <div className="w-full text-center relative z-10 pb-2">
        <p className="text-xs text-slate-400 font-medium">
          Designed &amp; Developed by{' '}
          <strong className="text-amber-400 font-bold">Anirban Sarkar</strong>
        </p>
        <p className="text-[10px] text-slate-500 mt-0.5">
          © 2026 Pujo Parikrama &amp; Companion • Free &amp; Offline Ready
        </p>
      </div>
    </div>
  );
}
