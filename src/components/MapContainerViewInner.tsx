'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Circle,
  useMap,
} from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Pandal, Restaurant, Washroom, Hospital, ActiveLocation } from '@/types';
import {
  formatDistance,
  getGoogleMapsDirectionUrl,
  getGoogleMapsSearchUrl,
} from '@/lib/geoUtils';
import {
  Compass,
  Navigation,
  Utensils,
  Train,
  Sparkles,
  ExternalLink,
  Layers,
  PhoneCall,
  Accessibility,
} from 'lucide-react';

interface MapViewProps {
  userLocation: ActiveLocation;
  pandals: Pandal[];
  restaurants?: Restaurant[];
  washrooms?: Washroom[];
  hospitals?: Hospital[];
  selectedPandalId?: string | null;
  onSelectPandal?: (pandal: Pandal) => void;
  onFindFoodNearPandal?: (pandal: Pandal) => void;
  radiusMeters?: number;
  highlightedRestaurantId?: string | number | null;
}

// Controller component to smoothly fly/pan map and invalidate size on resize
function MapController({
  center,
  zoom,
}: {
  center: [number, number];
  zoom: number;
}) {
  const map = useMap();

  useEffect(() => {
    if (
      Array.isArray(center) &&
      typeof center[0] === 'number' &&
      !isNaN(center[0]) &&
      typeof center[1] === 'number' &&
      !isNaN(center[1]) &&
      typeof zoom === 'number' &&
      !isNaN(zoom)
    ) {
      try {
        map.flyTo(center, zoom, { duration: 1.2, easeLinearity: 0.25 });
      } catch {
        // Ignore map flyTo errors if container unmounted
      }
    }
  }, [map, center, zoom]);

  useEffect(() => {
    // Invalidate map size on mount and window resize (crucial for mobile/webview tab switches)
    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 150);

    const handleResize = () => map.invalidateSize();
    window.addEventListener('resize', handleResize);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', handleResize);
    };
  }, [map]);

  return null;
}

// Create custom SVG Leaflet DivIcons
function createCustomMarkerIcon(
  type: 'pandal' | 'user' | 'restaurant' | 'selected-pandal' | 'washroom' | 'hospital',
  label?: string
) {
  if (type === 'user') {
    return L.divIcon({
      className: 'user-marker-icon',
      html: `
        <div class="relative flex items-center justify-center w-8 h-8">
          <div class="absolute w-8 h-8 bg-sky-500/30 rounded-full animate-ping"></div>
          <div class="absolute w-6 h-6 bg-sky-500/50 rounded-full animate-pulse"></div>
          <div class="relative w-4 h-4 bg-sky-500 border-2 border-white rounded-full shadow-lg"></div>
        </div>
      `,
      iconSize: [32, 32],
      iconAnchor: [16, 16],
      popupAnchor: [0, -16],
    });
  }

  if (type === 'restaurant') {
    return L.divIcon({
      className: 'resto-marker-icon',
      html: `
        <div class="group relative flex items-center justify-center w-7 h-7 bg-amber-500 border-2 border-white text-slate-950 rounded-full shadow-md hover:scale-125 transition-transform">
          <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M18 2v6a3 3 0 0 1-3 3 3 3 0 0 1-3-3V2"></path>
            <path d="M15 2v10a2 2 0 0 1-2 2H9"></path>
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
          </svg>
        </div>
      `,
      iconSize: [28, 28],
      iconAnchor: [14, 14],
      popupAnchor: [0, -14],
    });
  }

  if (type === 'washroom') {
    return L.divIcon({
      className: 'washroom-marker-icon',
      html: `
        <div class="group relative flex items-center justify-center w-7 h-7 bg-cyan-600 border-2 border-white text-white rounded-full shadow-md hover:scale-125 transition-transform">
          <span class="text-xs">🚻</span>
        </div>
      `,
      iconSize: [28, 28],
      iconAnchor: [14, 14],
      popupAnchor: [0, -14],
    });
  }

  if (type === 'hospital') {
    return L.divIcon({
      className: 'hospital-marker-icon',
      html: `
        <div class="group relative flex items-center justify-center w-7 h-7 bg-red-600 border-2 border-white text-white rounded-full shadow-md hover:scale-125 transition-transform animate-pulse">
          <span class="text-xs">🏥</span>
        </div>
      `,
      iconSize: [28, 28],
      iconAnchor: [14, 14],
      popupAnchor: [0, -14],
    });
  }

  const isSelected = type === 'selected-pandal';

  return L.divIcon({
    className: 'pandal-marker-icon',
    html: `
      <div class="relative flex flex-col items-center group cursor-pointer ${isSelected ? 'scale-125 z-50' : 'hover:scale-110'} transition-transform">
        <div class="w-8 h-8 rounded-full ${
          isSelected
            ? 'bg-gradient-to-tr from-amber-400 to-rose-600 ring-4 ring-amber-300 shadow-xl'
            : 'bg-gradient-to-tr from-rose-700 to-amber-500 shadow-lg'
        } border-2 border-amber-200 flex items-center justify-center text-white">
          <svg class="w-4 h-4 text-amber-100" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2L15 8H9L12 2Z"></path>
            <circle cx="12" cy="12" r="3"></circle>
            <path d="M7 14L12 22L17 14H7Z"></path>
          </svg>
        </div>
        <div class="w-1.5 h-2 bg-amber-600 rounded-b -mt-0.5"></div>
        ${
          label
            ? `<div class="mt-0.5 px-1.5 py-0.5 rounded bg-slate-950/90 text-[10px] font-bold text-amber-300 border border-amber-500/40 shadow whitespace-nowrap max-w-[120px] truncate">${label}</div>`
            : ''
        }
      </div>
    `,
    iconSize: [36, 42],
    iconAnchor: [18, 26],
    popupAnchor: [0, -26],
  });
}

export default function MapContainerViewInner({
  userLocation,
  pandals,
  restaurants = [],
  washrooms = [],
  hospitals = [],
  selectedPandalId,
  onSelectPandal,
  onFindFoodNearPandal,
  radiusMeters = 5000,
  highlightedRestaurantId,
}: MapViewProps) {
  const [tileProvider, setTileProvider] = useState<'osm' | 'hot'>('osm');

  // Compute map center
  const centerCoord = useMemo<[number, number]>(() => {
    if (selectedPandalId) {
      const selected = pandals.find((p) => p.id === selectedPandalId);
      if (
        selected &&
        typeof selected.lat === 'number' &&
        !isNaN(selected.lat) &&
        typeof selected.lng === 'number' &&
        !isNaN(selected.lng)
      ) {
        return [selected.lat, selected.lng];
      }
    }
    if (
      userLocation &&
      typeof userLocation.lat === 'number' &&
      !isNaN(userLocation.lat) &&
      typeof userLocation.lng === 'number' &&
      !isNaN(userLocation.lng)
    ) {
      return [userLocation.lat, userLocation.lng];
    }
    return [22.5626, 88.3518];
  }, [selectedPandalId, pandals, userLocation]);

  const tileUrl =
    tileProvider === 'osm'
      ? 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
      : 'https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png';

  const tileAttribution =
    tileProvider === 'osm'
      ? '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      : '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, Tiles style by <a href="https://www.hotosm.org/">HOT</a>';

  return (
    <div className="relative w-full h-full min-h-[350px] overflow-hidden rounded-2xl border border-amber-500/30 shadow-2xl">
      <MapContainer
        center={centerCoord}
        zoom={13}
        scrollWheelZoom={true}
        className="w-full h-full z-0"
      >
        <MapController center={centerCoord} zoom={selectedPandalId ? 15 : 13} />

        <TileLayer attribution={tileAttribution} url={tileUrl} maxZoom={19} />

        {/* User Location Radius Circle */}
        {radiusMeters > 0 && (
          <Circle
            center={[userLocation.lat, userLocation.lng]}
            radius={radiusMeters}
            pathOptions={{
              color: '#f59e0b',
              fillColor: '#f59e0b',
              fillOpacity: 0.07,
              weight: 1.5,
              dashArray: '6, 6',
            }}
          />
        )}

        {/* User GPS Marker */}
        <Marker
          position={[userLocation.lat, userLocation.lng]}
          icon={createCustomMarkerIcon('user')}
        >
          <Popup className="custom-popup">
            <div className="p-1 text-slate-900 font-sans">
              <div className="flex items-center gap-1.5 text-xs font-bold text-sky-700">
                <Navigation className="w-3.5 h-3.5" />
                <span>Your Location ({userLocation.source.toUpperCase()})</span>
              </div>
              <p className="text-xs text-slate-700 mt-1">{userLocation.address}</p>
              {userLocation.accuracy && (
                <p className="text-[10px] text-slate-500 font-mono mt-0.5">
                  GPS Accuracy: ±{userLocation.accuracy}m
                </p>
              )}
            </div>
          </Popup>
        </Marker>

        {/* Pandal Markers */}
        {pandals.map((pandal) => {
          const isSelected = pandal.id === selectedPandalId;
          return (
            <Marker
              key={pandal.id}
              position={[pandal.lat, pandal.lng]}
              icon={createCustomMarkerIcon(
                isSelected ? 'selected-pandal' : 'pandal',
                pandal.name.split(' ')[0]
              )}
              eventHandlers={{
                click: () => onSelectPandal?.(pandal),
              }}
            >
              <Popup className="custom-popup max-w-xs">
                <div className="p-1 text-slate-900 font-sans space-y-2">
                  <div className="flex items-start justify-between gap-2 border-b border-slate-200 pb-1.5">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-rose-700 tracking-wider">
                        {pandal.zone}
                      </span>
                      <h4 className="text-sm font-bold text-slate-900 leading-tight">
                        {pandal.name}
                      </h4>
                    </div>
                    {pandal.distanceMeters !== undefined && (
                      <span className="shrink-0 px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                        {formatDistance(pandal.distanceMeters)}
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-slate-600 line-clamp-3">
                    {pandal.description}
                  </p>

                  {pandal.nearestMetro && (
                    <div className="flex items-center gap-1 text-[11px] text-slate-700 font-medium">
                      <Train className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                      <span>{pandal.nearestMetro}</span>
                    </div>
                  )}

                  {pandal.famousFor && (
                    <div className="flex items-center gap-1 text-[11px] text-amber-800 font-medium bg-amber-50 p-1.5 rounded-lg border border-amber-200">
                      <Sparkles className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                      <span>{pandal.famousFor}</span>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="grid grid-cols-2 gap-1.5 pt-1">
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
                      className="py-1.5 px-2 rounded-lg bg-rose-700 hover:bg-rose-800 text-white font-bold text-[11px] flex items-center justify-center gap-1 transition-colors text-center"
                    >
                      <Navigation className="w-3 h-3" />
                      <span>Walking Route</span>
                    </a>

                    <button
                      onClick={() => onFindFoodNearPandal?.(pandal)}
                      className="py-1.5 px-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-[11px] flex items-center justify-center gap-1 transition-colors text-center"
                    >
                      <Utensils className="w-3 h-3" />
                      <span>Food Nearby</span>
                    </button>
                  </div>
                </div>
              </Popup>
            </Marker>
          );
        })}

        {/* Restaurant Markers */}
        {restaurants.map((resto) => {
          const isHighlighted = resto.id === highlightedRestaurantId;
          return (
            <Marker
              key={resto.id}
              position={[resto.lat, resto.lng]}
              icon={createCustomMarkerIcon('restaurant')}
            >
              <Popup className="custom-popup">
                <div className="p-1 text-slate-900 font-sans space-y-1.5">
                  <div className="flex items-center justify-between gap-2 border-b border-slate-200 pb-1">
                    <h5 className="text-xs font-bold text-slate-900">{resto.name}</h5>
                    {resto.distanceMeters !== undefined && (
                      <span className="text-[10px] font-bold text-amber-700">
                        {formatDistance(resto.distanceMeters)}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-600 font-medium">
                    {resto.cuisine || 'Eatery'}
                  </p>
                  {resto.address && (
                    <p className="text-[10px] text-slate-500 line-clamp-1">
                      {resto.address}
                    </p>
                  )}
                  <div className="flex gap-1 pt-1">
                    <a
                      href={getGoogleMapsDirectionUrl(
                        userLocation.lat,
                        userLocation.lng,
                        resto.lat,
                        resto.lng,
                        'walking'
                      )}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 py-1 px-1.5 rounded bg-rose-700 text-white text-[10px] font-semibold flex items-center justify-center gap-1"
                    >
                      <Navigation className="w-2.5 h-2.5" />
                      <span>Directions</span>
                    </a>
                    <a
                      href={getGoogleMapsSearchUrl(resto.lat, resto.lng, resto.name)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 py-1 px-1.5 rounded bg-slate-800 text-white text-[10px] font-semibold flex items-center justify-center gap-1"
                    >
                      <ExternalLink className="w-2.5 h-2.5" />
                      <span>Google Maps</span>
                    </a>
                  </div>
                </div>
              </Popup>
            </Marker>
          );
        })}

        {/* Washroom Markers */}
        {washrooms.map((w) => (
          <Marker
            key={w.id}
            position={[w.lat, w.lng]}
            icon={createCustomMarkerIcon('washroom')}
          >
            <Popup className="custom-popup">
              <div className="p-1 text-slate-900 font-sans space-y-1.5">
                <div className="flex items-center justify-between gap-2 border-b border-slate-200 pb-1">
                  <h5 className="text-xs font-bold text-slate-900">{w.name}</h5>
                  {w.distanceMeters !== undefined && (
                    <span className="text-[10px] font-bold text-cyan-700">
                      {formatDistance(w.distanceMeters)}
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-600 font-medium">
                  {w.type} • {w.fee || 'Free'}
                </p>
                {w.address && (
                  <p className="text-[10px] text-slate-500 line-clamp-1">{w.address}</p>
                )}
                <div className="pt-1">
                  <a
                    href={getGoogleMapsDirectionUrl(userLocation.lat, userLocation.lng, w.lat, w.lng, 'walking')}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-1 px-2 rounded bg-cyan-700 text-white text-[10px] font-semibold flex items-center justify-center gap-1"
                  >
                    <Navigation className="w-2.5 h-2.5" />
                    <span>Walking Directions</span>
                  </a>
                </div>
              </div>
            </Popup>
          </Marker>
        ))}

        {/* Hospital Markers */}
        {hospitals.map((h) => (
          <Marker
            key={h.id}
            position={[h.lat, h.lng]}
            icon={createCustomMarkerIcon('hospital')}
          >
            <Popup className="custom-popup">
              <div className="p-1 text-slate-900 font-sans space-y-1.5">
                <div className="flex items-center justify-between gap-2 border-b border-slate-200 pb-1">
                  <h5 className="text-xs font-bold text-slate-900">{h.name}</h5>
                  {h.distanceMeters !== undefined && (
                    <span className="text-[10px] font-bold text-red-700">
                      {formatDistance(h.distanceMeters)}
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-red-700 font-bold">
                  {h.type} • 24/7 Emergency
                </p>
                {h.address && (
                  <p className="text-[10px] text-slate-500 line-clamp-1">{h.address}</p>
                )}
                <div className="flex gap-1 pt-1">
                  <a
                    href={`tel:${h.emergencyPhone}`}
                    className="flex-1 py-1 px-1.5 rounded bg-red-600 text-white text-[10px] font-bold flex items-center justify-center gap-1"
                  >
                    <PhoneCall className="w-2.5 h-2.5" />
                    <span>Call ({h.emergencyPhone})</span>
                  </a>
                  <a
                    href={getGoogleMapsDirectionUrl(userLocation.lat, userLocation.lng, h.lat, h.lng, 'driving')}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 py-1 px-1.5 rounded bg-slate-800 text-white text-[10px] font-semibold flex items-center justify-center gap-1"
                  >
                    <Navigation className="w-2.5 h-2.5" />
                    <span>Route</span>
                  </a>
                </div>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>

      {/* Floating Layer Toggle & Recenter Controls */}
      <div className="absolute top-3 right-3 z-[1000] flex flex-col gap-2">
        <button
          onClick={() =>
            setTileProvider(tileProvider === 'osm' ? 'hot' : 'osm')
          }
          className="p-2 rounded-xl bg-slate-950/80 backdrop-blur-md border border-amber-500/40 text-amber-300 hover:text-white shadow-lg transition-transform active:scale-95"
          title="Toggle OSM Style"
        >
          <Layers className="w-4 h-4" />
        </button>

        <button
          onClick={() => {
            const map = document.querySelector('.leaflet-container');
            if (map) {
              // Trigger center event if needed
            }
          }}
          className="p-2 rounded-xl bg-slate-950/80 backdrop-blur-md border border-amber-500/40 text-amber-300 hover:text-white shadow-lg transition-transform active:scale-95"
          title="Recenter on My Location"
        >
          <Compass className="w-4 h-4" />
        </button>
      </div>

      {/* Map Legend Overlay */}
      <div className="absolute bottom-3 left-3 z-[1000] bg-slate-950/85 backdrop-blur-md border border-amber-500/30 rounded-xl px-2.5 py-1.5 text-[10px] font-medium text-slate-300 flex items-center gap-3 shadow-lg">
        <div className="flex items-center gap-1">
          <div className="w-2.5 h-2.5 rounded-full bg-rose-600 border border-amber-300" />
          <span>Pandals ({pandals.length})</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2.5 h-2.5 rounded-full bg-sky-500 border border-white" />
          <span>You</span>
        </div>
        {restaurants.length > 0 && (
          <div className="flex items-center gap-1">
            <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />
            <span>Food ({restaurants.length})</span>
          </div>
        )}
        {washrooms.length > 0 && (
          <div className="flex items-center gap-1">
            <div className="w-2.5 h-2.5 rounded-full bg-cyan-500" />
            <span>Toilets ({washrooms.length})</span>
          </div>
        )}
        {hospitals.length > 0 && (
          <div className="flex items-center gap-1">
            <div className="w-2.5 h-2.5 rounded-full bg-red-600" />
            <span>Hospitals ({hospitals.length})</span>
          </div>
        )}
      </div>
    </div>
  );
}
