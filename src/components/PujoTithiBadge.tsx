'use client';

import { useState } from 'react';
import { Calendar, Sparkles, X, Clock, Flame, ChevronRight } from 'lucide-react';
import { getCurrentPujoTithi, PUJO_2026_SCHEDULE, PujoTithiInfo } from '@/lib/kolkataCivicData';

interface PujoTithiBadgeProps {
  className?: string;
}

export default function PujoTithiBadge({ className = '' }: PujoTithiBadgeProps) {
  const [isOpen, setIsOpen] = useState(false);
  const activeTithi = getCurrentPujoTithi();

  return (
    <>
      {/* Corner Small Live Tithi Badge */}
      <button
        onClick={() => setIsOpen(true)}
        className={`group flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gradient-to-r from-rose-950/80 via-slate-900 to-amber-950/80 border border-amber-500/40 hover:border-amber-400 text-left transition-all active:scale-95 shadow-md shadow-rose-950/50 cursor-pointer ${className}`}
        title="Click to view full Durga Puja Tithi schedule & Sandhi Puja timing"
      >
        <div className="w-2 h-2 rounded-full bg-amber-400 animate-ping shrink-0" />
        <div className="flex flex-col leading-tight">
          <div className="flex items-center gap-1">
            <span className="text-[10px] font-extrabold text-amber-300 uppercase tracking-wider">
              {activeTithi.dayName}
            </span>
            <span className="text-[9px] px-1 py-0.1 rounded bg-rose-600/40 text-rose-300 font-bold">
              Running
            </span>
          </div>
          <span className="text-[10px] font-medium text-amber-200/90 hidden xs:inline">
            {activeTithi.bengaliName} • Schedule 📅
          </span>
        </div>
      </button>

      {/* Pujo Tithi & Festival Calendar Modal */}
      {isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[100000] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200"
        >
          <div className="bg-slate-900 border border-amber-500/40 rounded-3xl max-w-lg w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="p-4 border-b border-slate-800 bg-gradient-to-r from-rose-950 via-slate-900 to-amber-950 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center">
                  <Flame className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-white flex items-center gap-2">
                    <span>Durga Puja 2026 Tithi Schedule</span>
                  </h3>
                  <p className="text-xs text-amber-300/80">
                    শারদোৎসবের দিনলিপি ও তিথি নির্ঘণ্ট
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body: 5-Day Schedule Cards */}
            <div className="p-4 overflow-y-auto space-y-3">
              <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between text-xs text-amber-300">
                <span className="flex items-center gap-1.5 font-bold">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  Currently Running:
                </span>
                <span className="font-extrabold text-white bg-rose-600 px-2 py-0.5 rounded-full text-[11px]">
                  {activeTithi.dayName} ({activeTithi.bengaliName})
                </span>
              </div>

              {PUJO_2026_SCHEDULE.map((item) => {
                const isCurrent = item.tithiCode === activeTithi.tithiCode;
                return (
                  <div
                    key={item.tithiCode}
                    className={`p-3.5 rounded-2xl border transition-all ${
                      isCurrent
                        ? 'bg-gradient-to-r from-rose-950/60 to-amber-950/40 border-amber-500/60 shadow-lg shadow-amber-950/40'
                        : 'bg-slate-950/60 border-slate-800'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-black text-amber-300">
                          {item.dayName}
                        </span>
                        <span className="text-xs font-semibold text-rose-400 font-serif">
                          ({item.bengaliName})
                        </span>
                      </div>
                      <span className="text-[11px] font-mono text-slate-400 bg-slate-900 px-2 py-0.5 rounded-full border border-slate-800">
                        {item.dateStr}
                      </span>
                    </div>

                    <p className="text-xs text-slate-300 font-medium mb-2">
                      {item.significance}
                    </p>

                    {item.sandhiPujaTime && (
                      <div className="p-2 rounded-xl bg-red-950/40 border border-red-500/40 mb-2 flex items-center gap-2 text-xs">
                        <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                        <span className="font-bold text-amber-300">Sandhi Puja (সন্ধিপূজা):</span>
                        <span className="font-mono text-white font-bold">{item.sandhiPujaTime}</span>
                      </div>
                    )}

                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {item.rituals.map((r, i) => (
                        <span
                          key={i}
                          className="text-[10px] px-2 py-0.5 rounded-md bg-slate-900 border border-slate-800 text-slate-300"
                        >
                          • {r}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Footer */}
            <div className="p-3 bg-slate-950 border-t border-slate-800 text-center">
              <button
                onClick={() => setIsOpen(false)}
                className="w-full py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition-colors"
              >
                Close Pujo Timetable
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
