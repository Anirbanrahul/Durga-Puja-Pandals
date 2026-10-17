'use client';

import { useState, useMemo } from 'react';
import { Hospital, ActiveLocation, RadiusFilter } from '@/types';
import { formatDistance, getGoogleMapsDirectionUrl } from '@/lib/geoUtils';
import {
  PhoneCall,
  Navigation,
  ShieldAlert,
  Search,
  ExternalLink,
  MapPin,
  HeartPulse,
  Flame,
  AlertTriangle,
  Ambulance,
} from 'lucide-react';

interface HospitalListProps {
  hospitals: Hospital[];
  userLocation: ActiveLocation;
  onSelectHospital?: (hospital: Hospital) => void;
  onShowOnMap?: (hospital: Hospital) => void;
  radiusMeters: RadiusFilter;
  onRadiusChange: (radius: RadiusFilter) => void;
  isLoading?: boolean;
}

const RADIUS_OPTIONS: { label: string; value: RadiusFilter }[] = [
  { label: 'All', value: 0 },
  { label: '3 km', value: 3000 },
  { label: '5 km', value: 5000 },
  { label: '10 km', value: 10000 },
];

export default function HospitalList({
  hospitals,
  userLocation,
  onSelectHospital,
  onShowOnMap,
  radiusMeters,
  onRadiusChange,
  isLoading = false,
}: HospitalListProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string>('All');

  // Filter hospitals
  const filteredHospitals = useMemo(() => {
    return hospitals.filter((h) => {
      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = h.name.toLowerCase().includes(q);
        const matchAddr = h.address?.toLowerCase().includes(q) || false;
        const matchType = h.type.toLowerCase().includes(q);
        if (!matchName && !matchAddr && !matchType) return false;
      }

      // Filter by type
      if (filterType !== 'All') {
        if (filterType === 'Govt' && !h.type.includes('Government')) return false;
        if (filterType === 'Private' && !h.type.includes('Private')) return false;
        if (filterType === 'Cardiac' && !h.type.includes('Cardiac')) return false;
      }

      return true;
    });
  }, [hospitals, searchQuery, filterType]);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Emergency Hotline Alert Banner */}
      <div className="p-3 mb-3 rounded-2xl bg-gradient-to-r from-red-950/80 via-rose-900/60 to-red-950/80 border border-red-500/50 shrink-0 shadow-lg shadow-red-950/40">
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-red-400 animate-pulse" />
            <h3 className="text-sm font-extrabold text-white">
              24/7 Medical Emergency &amp; Trauma Hub
            </h3>
          </div>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-600 text-white animate-pulse">
            24x7 Active
          </span>
        </div>
        <p className="text-xs text-red-200/90 mb-2">
          Immediate access to Kolkata apex trauma centers, cardiac units, and ambulances.
        </p>

        {/* Quick Dial Ambulances */}
        <div className="flex items-center gap-2 pt-1 border-t border-red-800/60">
          <a
            href="tel:102"
            className="flex-1 py-1.5 px-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-black flex items-center justify-center gap-1.5 shadow-md active:scale-95 transition-all"
          >
            <Ambulance className="w-3.5 h-3.5" />
            <span>Call 102 (Govt Ambulance)</span>
          </a>
          <a
            href="tel:108"
            className="flex-1 py-1.5 px-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-red-300 border border-red-500/40 text-xs font-bold flex items-center justify-center gap-1.5 shadow-md active:scale-95 transition-all"
          >
            <PhoneCall className="w-3.5 h-3.5 text-red-400" />
            <span>Dial 108 Emergency</span>
          </a>
        </div>
      </div>

      {/* Search & Radius Filter */}
      <div className="space-y-2 mb-3 shrink-0">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search hospital by name, area, or facility..."
            className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-900/90 border border-slate-800 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-red-500 transition-colors"
          />
        </div>

        {/* Filter Chips & Radius */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
            {['All', 'Govt', 'Private', 'Cardiac'].map((type) => (
              <button
                key={type}
                onClick={() => setFilterType(type)}
                className={`py-1 px-2.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                  filterType === type
                    ? 'bg-red-600 text-white font-bold shadow-sm'
                    : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                {type === 'Govt' ? '🏥 Apex Govt' : type === 'Private' ? '🏨 Private Multispeciality' : type === 'Cardiac' ? '❤️ Cardiac Care' : 'All Hospitals'}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-lg border border-slate-800 text-xs">
            <span className="text-[10px] text-slate-400 pl-1 font-semibold">Radius:</span>
            {RADIUS_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => onRadiusChange(opt.value)}
                className={`px-2 py-0.5 rounded text-[11px] font-bold transition-all ${
                  radiusMeters === opt.value
                    ? 'bg-red-600 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Count & Header */}
      <div className="flex items-center justify-between text-xs text-slate-400 mb-2 px-1 shrink-0">
        <span>Found <strong className="text-red-400">{filteredHospitals.length}</strong> hospitals nearby</span>
        <span className="text-[10px]">Sorted by driving distance</span>
      </div>

      {/* Scrollable Hospitals List */}
      <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
        {filteredHospitals.length === 0 ? (
          <div className="p-8 text-center bg-slate-900/40 rounded-2xl border border-slate-800 space-y-2 my-auto">
            <p className="text-3xl">🏥</p>
            <h4 className="text-sm font-bold text-white">No hospitals found</h4>
            <p className="text-xs text-slate-400 max-w-xs mx-auto">
              Try increasing your search radius to cover all of Kolkata.
            </p>
            <button
              onClick={() => {
                setSearchQuery('');
                setFilterType('All');
                onRadiusChange(0);
              }}
              className="py-1.5 px-4 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold transition-colors"
            >
              Show All Kolkata Hospitals
            </button>
          </div>
        ) : (
          filteredHospitals.map((h) => (
            <div
              key={h.id}
              onClick={() => onSelectHospital?.(h)}
              className="p-3.5 rounded-2xl bg-slate-900/80 hover:bg-slate-900 border border-slate-800/80 hover:border-red-500/40 transition-all space-y-2.5 group shadow-sm"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-xs font-bold text-white group-hover:text-red-300 transition-colors">
                      {h.name}
                    </span>
                    <span className="text-[9px] px-1.5 py-0.2 rounded-full font-bold bg-red-500/15 text-red-300 border border-red-500/30">
                      {h.type}
                    </span>
                  </div>
                  {h.address && (
                    <p className="text-[11px] text-slate-400 line-clamp-1">
                      {h.address}
                    </p>
                  )}
                </div>

                {/* Distance Badge */}
                <div className="text-right shrink-0">
                  <span className="text-xs font-bold text-amber-400 font-mono">
                    {formatDistance(h.distanceMeters)}
                  </span>
                  <p className="text-[9px] text-emerald-400 font-bold">24/7 Open</p>
                </div>
              </div>

              {/* Facilities Chips */}
              {h.facilities && h.facilities.length > 0 && (
                <div className="flex items-center gap-1.5 text-[10px] text-slate-300 flex-wrap">
                  {h.facilities.map((f, i) => (
                    <span
                      key={i}
                      className="px-2 py-0.5 rounded-md bg-slate-950 border border-slate-800 text-slate-300 font-medium"
                    >
                      • {f}
                    </span>
                  ))}
                </div>
              )}

              {/* Action Buttons: One-Tap Call Emergency & Maps Route */}
              <div className="flex items-center gap-2 pt-1.5 border-t border-slate-800/60">
                <a
                  href={`tel:${h.emergencyPhone}`}
                  onClick={(e) => e.stopPropagation()}
                  className="flex-1 py-1.5 px-3 rounded-xl bg-red-600 hover:bg-red-500 text-white font-extrabold text-xs flex items-center justify-center gap-1.5 transition-colors shadow-md active:scale-95"
                >
                  <PhoneCall className="w-3.5 h-3.5" />
                  <span>Call Emergency ({h.emergencyPhone})</span>
                </a>

                <a
                  href={getGoogleMapsDirectionUrl(userLocation.lat, userLocation.lng, h.lat, h.lng, 'driving')}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="py-1.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-red-300 border border-slate-700 font-bold text-xs flex items-center gap-1"
                  title="Driving / Ambulance Route on Google Maps"
                >
                  <Navigation className="w-3 h-3 text-red-400" />
                  <span>Route</span>
                  <ExternalLink className="w-2.5 h-2.5 opacity-70" />
                </a>

                {onShowOnMap && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onShowOnMap(h);
                    }}
                    className="py-1.5 px-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs border border-slate-700"
                    title="View on Live Map"
                  >
                    <MapPin className="w-3 h-3 text-amber-400" />
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
