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
} from 'lucide-react';
import { ActiveLocation, LocationSource } from '@/types';
import {
  parseCoordinatesFromText,
  isShortUrl,
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

  // Search state
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

  // 1. GPS Handler
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

      // Reverse geocode in background
      const address = await reverseGeocode(latitude, longitude);

      onLocationChange({
        lat: latitude,
        lng: longitude,
        address: address || 'Current Live Location',
        source: 'gps',
        accuracy: Math.round(accuracy),
        timestamp: pos.timestamp,
      });

      if (!watch) {
        setActiveMode(null);
      }
    };

    const errorHandler = (err: GeolocationPositionError) => {
      setIsLocating(false);
      setIsWatching(false);
      let msg = 'Could not acquire GPS position.';
      if (err.code === 1) msg = 'Location permission was denied. Please allow location access in your browser settings.';
      if (err.code === 2) msg = 'Position unavailable. Check your device GPS signal.';
      if (err.code === 3) msg = 'Location request timed out.';
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

  // 2. Debounced Search Handler
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
      address: location.name,
      source: 'search',
    });
    setSearchQuery('');
    setSearchResults([]);
    setActiveMode(null);
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
        // Parse KML in browser using DOMParser
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
        // GeoJSON
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
      {/* Top Bar: Active Location Summary & Quick Action Buttons */}
      <div className="max-w-7xl mx-auto px-3 sm:px-4 py-2.5 flex flex-wrap items-center justify-between gap-2">
        {/* Active Location Indicator */}
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-amber-500 to-rose-600 flex items-center justify-center shrink-0 shadow">
            {activeLocation.source === 'gps' ? (
              <Navigation className="w-4 h-4 text-slate-950 animate-pulse" />
            ) : (
              <MapPin className="w-4 h-4 text-slate-950" />
            )}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs font-bold text-white truncate max-w-[200px] sm:max-w-[340px]">
                {activeLocation.address || 'Kolkata, WB'}
              </span>
              <span className="text-[10px] uppercase font-semibold px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                {activeLocation.source}
              </span>
              {activeLocation.accuracy && (
                <span className="text-[10px] text-slate-400 font-mono hidden sm:inline">
                  ±{activeLocation.accuracy}m
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-400 font-mono truncate">
              {activeLocation.lat.toFixed(4)}, {activeLocation.lng.toFixed(4)}
            </p>
          </div>
        </div>

        {/* 4 Mode Buttons */}
        <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
          {/* GPS Button */}
          <button
            onClick={() => {
              setActiveMode(activeMode === 'gps' ? null : 'gps');
              if (activeMode !== 'gps') handleGetGpsLocation(false);
            }}
            className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all border ${
              activeMode === 'gps' || isWatching
                ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md shadow-amber-500/20'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
            }`}
            title="Use Live Device GPS"
          >
            {isLocating ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : isWatching ? (
              <Radio className="w-3.5 h-3.5 text-rose-700 animate-pulse" />
            ) : (
              <Navigation className="w-3.5 h-3.5" />
            )}
            <span className="hidden xs:inline">GPS</span>
          </button>

          {/* Search Button */}
          <button
            onClick={() => setActiveMode(activeMode === 'search' ? null : 'search')}
            className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all border ${
              activeMode === 'search'
                ? 'bg-amber-500 text-slate-950 border-amber-400'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
            }`}
            title="Search Kolkata Area or Address"
          >
            <Search className="w-3.5 h-3.5" />
            <span className="hidden xs:inline">Search</span>
          </button>

          {/* Paste Button */}
          <button
            onClick={() => setActiveMode(activeMode === 'paste' ? null : 'paste')}
            className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all border ${
              activeMode === 'paste'
                ? 'bg-amber-500 text-slate-950 border-amber-400'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
            }`}
            title="Paste Coordinates, Link, or Notification Text"
          >
            <Clipboard className="w-3.5 h-3.5" />
            <span className="hidden xs:inline">Paste</span>
          </button>

          {/* Upload Button */}
          <button
            onClick={() => setActiveMode(activeMode === 'upload' ? null : 'upload')}
            className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all border ${
              activeMode === 'upload'
                ? 'bg-amber-500 text-slate-950 border-amber-400'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
            }`}
            title="Upload Custom KML or GeoJSON"
          >
            <Upload className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Upload</span>
          </button>
        </div>
      </div>

      {/* Expandable Mode Drawers */}
      {activeMode && (
        <div className="border-t border-slate-800 bg-slate-950/95 px-3 sm:px-4 py-3 animate-in slide-in-from-top-2 duration-150">
          <div className="max-w-3xl mx-auto">
            {/* GPS MODE DRAWER */}
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
                    <span>Refetch Accurate Location</span>
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
                    <span>{isWatching ? 'Stop Live Tracking' : 'Continuous Live Tracking'}</span>
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

            {/* SEARCH MODE DRAWER */}
            {activeMode === 'search' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Search className="w-4 h-4 text-amber-400" />
                    <span className="text-xs font-bold text-white">
                      Search Address, Metro, or Landmark (Nominatim)
                    </span>
                  </div>
                  <button
                    onClick={() => setActiveMode(null)}
                    className="text-slate-400 hover:text-white"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Input Field */}
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Type area (e.g. Bagbazar, Gariahat, Salt Lake, Rabindra Sarobar)..."
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
                        <MapPin className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      </button>
                    ))}
                  </div>
                )}

                {/* Popular Kolkata Quick Hubs */}
                <div>
                  <p className="text-[10px] uppercase font-bold text-slate-400 mb-1.5 flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-amber-400" />
                    Quick Kolkata Parikrama Hubs
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {POPULAR_KOLKATA_HUBS.slice(0, 6).map((hub, idx) => (
                      <button
                        key={idx}
                        onClick={() => selectSearchResult(hub)}
                        className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-amber-500/40 text-[11px] text-slate-300 hover:text-white transition-all flex items-center gap-1"
                      >
                        <span>{hub.name.split('/')[0].trim()}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* PASTE MODE DRAWER */}
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

            {/* UPLOAD MODE DRAWER */}
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
