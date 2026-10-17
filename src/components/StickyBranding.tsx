'use client';

import { Sparkles, Heart } from 'lucide-react';

interface StickyBrandingProps {
  className?: string;
  variant?: 'banner' | 'badge';
}

export default function StickyBranding({
  className = '',
  variant = 'banner',
}: StickyBrandingProps) {
  if (variant === 'badge') {
    return (
      <div
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-900/90 border border-amber-500/30 text-amber-300 text-[11px] font-medium shadow-sm backdrop-blur-sm select-none ${className}`}
      >
        <Sparkles className="w-3 h-3 text-amber-400 animate-pulse" />
        <span>By <strong className="text-white font-bold">Anirban Sarkar</strong></span>
      </div>
    );
  }

  return (
    <aside
      aria-label="Creator Branding"
      className={`sticky bottom-0 z-20 w-full bg-slate-950/95 backdrop-blur-md border-t border-amber-500/25 px-3 py-1.5 text-center shadow-lg transition-all ${className}`}
    >
      <div className="max-w-7xl mx-auto flex items-center justify-between text-[11px] text-slate-400">
        <div className="flex items-center gap-1">
          <span className="text-rose-400">❤️</span>
          <span className="hidden sm:inline">Kolkata Durga Puja 2026 •</span>
          <span>100% Free &amp; Offline Ready</span>
        </div>

        <div className="flex items-center gap-1.5">
          <span className="text-slate-400">Designed &amp; Developed by</span>
          <span className="px-2 py-0.5 rounded-md bg-gradient-to-r from-amber-500/20 to-rose-600/20 border border-amber-500/40 text-amber-300 font-bold tracking-wide shadow-sm">
            Anirban Sarkar
          </span>
        </div>
      </div>
    </aside>
  );
}
