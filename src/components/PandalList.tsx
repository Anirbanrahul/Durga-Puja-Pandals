'use client';

import { useState, useMemo } from 'react';
import {
  Pandal,
  ActiveLocation,
  RadiusFilter,
  SortOption,
} from '@/types';
import {
  formatDistance,
  getGoogleMapsDirectionUrl,
} from '@/lib/geoUtils';
import { persistFavorites, retrieveFavorites } from '@/lib/storageUtils';
import {
  Search,
  SlidersHorizontal,
  Navigation,
  Utensils,
  Train,
  Sparkles,
  MapPin,
  Heart,
  Share2,
  ExternalLink,
  ChevronRight,
  Filter,
} from 'lucide-react';

interface PandalListProps {
  pandals: Pandal[];
  userLocation: ActiveLocation;
  selectedPandalId?: string | null;
  onSelectPandal: (pandal: Pandal) => void;
  onFindFoodNearPandal: (pandal: Pandal) => void;
  onShowOnMap?: (pandal: Pandal) => void;
  radiusMeters: RadiusFilter;
  onRadiusChange: (radius: RadiusFilter) => void;
}

const RADIUS_OPTIONS: { label: string; value: RadiusFilter }[] = [
  { label: 'All', value: 0 },
  { label: '1 km', value: 1000 },
  { label: '3 km', value: 3000 },
  { label: '5 km', value: 5000 },
  { label: '10 km', value: 10000 },
];

export default function PandalList({
  pandals,
  userLocation,
  selectedPandalId,
  onSelectPandal,
  onFindFoodNearPandal,
  onShowOnMap,
  radiusMeters,
  onRadiusChange,
}: PandalListProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedZone, setSelectedZone] = useState<string>('All');
  const [sortBy, setSortBy] = useState<SortOption>('distance');
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(() => {
    return new Set(retrieveFavorites());
  });
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);

  // Toggle Favorite
  const toggleFavorite = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setFavoriteIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      persistFavorites(Array.from(next));
      return next;
    });
  };

  // Extract unique zones for filtering
  const availableZones = useMemo(() => {
    const zones = new Set<string>();
    pandals.forEach((p) => {
      if (p.zone) zones.add(p.zone);
    });
    return ['All', ...Array.from(zones)];
  }, [pandals]);

  // Filter & Sort Logic
  const filteredPandals = useMemo(() => {
    return pandals
      .filter((p) => {
        // Radius filter
        if (radiusMeters > 0 && p.distanceMeters !== undefined) {
          if (p.distanceMeters > radiusMeters) return false;
        }

        // Zone filter
        if (selectedZone !== 'All' && p.zone !== selectedZone) {
          return false;
        }

        // Favorites only
        if (showFavoritesOnly && !favoriteIds.has(p.id)) {
          return false;
        }

        // Search Query
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchName = p.name.toLowerCase().includes(q);
          const matchDesc = p.description.toLowerCase().includes(q);
          const matchZone = p.zone.toLowerCase().includes(q);
          const matchMetro = p.nearestMetro?.toLowerCase().includes(q);
          const matchFamous = p.famousFor?.toLowerCase().includes(q);
          return (
            matchName || matchDesc || matchZone || matchMetro || matchFamous
          );
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'distance') {
          return (a.distanceMeters || 0) - (b.distanceMeters || 0);
        }
        if (sortBy === 'alphabetical') {
          return a.name.localeCompare(b.name);
        }
        if (sortBy === 'zone') {
          return a.zone.localeCompare(b.zone) || a.name.localeCompare(b.name);
        }
        return 0;
      });
  }, [
    pandals,
    radiusMeters,
    selectedZone,
    showFavoritesOnly,
    favoriteIds,
    searchQuery,
    sortBy,
  ]);

  const handleSharePandal = async (pandal: Pandal, e: React.MouseEvent) => {
    e.stopPropagation();
    const shareText = `Check out ${pandal.name} (${pandal.zone}) for Durga Puja Parikrama!\nLocation: https://www.google.com/maps?q=${pandal.lat},${pandal.lng}`;

    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: pandal.name,
          text: shareText,
        });
        return;
      } catch {
        // Fallback
      }
    }

    const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(
      shareText
    )}`;
    window.open(waUrl, '_blank');
  };

  return (
    <div className="flex flex-col h-full space-y-3">
      {/* Search & Main Filter Controls */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-3 space-y-2.5 backdrop-blur-md">
        {/* Search Bar */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search pandals (e.g. Bagbazar, Maddox Square, Ekdalia, theme)..."
            className="w-full bg-slate-950 border border-slate-800 focus:border-amber-400 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-white"
            >
              Clear
            </button>
          )}
        </div>

        {/* Radius Filter Pills */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-1 overflow-x-auto py-0.5 no-scrollbar">
            <span className="text-[11px] font-bold text-slate-400 shrink-0 mr-1 flex items-center gap-1">
              <Filter className="w-3 h-3 text-amber-400" />
              Radius:
            </span>
            {RADIUS_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => onRadiusChange(opt.value)}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold shrink-0 transition-all ${
                  radiusMeters === opt.value
                    ? 'bg-amber-500 text-slate-950 shadow-sm shadow-amber-500/20'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Favorites toggle */}
          <button
            onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
              showFavoritesOnly
                ? 'bg-rose-600 text-white shadow-sm shadow-rose-600/30'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
            }`}
          >
            <Heart
              className={`w-3 h-3 ${
                showFavoritesOnly ? 'fill-white text-white' : 'text-rose-400'
              }`}
            />
            <span>Saved ({favoriteIds.size})</span>
          </button>
        </div>

        {/* Zone Selector and Sorting Row */}
        <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-800/80 text-xs">
          {/* Zone Dropdown */}
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-slate-400">Zone:</span>
            <select
              value={selectedZone}
              onChange={(e) => setSelectedZone(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-xs text-amber-200 focus:outline-none"
            >
              {availableZones.map((zone) => (
                <option key={zone} value={zone}>
                  {zone}
                </option>
              ))}
            </select>
          </div>

          {/* Sort By Dropdown */}
          <div className="flex items-center gap-1.5">
            <SlidersHorizontal className="w-3 h-3 text-slate-400" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-xs text-amber-200 focus:outline-none"
            >
              <option value="distance">Nearest First</option>
              <option value="alphabetical">Alphabetical (A-Z)</option>
              <option value="zone">By Zone</option>
            </select>
          </div>
        </div>
      </div>

      {/* Pandals Count & Active Info */}
      <div className="flex items-center justify-between px-1 text-xs text-slate-400">
        <span>
          Showing <strong className="text-amber-300">{filteredPandals.length}</strong>{' '}
          of {pandals.length} pandals
        </span>
        {radiusMeters > 0 && (
          <span className="text-[11px] text-amber-400">
            Within {radiusMeters / 1000} km of your pin
          </span>
        )}
      </div>

      {/* Pandals Card List */}
      <div className="flex-1 overflow-y-auto space-y-2.5 pr-0.5">
        {filteredPandals.length === 0 ? (
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 text-center space-y-3 mt-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 mx-auto flex items-center justify-center">
              <MapPin className="w-6 h-6 text-amber-400" />
            </div>
            <h3 className="text-sm font-bold text-white">No pandals found</h3>
            <p className="text-xs text-slate-400 max-w-xs mx-auto">
              No pandals match the active filters around your current location.
            </p>
            <div className="flex items-center justify-center gap-2 pt-1">
              <button
                onClick={() => onRadiusChange(0)}
                className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs"
              >
                Show All Kolkata Pandals
              </button>
              <button
                onClick={() => {
                  setSearchQuery('');
                  setSelectedZone('All');
                  setShowFavoritesOnly(false);
                }}
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-medium text-xs"
              >
                Reset Filters
              </button>
            </div>
          </div>
        ) : (
          filteredPandals.map((pandal) => {
            const isSelected = pandal.id === selectedPandalId;
            const isFav = favoriteIds.has(pandal.id);

            return (
              <div
                key={pandal.id}
                onClick={() => onSelectPandal(pandal)}
                className={`p-3.5 rounded-2xl border transition-all cursor-pointer relative ${
                  isSelected
                    ? 'bg-slate-900 border-amber-400/80 ring-2 ring-amber-400/30 shadow-xl'
                    : 'bg-slate-900/70 hover:bg-slate-900 border-slate-800/90 hover:border-amber-500/40 shadow-md'
                }`}
              >
                {/* Top Row: Zone & Badges */}
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md bg-rose-950/80 text-rose-300 border border-rose-800/50">
                      {pandal.zone}
                    </span>
                    {pandal.category && (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-300 border border-amber-500/30">
                        {pandal.category}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    {/* Distance Badge */}
                    {pandal.distanceMeters !== undefined && (
                      <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                        {formatDistance(pandal.distanceMeters)}
                      </span>
                    )}

                    {/* Bookmark Favorite */}
                    <button
                      onClick={(e) => toggleFavorite(pandal.id, e)}
                      aria-label="Save pandal to favorites"
                      className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-rose-400 transition-colors"
                    >
                      <Heart
                        className={`w-4 h-4 ${
                          isFav ? 'fill-rose-500 text-rose-500' : ''
                        }`}
                      />
                    </button>

                    {/* Share Button */}
                    <button
                      onClick={(e) => handleSharePandal(pandal, e)}
                      aria-label="Share pandal"
                      className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
                    >
                      <Share2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Pandal Name */}
                <h4 className="text-sm font-bold text-white tracking-tight mb-1">
                  {pandal.name}
                </h4>

                {/* Description */}
                <p className="text-xs text-slate-300 line-clamp-2 mb-2 leading-relaxed">
                  {pandal.description}
                </p>

                {/* Meta details: Metro & Highlights */}
                <div className="flex items-center gap-2 flex-wrap text-[11px] text-slate-400 mb-3">
                  {pandal.nearestMetro && (
                    <div className="flex items-center gap-1 bg-slate-950/70 px-2 py-0.5 rounded-md border border-slate-800 text-slate-300">
                      <Train className="w-3 h-3 text-rose-400 shrink-0" />
                      <span>{pandal.nearestMetro}</span>
                    </div>
                  )}

                  {pandal.famousFor && (
                    <div className="flex items-center gap-1 bg-amber-950/30 px-2 py-0.5 rounded-md border border-amber-800/40 text-amber-300">
                      <Sparkles className="w-3 h-3 text-amber-400 shrink-0" />
                      <span className="truncate max-w-[200px]">
                        {pandal.famousFor}
                      </span>
                    </div>
                  )}
                </div>

                {/* Action Buttons Row */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1 border-t border-slate-800/70">
                  {/* Walking Route */}
                  <a
                    href={getGoogleMapsDirectionUrl(
                      userLocation.lat,
                      userLocation.lng,
                      pandal.lat,
                      pandal.lng,
                      'walking'
                    )}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="py-2 px-2.5 rounded-xl bg-gradient-to-r from-rose-700 to-rose-600 hover:from-rose-600 hover:to-rose-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow transition-all active:scale-95 text-center"
                  >
                    <Navigation className="w-3.5 h-3.5" />
                    <span>Navigate</span>
                  </a>

                  {/* Nearby Food */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onFindFoodNearPandal(pandal);
                    }}
                    className="py-2 px-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 shadow transition-all active:scale-95 text-center"
                  >
                    <Utensils className="w-3.5 h-3.5" />
                    <span>Food Nearby</span>
                  </button>

                  {/* Show on Map (Desktop / Webview) */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onShowOnMap?.(pandal);
                    }}
                    className="col-span-2 sm:col-span-1 py-2 px-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs flex items-center justify-center gap-1 transition-all border border-slate-700"
                  >
                    <MapPin className="w-3.5 h-3.5 text-amber-400" />
                    <span>View Map</span>
                  </button>
                </div>
              </div>
            );
          })
        )}

        {/* Bottom Copyright Attribution */}
        <div className="pt-4 pb-6 text-center border-t border-slate-800/80 mt-4 space-y-1">
          <p className="text-xs text-slate-400 font-medium">
            Designed &amp; Developed with ❤️ by <strong className="text-amber-400 font-bold">Anirban Sarkar</strong>
          </p>
          <p className="text-[10px] text-slate-500">
            © 2026 Pujo Parikrama &amp; Companion • Free Kolkata Durga Puja Guide
          </p>
        </div>
      </div>
    </div>
  );
}
