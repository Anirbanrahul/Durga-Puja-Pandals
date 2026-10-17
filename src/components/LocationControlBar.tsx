'use client';

import { useState, useEffect, useRef } from 'react';
import {
  Navigation,
  Search,
  Clipboard,
  Upload,
  MapPin,
  Loader2,
  Check,
  AlertCircle,
  X,
  Compass,
  Radio,
  Sparkles,
  Edit3,
} from 'lucide-react';
import { ActiveLocation, LocationSource } from '@/types';
import {
  parseCoordinatesFromText,
  DEFAULT_KOLKATA_COORDS,
} from '@/lib/geoUtils';
import {
  searchLocations,
  reverseGeocode,
  POPULAR_KOLKATA_HUBS,
  GeocodeLocation,
} from '@/lib/nominatim';

interface LocationControlBarProps {
  activeLocation: ActiveLocation;
  onLocationChange: (location: ActiveLocation) => void;
  onCustomDataUpload?: (geoJson: Record<string, unknown>) => void;
  className?: string;
}

type Mode = 'gps' | 'search' | 'paste' | 'upload';

export default function LocationControlBar({
  activeLocation,
  onLocationChange,
  onCustomDataUpload,
  className = '',
}: LocationControlBarProps) {
  const [activeMode, setActiveMode] = useState<Mode | null>(null);

  // GPS state
  const [isLocating, setIsLocating] = useState(false);
  const [isWatching, setIsWatching] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const watchIdRef = useRef<number | null>(null);

  // Search / Type Location state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<GeocodeLocation[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Paste state
  const [pasteInput, setPasteInput] = useState('');
  const [isResolvingPaste, setIsResolvingPaste] = useState(false);
  const [pasteFeedback, setPasteFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  // File Upload state
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Clean up GPS watcher
  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null && typeof navigator !== 'undefined') {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  // 1. Live GPS Handler
  const handleGetGpsLocation = (watch: boolean = false) => {
    if (!navigator.geolocation) {
      setGpsError('Geolocation is not supported by your browser or device.');
      return;
    }

    setIsLocating(true);
    setGpsError(null);

    const successHandler = async (pos: GeolocationPosition) => {
      setIsLocating(false);
      const { latitude, longitude, accuracy } = pos.coords;

      // Reverse geocode in background for human readable address
      const address = await reverseGeocode(latitude, longitude);

      onLocationChange({
        lat: latitude,
        lng: longitude,
        address: address || 'Current Live GPS Location',
        source: 'gps',
        accuracy: Math.round(accuracy),
        timestamp: pos.timestamp,
      });

      if (!watch) {
        setActiveMode(null);
      }
    };

    const errorHandler = (err: GeolocationPositionError) => {
      // If high-accuracy timed out or unavailable, try fallback with cellular/wifi tower location (common on iOS indoors)
      if ((err.code === 2 || err.code === 3) && !watch) {
        navigator.geolocation.getCurrentPosition(
          successHandler,
          (fallbackErr) => {
            setIsLocating(false);
            setIsWatching(false);
            let msg = 'Could not acquire GPS position.';
            if (fallbackErr.code === 1) msg = 'Location permission was denied. You can write or choose your location below!';
            if (fallbackErr.code === 2) msg = 'Position unavailable. Check your device GPS signal or type your location.';
            if (fallbackErr.code === 3) msg = 'Location request timed out. Please type your location below.';
            setGpsError(msg);
          },
          { enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 }
        );
        return;
      }

      setIsLocating(false);
      setIsWatching(false);
      let msg = 'Could not acquire GPS position.';
      if (err.code === 1) msg = 'Location permission was denied. You can write/search your location instead!';
      if (err.code === 2) msg = 'Position unavailable. Check your device GPS signal or type your location.';
      if (err.code === 3) msg = 'Location request timed out. Please type your location below.';
      setGpsError(msg);
    };

    if (watch) {
      if (isWatching) {
        // Toggle OFF
        if (watchIdRef.current !== null) {
          navigator.geolocation.clearWatch(watchIdRef.current);
          watchIdRef.current = null;
        }
        setIsWatching(false);
        setIsLocating(false);
      } else {
        // Toggle ON
        setIsWatching(true);
        watchIdRef.current = navigator.geolocation.watchPosition(
          successHandler,
          errorHandler,
          { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 }
        );
      }
    } else {
      navigator.geolocation.getCurrentPosition(
        successHandler,
        errorHandler,
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 }
      );
    }
  };

  // 2. Debounced Search / Manual Location Handler
  useEffect(() => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);

    if (!searchQuery || searchQuery.trim().length < 2) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    debounceTimerRef.current = setTimeout(async () => {
      const results = await searchLocations(searchQuery);
      setSearchResults(results);
      setIsSearching(false);
    }, 400);

    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, [searchQuery]);

  const selectSearchResult = (location: GeocodeLocation) => {
    onLocationChange({
      lat: location.lat,
      lng: location.lng,
      address: location.displayName || location.name,
      source: 'search',
    });
    setSearchQuery('');
    setSearchResults([]);
    setActiveMode(null);
  };

  // Allow pressing Enter to search and select top match immediately
  const handleManualLocationSubmit = async () => {
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    const results = await searchLocations(searchQuery);
    setIsSearching(false);
    if (results.length > 0) {
      selectSearchResult(results[0]);
    } else {
      // Default to Kolkata center with the user's label
      onLocationChange({
        lat: DEFAULT_KOLKATA_COORDS.lat,
        lng: DEFAULT_KOLKATA_COORDS.lng,
        address: `${searchQuery} (Kolkata)`,
        source: 'search',
      });
      setActiveMode(null);
    }
  };

  // 3. Paste / Extract Handler
  const handleProcessPastedText = async (textToParse: string) => {
    const trimmed = textToParse.trim();
    if (!trimmed) {
      setPasteFeedback({
        type: 'error',
        message: 'Please paste a coordinate, text, or Google Maps URL.',
      });
      return;
    }

    setIsResolvingPaste(true);
    setPasteFeedback(null);

    // Direct regex parsing
    const directCoords = parseCoordinatesFromText(trimmed);
    if (directCoords) {
      const addr = await reverseGeocode(directCoords.lat, directCoords.lng);
      onLocationChange({
        lat: directCoords.lat,
        lng: directCoords.lng,
        address: addr || directCoords.label || 'Pasted Coordinates',
        source: 'paste',
      });
      setIsResolvingPaste(false);
      setPasteFeedback({
        type: 'success',
        message: `Coordinates detected: ${directCoords.lat.toFixed(4)}, ${directCoords.lng.toFixed(4)}`,
      });
      setTimeout(() => {
        setPasteInput('');
        setActiveMode(null);
        setPasteFeedback(null);
      }, 1200);
      return;
    }

    // Check for shortened or external URLs
    const urlMatch = /(https?:\/\/[^\s]+)/g.exec(trimmed);
    const targetUrl = urlMatch ? urlMatch[0] : trimmed;

    try {
      const res = await fetch('/api/resolve-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: targetUrl }),
      });
      const data = await res.json();

      if (data.success && data.coordinates) {
        const addr = await reverseGeocode(data.coordinates.lat, data.coordinates.lng);
        onLocationChange({
          lat: data.coordinates.lat,
          lng: data.coordinates.lng,
          address: addr || 'Resolved Map Pin',
          source: 'paste',
        });
        setIsResolvingPaste(false);
        setPasteFeedback({
          type: 'success',
          message: `URL unpacked successfully: ${data.coordinates.lat.toFixed(4)}, ${data.coordinates.lng.toFixed(4)}`,
        });
        setTimeout(() => {
          setPasteInput('');
          setActiveMode(null);
          setPasteFeedback(null);
        }, 1200);
        return;
      } else {
        setPasteFeedback({
          type: 'error',
          message: data.error || 'Could not extract coordinates from this URL.',
        });
      }
    } catch {
      setPasteFeedback({
        type: 'error',
        message: 'Network request to resolve URL failed.',
      });
    }

    setIsResolvingPaste(false);
  };

  const handleReadFromClipboard = async () => {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        const text = await navigator.clipboard.readText();
        if (text) {
          setPasteInput(text);
          handleProcessPastedText(text);
        }
      }
    } catch {
      setPasteFeedback({
        type: 'error',
        message: 'Clipboard access not granted. Please paste manually into the box.',
      });
    }
  };

  // 4. File Upload Handler (KML or GeoJSON)
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadStatus('Parsing file...');

    try {
      const text = await file.text();

      if (file.name.endsWith('.kml') || text.includes('<kml')) {
        const { kml } = await import('@tmcw/togeojson');
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(text, 'text/xml');
        const converted = kml(xmlDoc);

        if (converted && converted.features && converted.features.length > 0) {
          onCustomDataUpload?.(converted as unknown as Record<string, unknown>);
          setUploadStatus(`Loaded ${converted.features.length} pandals from KML!`);
          setTimeout(() => {
            setUploadStatus(null);
            setActiveMode(null);
          }, 1500);
          return;
        }
      } else {
        const parsed = JSON.parse(text);
        if (parsed.type === 'FeatureCollection' && Array.isArray(parsed.features)) {
          onCustomDataUpload?.(parsed);
          setUploadStatus(`Loaded ${parsed.features.length} pandals from GeoJSON!`);
          setTimeout(() => {
            setUploadStatus(null);
            setActiveMode(null);
          }, 1500);
          return;
        }
      }

      setUploadStatus('Invalid KML or GeoJSON format.');
    } catch (err) {
      console.error(err);
      setUploadStatus('Failed to read or parse file.');
    }
  };

  return (
    <div className={`w-full bg-slate-900/95 border-b border-amber-500/30 backdrop-blur-md shadow-lg ${className}`}>
      {/* Fullscreen Blocking GPS Loading Modal */}
      {isLocating && (
        <div className="fixed inset-0 z-[99999] bg-slate-950/85 backdrop-blur-md flex flex-col items-center justify-center p-4 sm:p-6 text-center select-none animate-in fade-in duration-200">
          <div className="max-w-sm w-full bg-slate-900/95 border-2 border-amber-500/50 rounded-3xl p-6 sm:p-8 shadow-2xl flex flex-col items-center relative overflow-hidden">
            {/* Glowing ambient background glow */}
            <div className="absolute -top-16 -left-16 w-36 h-36 bg-rose-600/25 rounded-full blur-2xl pointer-events-none" />
            <div className="absolute -bottom-16 -right-16 w-36 h-36 bg-amber-500/25 rounded-full blur-2xl pointer-events-none" />

            {/* Glowing radar pulse beacon */}
            <div className="relative w-24 h-24 mb-5 flex items-center justify-center">
              <div className="absolute inset-0 rounded-full bg-amber-500/20 animate-ping duration-1000" />
              <div className="absolute w-20 h-20 rounded-full bg-rose-600/30 animate-pulse duration-700" />
              <div className="relative w-14 h-14 rounded-2xl bg-gradient-to-tr from-rose-600 via-amber-500 to-amber-400 flex items-center justify-center shadow-xl shadow-rose-900/60 p-0.5">
                <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center">
                  <Navigation className="w-7 h-7 text-amber-400 animate-spin" />
                </div>
              </div>
            </div>

            <h3 className="text-lg font-extrabold text-white mb-1.5 tracking-tight">
              Acquiring Live GPS Location...
            </h3>
            <p className="text-xs text-amber-200/90 mb-4 max-w-xs leading-relaxed">
              Locking onto device satellites and calculating walking distances to all 232+ Durga Puja pandals in Kolkata.
            </p>

            <div className="flex items-center gap-2 text-[11px] text-slate-300 bg-slate-950/80 px-3.5 py-2 rounded-full border border-slate-800 mb-5 shadow-inner">
              <Compass className="w-3.5 h-3.5 text-amber-400 animate-spin" />
              <span>Please tap &quot;Allow&quot; if browser asks for location</span>
            </div>

            <button
              onClick={() => {
                setIsLocating(false);
                setIsWatching(false);
              }}
              className="py-2.5 px-6 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-300 hover:text-white border border-slate-700 transition-colors shadow-md active:scale-95"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Top Bar: Active Location Summary & Explicit Action Buttons with Clear Labels */}
      <div className="max-w-7xl mx-auto px-3 sm:px-4 py-2.5 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2.5">
        
        {/* Active Location Display & Click-to-Change */}
        <div
          onClick={() => setActiveMode(activeMode === 'search' ? null : 'search')}
          className="flex items-center gap-2.5 min-w-0 flex-1 bg-slate-950/60 hover:bg-slate-950 border border-slate-800 hover:border-amber-500/40 p-2 rounded-xl transition-all cursor-pointer group"
          title="Click to write or change your location"
        >
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-amber-500 to-rose-600 flex items-center justify-center shrink-0 shadow">
            {activeLocation.source === 'gps' ? (
              <Navigation className="w-4 h-4 text-slate-950 animate-pulse" />
            ) : (
              <MapPin className="w-4 h-4 text-slate-950" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] text-amber-400 font-bold uppercase tracking-wider">
                Current Location:
              </span>
              <span className="text-xs font-bold text-white truncate max-w-[220px] sm:max-w-[340px]">
                {activeLocation.address || 'Kolkata, WB'}
              </span>
              <span className="text-[10px] uppercase font-semibold px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                {activeLocation.source === 'gps' ? 'Live GPS' : activeLocation.source === 'search' ? 'Custom Area' : activeLocation.source}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-mono truncate">
              {activeLocation.lat.toFixed(4)}, {activeLocation.lng.toFixed(4)}
              <span className="ml-2 text-amber-300 font-sans group-hover:underline text-[10px]">
                (Tap to change / type area ✍️)
              </span>
            </p>
          </div>
        </div>

        {/* Action Buttons with CLEAR LABELS for Newcomers */}
        <div className="flex items-center gap-1.5 flex-wrap shrink-0">
          
          {/* 1. Live GPS Button with clear text label */}
          <button
            onClick={() => {
              setActiveMode(activeMode === 'gps' ? null : 'gps');
              if (activeMode !== 'gps') handleGetGpsLocation(false);
            }}
            className={`flex-1 sm:flex-initial px-3 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all border shadow-sm ${
              activeMode === 'gps' || isWatching
                ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-amber-500/20'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-100 border-slate-700'
            }`}
            title="Search with Live Device GPS"
          >
            {isLocating ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-950" />
            ) : isWatching ? (
              <Radio className="w-3.5 h-3.5 text-rose-700 animate-pulse" />
            ) : (
              <Navigation className="w-3.5 h-3.5 text-amber-400" />
            )}
            <span>Live GPS</span>
          </button>

          {/* 2. Write / Type Custom Location Button */}
          <button
            onClick={() => setActiveMode(activeMode === 'search' ? null : 'search')}
            className={`flex-1 sm:flex-initial px-3 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all border shadow-sm ${
              activeMode === 'search'
                ? 'bg-amber-500 text-slate-950 border-amber-400'
                : 'bg-rose-950/60 hover:bg-rose-900/80 text-rose-200 border-rose-800/60'
            }`}
            title="Write your own location or area without GPS"
          >
            <Edit3 className="w-3.5 h-3.5 text-rose-300" />
            <span>Type My Area</span>
          </button>

          {/* 3. Paste Coordinates / Link Button */}
          <button
            onClick={() => setActiveMode(activeMode === 'paste' ? null : 'paste')}
            className={`px-2.5 py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1 transition-all border ${
              activeMode === 'paste'
                ? 'bg-amber-500 text-slate-950 border-amber-400'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
            }`}
            title="Paste Coordinates, WhatsApp Location, or Google Maps Link"
          >
            <Clipboard className="w-3.5 h-3.5 text-slate-400" />
            <span className="hidden sm:inline">Paste Link</span>
          </button>

          {/* 4. Upload KML / GeoJSON */}
          <button
            onClick={() => setActiveMode(activeMode === 'upload' ? null : 'upload')}
            className={`px-2.5 py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1 transition-all border ${
              activeMode === 'upload'
                ? 'bg-amber-500 text-slate-950 border-amber-400'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
            }`}
            title="Upload Custom KML or GeoJSON"
          >
            <Upload className="w-3.5 h-3.5 text-slate-400" />
            <span className="hidden sm:inline">Upload</span>
          </button>
        </div>
      </div>

      {/* Expandable Mode Drawers */}
      {activeMode && (
        <div className="border-t border-slate-800 bg-slate-950/98 px-3 sm:px-4 py-3.5 animate-in slide-in-from-top-2 duration-150">
          <div className="max-w-3xl mx-auto">
            
            {/* 1. SEARCH / WRITE LOCATION DRAWER (Option to set location without GPS) */}
            {activeMode === 'search' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Edit3 className="w-4 h-4 text-amber-400" />
                    <div>
                      <h4 className="text-xs font-bold text-white">
                        Write Your Location / Set Manual Area
                      </h4>
                      <p className="text-[11px] text-slate-400">
                        Don’t want to share GPS? Type your current area, landmark, or street name. Pandals nearby will immediately calculate distance from there!
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setActiveMode(null)}
                    className="text-slate-400 hover:text-white p-1"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Input Field with Submit */}
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleManualLocationSubmit();
                      }}
                      placeholder="Type your area (e.g. Dum Dum, Ballygunge, Salt Lake, Howrah, Gariahat)..."
                      className="w-full bg-slate-900 border border-slate-700 focus:border-amber-400 rounded-xl pl-9 pr-9 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none transition-colors"
                      autoFocus
                    />
                    {isSearching && (
                      <Loader2 className="w-4 h-4 text-amber-400 animate-spin absolute right-3 top-1/2 -translate-y-1/2" />
                    )}
                    {searchQuery && !isSearching && (
                      <button
                        onClick={() => setSearchQuery('')}
                        className="text-slate-400 hover:text-white absolute right-3 top-1/2 -translate-y-1/2"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  <button
                    onClick={handleManualLocationSubmit}
                    disabled={!searchQuery.trim() || isSearching}
                    className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition-all disabled:opacity-50 shrink-0"
                  >
                    <span>Set Location</span>
                  </button>
                </div>

                {/* Autocomplete Results */}
                {searchResults.length > 0 && (
                  <div className="bg-slate-900 border border-slate-800 rounded-xl max-h-48 overflow-y-auto divide-y divide-slate-800/80">
                    {searchResults.map((result, idx) => (
                      <button
                        key={idx}
                        onClick={() => selectSearchResult(result)}
                        className="w-full text-left px-3 py-2 hover:bg-slate-800 flex items-center justify-between gap-2 text-xs transition-colors"
                      >
                        <div className="min-w-0">
                          <p className="font-semibold text-white truncate">{result.name}</p>
                          <p className="text-[11px] text-slate-400 truncate">{result.displayName}</p>
                        </div>
                        <span className="text-[11px] font-bold text-amber-400 shrink-0 flex items-center gap-1">
                          <MapPin className="w-3 h-3" /> Select
                        </span>
                      </button>
                    ))}
                  </div>
                )}

                {/* Popular Kolkata Quick Hubs */}
                <div>
                  <p className="text-[10px] uppercase font-bold text-slate-400 mb-1.5 flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-amber-400" />
                    Or Pick One of Popular Kolkata Areas (1-Tap):
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {POPULAR_KOLKATA_HUBS.map((hub, idx) => (
                      <button
                        key={idx}
                        onClick={() => selectSearchResult(hub)}
                        className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-amber-500/20 border border-slate-800 hover:border-amber-500/40 text-[11px] text-slate-300 hover:text-amber-200 transition-all flex items-center gap-1"
                      >
                        <span>{hub.name.split('/')[0].trim()}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* 2. GPS MODE DRAWER */}
            {activeMode === 'gps' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Navigation className="w-4 h-4 text-amber-400" />
                    <span className="text-xs font-bold text-white">Live Geolocation (GPS)</span>
                  </div>
                  <button
                    onClick={() => setActiveMode(null)}
                    className="text-slate-400 hover:text-white"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => handleGetGpsLocation(false)}
                    disabled={isLocating}
                    className="py-2 px-3.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-2 transition-all active:scale-95 disabled:opacity-50"
                  >
                    {isLocating ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Compass className="w-3.5 h-3.5" />
                    )}
                    <span>Acquire Live GPS Location</span>
                  </button>

                  <button
                    onClick={() => handleGetGpsLocation(true)}
                    className={`py-2 px-3.5 rounded-xl font-bold text-xs flex items-center gap-2 transition-all border active:scale-95 ${
                      isWatching
                        ? 'bg-rose-600 text-white border-rose-500'
                        : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
                    }`}
                  >
                    <Radio className={`w-3.5 h-3.5 ${isWatching ? 'animate-pulse' : ''}`} />
                    <span>{isWatching ? 'Stop Continuous Tracking' : 'Continuous Live Tracking'}</span>
                  </button>

                  <button
                    onClick={() => {
                      onLocationChange({
                        lat: DEFAULT_KOLKATA_COORDS.lat,
                        lng: DEFAULT_KOLKATA_COORDS.lng,
                        address: 'Esplanade / Park Street (Central Kolkata)',
                        source: 'default',
                      });
                      setActiveMode(null);
                    }}
                    className="py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium border border-slate-700"
                  >
                    Reset to Central Kolkata
                  </button>
                </div>

                {gpsError && (
                  <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                    <span>{gpsError}</span>
                  </div>
                )}
              </div>
            )}

            {/* 3. PASTE MODE DRAWER */}
            {activeMode === 'paste' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clipboard className="w-4 h-4 text-amber-400" />
                    <span className="text-xs font-bold text-white">
                      Paste Coordinates, WhatsApp Location, or Google Maps Link
                    </span>
                  </div>
                  <button
                    onClick={() => setActiveMode(null)}
                    className="text-slate-400 hover:text-white"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex gap-2">
                  <input
                    type="text"
                    value={pasteInput}
                    onChange={(e) => setPasteInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleProcessPastedText(pasteInput);
                    }}
                    placeholder="e.g. 22.5726, 88.3639 or https://goo.gl/maps/... or WhatsApp message"
                    className="flex-1 bg-slate-900 border border-slate-700 focus:border-amber-400 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none"
                    autoFocus
                  />
                  <button
                    onClick={() => handleProcessPastedText(pasteInput)}
                    disabled={isResolvingPaste || !pasteInput.trim()}
                    className="py-2 px-3.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition-all disabled:opacity-50"
                  >
                    {isResolvingPaste ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Check className="w-3.5 h-3.5" />
                    )}
                    <span>Parse</span>
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleReadFromClipboard}
                    className="py-1.5 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 flex items-center gap-1.5 transition-colors"
                  >
                    <Clipboard className="w-3.5 h-3.5 text-amber-400" />
                    <span>Paste From System Clipboard</span>
                  </button>
                  <span className="text-[11px] text-slate-500">
                    Supports @lat,lng, goo.gl, maps.app.goo.gl, and raw coordinates.
                  </span>
                </div>

                {pasteFeedback && (
                  <div
                    className={`p-2.5 rounded-xl text-xs flex items-center gap-2 border ${
                      pasteFeedback.type === 'success'
                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                        : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                    }`}
                  >
                    {pasteFeedback.type === 'success' ? (
                      <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                    )}
                    <span>{pasteFeedback.message}</span>
                  </div>
                )}
              </div>
            )}

            {/* 4. UPLOAD MODE DRAWER */}
            {activeMode === 'upload' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Upload className="w-4 h-4 text-amber-400" />
                    <span className="text-xs font-bold text-white">
                      Upload Custom KML or GeoJSON File
                    </span>
                  </div>
                  <button
                    onClick={() => setActiveMode(null)}
                    className="text-slate-400 hover:text-white"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <p className="text-xs text-slate-400">
                  Import your own Google MyMaps exported KML or custom GeoJSON file. Works completely client-side with zero server upload!
                </p>

                <div className="flex items-center gap-3">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".kml,.geojson,.json"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-2 transition-all active:scale-95 shadow-md"
                  >
                    <Upload className="w-4 h-4" />
                    <span>Choose KML / GeoJSON File</span>
                  </button>

                  {uploadStatus && (
                    <span className="text-xs text-amber-300 font-medium animate-pulse">
                      {uploadStatus}
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
