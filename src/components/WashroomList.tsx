'use client';

import { useState, useMemo } from 'react';
import { Washroom, ActiveLocation, RadiusFilter } from '@/types';
import { formatDistance, getGoogleMapsDirectionUrl } from '@/lib/geoUtils';
import {
  Search,
  Navigation,
  Accessibility,
  Baby,
  Sparkles,
  MapPin,
  ExternalLink,
  Building,
  Train,
  CheckCircle2,
  SlidersHorizontal,
} from 'lucide-react';

interface WashroomListProps {
  washrooms: Washroom[];
  userLocation: ActiveLocation;
  onSelectWashroom?: (washroom: Washroom) => void;
  onShowOnMap?: (washroom: Washroom) => void;
  radiusMeters: RadiusFilter;
  onRadiusChange: (radius: RadiusFilter) => void;
  isLoading?: boolean;
}

const RADIUS_OPTIONS: { label: string; value: RadiusFilter }[] = [
  { label: 'All', value: 0 },
  { label: '1 km', value: 1000 },
  { label: '3 km', value: 3000 },
  { label: '5 km', value: 5000 },
];

export default function WashroomList({
  washrooms,
  userLocation,
  onSelectWashroom,
  onShowOnMap,
  radiusMeters,
  onRadiusChange,
  isLoading = false,
}: WashroomListProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string>('All');
  const [onlyAccessible, setOnlyAccessible] = useState(false);

  // Filter and search washrooms
  const filteredWashrooms = useMemo(() => {
    return washrooms.filter((w) => {
      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = w.name.toLowerCase().includes(q);
        const matchAddr = w.address?.toLowerCase().includes(q) || false;
        const matchType = w.type.toLowerCase().includes(q);
        if (!matchName && !matchAddr && !matchType) return false;
      }

      // Filter by type
      if (filterType !== 'All') {
        if (filterType === 'Mall' && !w.type.includes('Mall')) return false;
        if (filterType === 'Metro' && !w.type.includes('Metro')) return false;
        if (filterType === 'Public' && !w.type.includes('Public') && !w.type.includes('Sulabh')) return false;
      }

      // Wheelchair accessibility
      if (onlyAccessible && !w.wheelchairAccessible) {
        return false;
      }

      return true;
    });
  }, [washrooms, searchQuery, filterType, onlyAccessible]);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Top Banner: Emergency Notice */}
      <div className="p-3 mb-3 rounded-2xl bg-gradient-to-r from-blue-950/60 via-slate-900 to-cyan-950/40 border border-cyan-500/30 shrink-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-base">🚻</span>
          <h3 className="text-sm font-extrabold text-white">
            Emergency Public &amp; Mall Washrooms
          </h3>
        </div>
        <p className="text-xs text-cyan-200/80 leading-relaxed">
          Locate clean, accessible restrooms across Kolkata shopping malls, metro stations, and KMC Sulabh complexes during Pujo parikrama.
        </p>
      </div>

      {/* Search & Radius Filter Header */}
      <div className="space-y-2.5 mb-3 shrink-0">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search mall, metro station, or area..."
            className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-900/90 border border-slate-800 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-cyan-500 transition-colors"
          />
        </div>

        {/* Filter Pills */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
            {['All', 'Mall', 'Metro', 'Public'].map((type) => (
              <button
                key={type}
                onClick={() => setFilterType(type)}
                className={`py-1 px-2.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                  filterType === type
                    ? 'bg-cyan-500 text-slate-950 font-bold shadow-sm'
                    : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                {type === 'Mall' ? '🏢 Mall Toilets' : type === 'Metro' ? '🚇 Metro Stations' : type === 'Public' ? '🚽 KMC / Sulabh' : 'All Types'}
              </button>
            ))}

            <button
              onClick={() => setOnlyAccessible(!onlyAccessible)}
              className={`py-1 px-2.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1 ${
                onlyAccessible
                  ? 'bg-blue-600 text-white font-bold'
                  : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              <Accessibility className="w-3 h-3" />
              <span>Accessible</span>
            </button>
          </div>

          {/* Radius Selector */}
          <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-lg border border-slate-800 text-xs">
            <span className="text-[10px] text-slate-400 pl-1 font-semibold">Radius:</span>
            {RADIUS_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => onRadiusChange(opt.value)}
                className={`px-2 py-0.5 rounded text-[11px] font-bold transition-all ${
                  radiusMeters === opt.value
                    ? 'bg-cyan-500 text-slate-950'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Results Count Summary */}
      <div className="flex items-center justify-between text-xs text-slate-400 mb-2 px-1 shrink-0">
        <span>Found <strong className="text-cyan-400">{filteredWashrooms.length}</strong> washrooms</span>
        <span className="text-[10px]">Sorted by closest walking distance</span>
      </div>

      {/* Washrooms Scrollable List */}
      <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
        {filteredWashrooms.length === 0 ? (
          <div className="p-8 text-center bg-slate-900/40 rounded-2xl border border-slate-800 space-y-2 my-auto">
            <p className="text-3xl">🚻</p>
            <h4 className="text-sm font-bold text-white">No washrooms found</h4>
            <p className="text-xs text-slate-400 max-w-xs mx-auto">
              Try increasing your radius filter or resetting the search keywords.
            </p>
            <button
              onClick={() => {
                setSearchQuery('');
                setFilterType('All');
                setOnlyAccessible(false);
                onRadiusChange(0);
              }}
              className="py-1.5 px-4 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold transition-colors"
            >
              Show All Kolkata Washrooms
            </button>
          </div>
        ) : (
          filteredWashrooms.map((w) => (
            <div
              key={w.id}
              onClick={() => onSelectWashroom?.(w)}
              className="p-3.5 rounded-2xl bg-slate-900/80 hover:bg-slate-900 border border-slate-800/80 hover:border-cyan-500/40 transition-all space-y-2 group shadow-sm"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-xs font-bold text-white group-hover:text-cyan-300 transition-colors">
                      {w.name}
                    </span>
                    <span className="text-[9px] px-1.5 py-0.2 rounded-full font-bold bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                      {w.type}
                    </span>
                  </div>
                  {w.address && (
                    <p className="text-[11px] text-slate-400 line-clamp-1">
                      {w.address}
                    </p>
                  )}
                </div>

                {/* Distance Badge */}
                <div className="text-right shrink-0">
                  <span className="text-xs font-bold text-amber-400 font-mono">
                    {formatDistance(w.distanceMeters)}
                  </span>
                  <p className="text-[9px] text-slate-400">{w.fee || 'Free'}</p>
                </div>
              </div>

              {/* Amenity Badges */}
              <div className="flex items-center gap-2 text-[10px] text-slate-400 flex-wrap">
                {w.wheelchairAccessible && (
                  <span className="px-2 py-0.5 rounded-md bg-blue-950/60 text-blue-300 border border-blue-800/60 flex items-center gap-1 font-medium">
                    <Accessibility className="w-3 h-3" /> Wheelchair
                  </span>
                )}
                {w.femaleFriendly && (
                  <span className="px-2 py-0.5 rounded-md bg-rose-950/60 text-rose-300 border border-rose-800/60 flex items-center gap-1 font-medium">
                    <CheckCircle2 className="w-3 h-3 text-rose-400" /> Female Friendly
                  </span>
                )}
                {w.hasDiaperChanging && (
                  <span className="px-2 py-0.5 rounded-md bg-amber-950/60 text-amber-300 border border-amber-800/60 flex items-center gap-1 font-medium">
                    <Baby className="w-3 h-3" /> Baby Care
                  </span>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 pt-1 border-t border-slate-800/60">
                <a
                  href={getGoogleMapsDirectionUrl(userLocation.lat, userLocation.lng, w.lat, w.lng, 'walking')}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="flex-1 py-1.5 px-3 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-colors shadow-sm"
                >
                  <Navigation className="w-3 h-3" />
                  <span>Walking Route</span>
                  <ExternalLink className="w-2.5 h-2.5 opacity-70" />
                </a>

                {onShowOnMap && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onShowOnMap(w);
                    }}
                    className="py-1.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-300 font-semibold text-xs border border-slate-700 flex items-center gap-1"
                  >
                    <MapPin className="w-3 h-3 text-cyan-400" />
                    <span>Map</span>
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
