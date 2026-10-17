'use client';

import dynamic from 'next/dynamic';
import { Loader2, Compass } from 'lucide-react';
import { Pandal, Restaurant, ActiveLocation } from '@/types';

interface MapContainerViewProps {
  userLocation: ActiveLocation;
  pandals: Pandal[];
  restaurants?: Restaurant[];
  selectedPandalId?: string | null;
  onSelectPandal?: (pandal: Pandal) => void;
  onFindFoodNearPandal?: (pandal: Pandal) => void;
  radiusMeters?: number;
  highlightedRestaurantId?: string | number | null;
}

// Dynamically import Leaflet container to prevent SSR window/document reference errors
const DynamicMapContainer = dynamic(
  () => import('./MapContainerViewInner'),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full min-h-[350px] bg-slate-900/90 border border-amber-500/30 rounded-2xl flex flex-col items-center justify-center p-6 text-center text-slate-400">
        <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mb-3">
          <Compass className="w-6 h-6 text-amber-400 animate-spin" />
        </div>
        <p className="text-sm font-semibold text-white">Loading Kolkata Interactive Map...</p>
        <p className="text-xs text-slate-400 mt-1">Preparing pandals, metro lines & festive pins</p>
      </div>
    ),
  }
);

export default function MapContainerView(props: MapContainerViewProps) {
  return <DynamicMapContainer {...props} />;
}
