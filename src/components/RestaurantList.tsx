'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  Restaurant,
  ActiveLocation,
  Pandal,
} from '@/types';
import { fetchNearbyRestaurants } from '@/lib/overpass';
import {
  formatDistance,
  getGoogleMapsDirectionUrl,
  getGoogleMapsSearchUrl,
} from '@/lib/geoUtils';
import {
  Utensils,
  MapPin,
  Navigation,
  ExternalLink,
  Loader2,
  RefreshCw,
  Search,
  Coffee,
  Sparkles,
  ArrowLeft,
  SlidersHorizontal,
} from 'lucide-react';

interface RestaurantListProps {
  userLocation: ActiveLocation;
  focusedPandal?: Pandal | null;
  onClearFocusedPandal?: () => void;
  onHighlightRestaurant?: (resto: Restaurant) => void;
  onLoadedRestaurants?: (restaurants: Restaurant[]) => void;
}

const RADIUS_OPTIONS = [
  { label: '500 m', value: 500 },
  { label: '1 km', value: 1000 },
  { label: '2 km', value: 2000 },
  { label: '5 km', value: 5000 },
];

export default function RestaurantList({
  userLocation,
  focusedPandal,
  onClearFocusedPandal,
  onHighlightRestaurant,
  onLoadedRestaurants,
}: RestaurantListProps) {
  const [radius, setRadius] = useState<number>(1000);
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [cuisineFilter, setCuisineFilter] = useState<string>('All');

  // Focal coordinates: either selected pandal or user's active location
  const focalPoint = useMemo(() => {
    if (focusedPandal) {
      return {
        lat: focusedPandal.lat,
        lng: focusedPandal.lng,
        name: focusedPandal.name,
        isPandal: true,
      };
    }
    return {
      lat: userLocation.lat,
      lng: userLocation.lng,
      name: userLocation.address || 'Your Current Location',
      isPandal: false,
    };
  }, [focusedPandal, userLocation]);

  // Fetch restaurants when focal point or radius changes
  useEffect(() => {
    let isCancelled = false;

    async function loadRestaurants() {
      setIsLoading(true);
      try {
        const data = await fetchNearbyRestaurants(
          focalPoint.lat,
          focalPoint.lng,
          radius
        );
        if (!isCancelled) {
          setRestaurants(data);
          onLoadedRestaurants?.(data);
        }
      } catch (err) {
        console.error('Failed to load restaurants:', err);
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    }

    loadRestaurants();

    return () => {
      isCancelled = true;
    };
  }, [focalPoint.lat, focalPoint.lng, radius, onLoadedRestaurants]);

  // Filter and search
  const filteredRestaurants = useMemo(() => {
    return restaurants.filter((r) => {
      if (cuisineFilter !== 'All') {
        const cLower = (r.cuisine || '').toLowerCase();
        if (!cLower.includes(cuisineFilter.toLowerCase())) return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = r.name.toLowerCase().includes(q);
        const matchCuisine = (r.cuisine || '').toLowerCase().includes(q);
        const matchAddr = (r.address || '').toLowerCase().includes(q);
        return matchName || matchCuisine || matchAddr;
      }

      return true;
    });
  }, [restaurants, cuisineFilter, searchQuery]);

  // Google Maps Deep Link URL for all restaurants around this point
  const googleMapsSearchAllUrl = `https://www.google.com/maps/search/restaurants/@${focalPoint.lat},${focalPoint.lng},16z`;

  return (
    <div className="flex flex-col h-full space-y-3">
      {/* Focal Point Header */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-3.5 space-y-3 backdrop-blur-md">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center shrink-0">
              <Utensils className="w-4 h-4 text-amber-400" />
            </div>
            <div className="min-w-0">
              <span className="text-[10px] uppercase font-bold text-amber-400">
                {focalPoint.isPandal ? 'Exploring Food Around Pandal' : 'Exploring Food Around You'}
              </span>
              <h3 className="text-xs font-bold text-white truncate max-w-[220px] sm:max-w-[340px]">
                {focalPoint.name}
              </h3>
            </div>
          </div>

          {focusedPandal && (
            <button
              onClick={onClearFocusedPandal}
              className="py-1 px-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] text-slate-300 hover:text-white flex items-center gap-1 shrink-0 transition-colors"
            >
              <ArrowLeft className="w-3 h-3" />
              <span>Back to My Location</span>
            </button>
          )}
        </div>

        {/* Radius Selector */}
        <div className="flex items-center justify-between gap-2 flex-wrap pt-1 border-t border-slate-800">
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-semibold text-slate-400">Radius:</span>
            <div className="flex gap-1">
              {RADIUS_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setRadius(opt.value)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                    radius === opt.value
                      ? 'bg-amber-500 text-slate-950 shadow-sm'
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Open Google Maps Deep Link */}
          <a
            href={googleMapsSearchAllUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="py-1 px-2.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 text-[11px] font-bold flex items-center gap-1 transition-all"
          >
            <ExternalLink className="w-3 h-3" />
            <span>Open in Google Maps</span>
          </a>
        </div>

        {/* Search & Cuisine Filter */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search dishes, biryani, rolls, cafe..."
              className="w-full bg-slate-950 border border-slate-800 focus:border-amber-400 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
            {['All', 'Biryani', 'Bengali', 'Rolls', 'Cafe', 'Chinese'].map((c) => (
              <button
                key={c}
                onClick={() => setCuisineFilter(c)}
                className={`px-2 py-1 rounded-lg text-[11px] font-medium shrink-0 transition-colors ${
                  cuisineFilter === c
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                    : 'bg-slate-950 text-slate-400 hover:text-slate-200'
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Result Count and Status */}
      <div className="flex items-center justify-between px-1 text-xs text-slate-400">
        <span>
          Found <strong className="text-amber-300">{filteredRestaurants.length}</strong> food spots
        </span>
        {isLoading && (
          <span className="flex items-center gap-1.5 text-amber-400 font-medium text-[11px]">
            <Loader2 className="w-3 h-3 animate-spin" />
            Querying Overpass API...
          </span>
        )}
      </div>

      {/* Restaurant Cards Container */}
      <div className="flex-1 overflow-y-auto space-y-2.5 pr-0.5">
        {isLoading && restaurants.length === 0 ? (
          <div className="p-8 text-center space-y-3">
            <Loader2 className="w-8 h-8 text-amber-400 animate-spin mx-auto" />
            <p className="text-xs text-slate-400">
              Discovering Kolkata food stalls, street delicacies & restaurants...
            </p>
          </div>
        ) : filteredRestaurants.length === 0 ? (
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 text-center space-y-3 mt-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 mx-auto flex items-center justify-center">
              <Utensils className="w-6 h-6 text-amber-400" />
            </div>
            <h4 className="text-sm font-bold text-white">No food spots in this radius</h4>
            <p className="text-xs text-slate-400 max-w-xs mx-auto">
              Try increasing your radius to 2 km or 5 km, or browse directly on Google Maps.
            </p>
            <div className="flex items-center justify-center gap-2 pt-1">
              <button
                onClick={() => setRadius(5000)}
                className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs"
              >
                Expand to 5 km Radius
              </button>
              <a
                href={googleMapsSearchAllUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-medium text-xs flex items-center gap-1"
              >
                <ExternalLink className="w-3 h-3" />
                <span>Search Google Maps</span>
              </a>
            </div>
          </div>
        ) : (
          filteredRestaurants.map((resto) => (
            <div
              key={resto.id}
              onClick={() => onHighlightRestaurant?.(resto)}
              className="p-3.5 rounded-2xl bg-slate-900/70 hover:bg-slate-900 border border-slate-800/90 hover:border-amber-500/40 shadow-md transition-all space-y-2 cursor-pointer"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h4 className="text-sm font-bold text-white tracking-tight">
                    {resto.name}
                  </h4>
                  <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-300 border border-amber-500/30">
                      {resto.cuisine || 'Multi-Cuisine'}
                    </span>
                    {resto.amenity && (
                      <span className="text-[10px] uppercase font-bold text-slate-400">
                        {resto.amenity}
                      </span>
                    )}
                  </div>
                </div>

                {resto.distanceMeters !== undefined && (
                  <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 shrink-0">
                    {formatDistance(resto.distanceMeters)}
                  </span>
                )}
              </div>

              {resto.address && (
                <p className="text-xs text-slate-400 line-clamp-1 flex items-center gap-1">
                  <MapPin className="w-3 h-3 text-slate-500 shrink-0" />
                  <span>{resto.address}</span>
                </p>
              )}

              {/* Action Buttons */}
              <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-800/80">
                <a
                  href={getGoogleMapsDirectionUrl(
                    focalPoint.lat,
                    focalPoint.lng,
                    resto.lat,
                    resto.lng,
                    'walking'
                  )}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="py-1.5 px-2.5 rounded-xl bg-gradient-to-r from-rose-700 to-rose-600 hover:from-rose-600 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow transition-all active:scale-95"
                >
                  <Navigation className="w-3 h-3" />
                  <span>Directions</span>
                </a>

                <a
                  href={getGoogleMapsSearchUrl(resto.lat, resto.lng, resto.name)}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="py-1.5 px-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors"
                >
                  <ExternalLink className="w-3 h-3" />
                  <span>View on Google</span>
                </a>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
