'use client';

import { useState, useEffect, useMemo, Suspense, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Pandal,
  Restaurant,
  Washroom,
  Hospital,
  ActiveLocation,
  RadiusFilter,
  AppTab,
} from '@/types';
import {
  haversineDistance,
  DEFAULT_KOLKATA_COORDS,
  safeString,
} from '@/lib/geoUtils';
import {
  persistActiveLocation,
  retrieveActiveLocation,
  cacheOfflinePandals,
  retrieveOfflinePandals,
} from '@/lib/storageUtils';
import {
  fetchNearbyWashrooms,
  fetchNearbyHospitals,
} from '@/lib/overpass';
import LocationControlBar from '@/components/LocationControlBar';
import PandalList from '@/components/PandalList';
import RestaurantList from '@/components/RestaurantList';
import WashroomList from '@/components/WashroomList';
import HospitalList from '@/components/HospitalList';
import MapContainerView from '@/components/MapContainerView';
import EmergencyModal from '@/components/EmergencyModal';
import SplashLoader from '@/components/SplashLoader';
import PujoTithiBadge from '@/components/PujoTithiBadge';
import StickyBranding from '@/components/StickyBranding';
import {
  MapPin,
  Utensils,
  Map as MapIcon,
  ShieldAlert,
  Compass,
  Sparkles,
  Wifi,
  WifiOff,
  Layers,
  ChevronUp,
  Info,
} from 'lucide-react';

function PujoParikramaApp() {
  const searchParams = useSearchParams();

  // Active Location state
  const [userLocation, setUserLocation] = useState<ActiveLocation>(() => {
    // Check initial searchParams if available
    const urlLat = searchParams.get('lat');
    const urlLng = searchParams.get('lng');
    const urlAddr = searchParams.get('addr');
    const urlSource = searchParams.get('source');

    if (urlLat && urlLng) {
      return {
        lat: parseFloat(urlLat),
        lng: parseFloat(urlLng),
        address: urlAddr || 'Shared Map Location',
        source: (urlSource as ActiveLocation['source']) || 'share',
      };
    }

    return {
      lat: DEFAULT_KOLKATA_COORDS.lat,
      lng: DEFAULT_KOLKATA_COORDS.lng,
      address: 'Esplanade / Park Street (Central Kolkata)',
      source: 'default',
    };
  });

  // Pandals state
  const [rawPandalFeatures, setRawPandalFeatures] = useState<Array<Record<string, unknown>>>([]);
  const [isLoadingPandals, setIsLoadingPandals] = useState<boolean>(true);
  const [selectedPandal, setSelectedPandal] = useState<Pandal | null>(null);
  const [radiusMeters, setRadiusMeters] = useState<RadiusFilter>(5000);

  // Restaurants state
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [focusedFoodPandal, setFocusedFoodPandal] = useState<Pandal | null>(null);
  const [highlightedRestoId, setHighlightedRestoId] = useState<string | number | null>(null);

  // Washrooms state (Public & Malls)
  const [washrooms, setWashrooms] = useState<Washroom[]>([]);
  const [washroomRadius, setWashroomRadius] = useState<RadiusFilter>(5000);
  const [isLoadingWashrooms, setIsLoadingWashrooms] = useState<boolean>(false);

  // Hospitals state (24x7 Emergency)
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [hospitalRadius, setHospitalRadius] = useState<RadiusFilter>(10000);
  const [isLoadingHospitals, setIsLoadingHospitals] = useState<boolean>(false);

  // UI Navigation state
  const [activeTab, setActiveTab] = useState<AppTab>('pandals');
  const [isEmergencyModalOpen, setIsEmergencyModalOpen] = useState<boolean>(false);
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [isDrawerOpenOnMobileMap, setIsDrawerOpenOnMobileMap] = useState<boolean>(false);
  const [showSplash, setShowSplash] = useState<boolean>(true);

  // Helper to persist location in universal multi-tier storage (localStorage + Cookies for iOS/Android)
  const handleLocationChange = useCallback((newLoc: ActiveLocation) => {
    setUserLocation(newLoc);
    persistActiveLocation(newLoc);
  }, []);

  // Monitor network online/offline status
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setIsOnline(navigator.onLine);
      const handleOnline = () => setIsOnline(true);
      const handleOffline = () => setIsOnline(false);
      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);
      return () => {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
      };
    }
  }, []);

  // Restore saved location or URL query on initial mount / reload
  useEffect(() => {
    const urlLat = searchParams.get('lat');
    const urlLng = searchParams.get('lng');
    const urlAddr = searchParams.get('addr');
    const urlSource = searchParams.get('source');

    if (urlLat && urlLng) {
      const loc: ActiveLocation = {
        lat: parseFloat(urlLat),
        lng: parseFloat(urlLng),
        address: urlAddr || 'Shared Pin',
        source: (urlSource as ActiveLocation['source']) || 'share',
      };
      handleLocationChange(loc);
      return;
    }

    // Check universal storage (localStorage + cookie fallback for iOS Safari/Android Webviews)
    const saved = retrieveActiveLocation();
    if (saved) {
      setUserLocation(saved);

      // If previously set via GPS, quietly refresh coordinates if available
      if (saved.source === 'gps' && typeof navigator !== 'undefined' && navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            handleLocationChange({
              lat: pos.coords.latitude,
              lng: pos.coords.longitude,
              address: saved.address || 'Current Live GPS Location',
              source: 'gps',
              accuracy: Math.round(pos.coords.accuracy),
              timestamp: pos.timestamp,
            });
          },
          () => {}, // silent fallback to saved cached position
          { timeout: 8000, maximumAge: 60000 }
        );
      }
    }
  }, [searchParams, handleLocationChange]);

  // Fetch Pujo Pandals from API route
  useEffect(() => {
    async function loadPandals() {
      setIsLoadingPandals(true);
      try {
        const res = await fetch('/api/pujo-locations');
        const data = await res.json();

        if (data && Array.isArray(data.features) && data.features.length > 0) {
          setRawPandalFeatures(data.features);
          cacheOfflinePandals(data.features);
        }
      } catch (err) {
        console.warn('Failed to fetch /api/pujo-locations, loading fallback...', err);
        try {
          const fallbackRes = await fetch('/data/pujo-pandals.geojson');
          const fallbackData = await fallbackRes.json();
          if (fallbackData && Array.isArray(fallbackData.features) && fallbackData.features.length > 0) {
            setRawPandalFeatures(fallbackData.features);
            cacheOfflinePandals(fallbackData.features);
          }
        } catch (e) {
          console.error('All network pandal loading failed, checking offline cache:', e);
          try {
            const cachedPandals = await retrieveOfflinePandals<Record<string, unknown>>();
            if (cachedPandals && cachedPandals.length > 0) {
              setRawPandalFeatures(cachedPandals);
            }
          } catch {
            // Ignore
          }
        }
      } finally {
        setIsLoadingPandals(false);
      }
    }

    loadPandals();
  }, []);

  // Fetch Washrooms (Public & Malls) dynamically relative to user location
  useEffect(() => {
    let isMounted = true;
    async function loadWashrooms() {
      setIsLoadingWashrooms(true);
      try {
        const data = await fetchNearbyWashrooms(
          userLocation.lat,
          userLocation.lng,
          washroomRadius
        );
        if (isMounted) setWashrooms(data);
      } catch (err) {
        console.warn('Washrooms load issue:', err);
      } finally {
        if (isMounted) setIsLoadingWashrooms(false);
      }
    }

    loadWashrooms();
    return () => { isMounted = false; };
  }, [userLocation.lat, userLocation.lng, washroomRadius]);

  // Fetch Hospitals (24x7 Emergency) dynamically relative to user location
  useEffect(() => {
    let isMounted = true;
    async function loadHospitals() {
      setIsLoadingHospitals(true);
      try {
        const data = await fetchNearbyHospitals(
          userLocation.lat,
          userLocation.lng,
          hospitalRadius
        );
        if (isMounted) setHospitals(data);
      } catch (err) {
        console.warn('Hospitals load issue:', err);
      } finally {
        if (isMounted) setIsLoadingHospitals(false);
      }
    }

    loadHospitals();
    return () => { isMounted = false; };
  }, [userLocation.lat, userLocation.lng, hospitalRadius]);

  // Parse raw GeoJSON features into typed Pandal objects with dynamic distances
  const pandals: Pandal[] = useMemo(() => {
    if (!rawPandalFeatures || rawPandalFeatures.length === 0) return [];

    return rawPandalFeatures
      .map((feat: Record<string, unknown>, index: number) => {
        const props = (feat.properties as Record<string, unknown>) || {};
        const geom = (feat.geometry as { type: string; coordinates: [number, number] }) || {};

        if (!geom.coordinates || !Array.isArray(geom.coordinates)) return null;

        const lng = geom.coordinates[0];
        const lat = geom.coordinates[1];

        if (typeof lat !== 'number' || typeof lng !== 'number') return null;

        const dist = haversineDistance(userLocation.lat, userLocation.lng, lat, lng);

        const name =
          safeString(props.name) ||
          safeString(props.Name) ||
          safeString(props.title) ||
          `Durga Puja Pandal #${index + 1}`;

        const desc =
          safeString(props.description) ||
          safeString(props.Description) ||
          safeString(props.desc) ||
          'Historic community Durga Puja celebrations with traditional rites and festive artistry.';

        const zone = safeString(props.zone, 'Kolkata');
        const nearestMetro = safeString(props.nearestMetro) || undefined;
        const famousFor = safeString(props.famousFor) || undefined;
        const category = (safeString(props.category) as Pandal['category']) || undefined;
        const address = safeString(props.address) || undefined;

        return {
          id: (props.id as string) || `pandal-${index}`,
          name,
          zone,
          description: desc,
          lat,
          lng,
          distanceMeters: dist,
          distanceKm: Number((dist / 1000).toFixed(2)),
          nearestMetro,
          famousFor,
          category,
          address,
          rawProperties: props,
        } as Pandal;
      })
      .filter((p): p is Pandal => p !== null);
  }, [rawPandalFeatures, userLocation.lat, userLocation.lng]);

  // Handler for custom uploaded KML/GeoJSON
  const handleCustomDataUpload = useCallback((geoJson: Record<string, unknown>) => {
    if (geoJson && Array.isArray(geoJson.features)) {
      setRawPandalFeatures(geoJson.features as Array<Record<string, unknown>>);
    }
  }, []);

  // When user clicks "Nearby Food" on a pandal
  const handleFindFoodNearPandal = (pandal: Pandal) => {
    setFocusedFoodPandal(pandal);
    setActiveTab('restaurants');
  };

  // When user selects a pandal from list or map
  const handleSelectPandal = (pandal: Pandal) => {
    setSelectedPandal(pandal);
    setIsDrawerOpenOnMobileMap(true);
  };

  // When user clicks "View Map" on a pandal card
  const handleShowOnMap = (pandal: Pandal) => {
    setSelectedPandal(pandal);
    setActiveTab('map');
    setIsDrawerOpenOnMobileMap(true);
  };

  return (
    <div className="flex flex-col h-[100dvh] bg-slate-950 text-white overflow-hidden relative">
      {/* 0. Animated Festive Durga Puja Splash Loader */}
      {showSplash && (
        <SplashLoader onComplete={() => setShowSplash(false)} minDuration={2000} />
      )}

      {/* 1. Header Bar */}
      <header className="bg-slate-950 border-b border-amber-500/20 px-3 sm:px-6 py-2.5 flex items-center justify-between shrink-0 z-30 shadow-md">
        <div className="flex items-center gap-2.5 min-w-0">
          {/* Logo */}
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-500 via-rose-600 to-red-700 p-0.5 flex items-center justify-center shadow-lg shadow-rose-900/40 shrink-0">
            <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
              <span className="text-amber-400 font-bold text-sm tracking-wider">🕉️</span>
            </div>
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <h1 className="text-sm sm:text-base font-extrabold tracking-tight text-white flex items-center gap-1 truncate">
                <span>Pujo Parikrama</span>
                <span className="text-amber-400 font-semibold text-xs">&amp; Companion</span>
              </h1>
              {/* Creator Sticky Badge */}
              <StickyBranding variant="badge" className="hidden sm:inline-flex" />

              {!isOnline && (
                <span className="text-[10px] bg-amber-500/20 text-amber-300 px-1.5 py-0.2 rounded font-mono flex items-center gap-1 border border-amber-500/30">
                  <WifiOff className="w-2.5 h-2.5 text-amber-400" />
                  Offline Ready
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-400 font-medium hidden md:block truncate">
              Kolkata Durga Puja Guide • Pandals, Food, Washrooms &amp; Hospitals
            </p>
          </div>
        </div>

        {/* Header Right: Pujo Tithi Badge (Running Day) & Emergency SOS Button */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Pujo Tithi Live Status (e.g., Sasthi / Saptami Running) */}
          <PujoTithiBadge />

          {/* SOS Emergency Button */}
          <button
            onClick={() => setIsEmergencyModalOpen(true)}
            className="py-1.5 px-3 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-extrabold text-xs flex items-center gap-1.5 shadow-lg shadow-red-900/50 transition-all active:scale-95 border border-red-400/50 animate-pulse"
            title="Open Emergency Offline Helplines & SOS"
          >
            <ShieldAlert className="w-4 h-4 text-white" />
            <span className="hidden xs:inline">SOS</span>
          </button>
        </div>
      </header>

      {/* 2. 4-Mode Location Control Bar */}
      <LocationControlBar
        activeLocation={userLocation}
        onLocationChange={handleLocationChange}
        onCustomDataUpload={handleCustomDataUpload}
        className="shrink-0 z-20"
      />

      {/* 3. Main Body Container (Responsive Dual Split for Desktop, Tabbed for Mobile) */}
      <main className="flex-1 flex overflow-hidden relative">
        {/* Left Column (Pandals / Food / Washrooms / Hospitals) */}
        <section
          className={`w-full md:w-[460px] lg:w-[500px] xl:w-[540px] flex flex-col border-r border-slate-800 bg-slate-950/80 shrink-0 z-10 ${
            activeTab === 'map' ? 'hidden md:flex' : 'flex'
          }`}
        >
          {/* Navigation Pills */}
          <div className="p-2.5 sm:p-3 border-b border-slate-800 bg-slate-900/60 flex items-center justify-between gap-2 shrink-0 overflow-x-auto no-scrollbar">
            <div className="flex gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800 w-full sm:w-auto overflow-x-auto no-scrollbar">
              <button
                onClick={() => setActiveTab('pandals')}
                className={`py-1.5 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all whitespace-nowrap ${
                  activeTab === 'pandals'
                    ? 'bg-amber-500 text-slate-950 shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <span>🕉️ Pandals</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-900/40 font-mono">
                  {pandals.length}
                </span>
              </button>

              <button
                onClick={() => setActiveTab('restaurants')}
                className={`py-1.5 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all whitespace-nowrap ${
                  activeTab === 'restaurants'
                    ? 'bg-amber-500 text-slate-950 shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <span>🍲 Food</span>
                {focusedFoodPandal && (
                  <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                )}
              </button>

              <button
                onClick={() => setActiveTab('washrooms')}
                className={`py-1.5 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all whitespace-nowrap ${
                  activeTab === 'washrooms'
                    ? 'bg-cyan-500 text-slate-950 shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <span>🚻 Toilets</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-900/40 font-mono">
                  {washrooms.length}
                </span>
              </button>

              <button
                onClick={() => setActiveTab('hospitals')}
                className={`py-1.5 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all whitespace-nowrap ${
                  activeTab === 'hospitals'
                    ? 'bg-red-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <span>🏥 Hospitals</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-900/40 font-mono">
                  {hospitals.length}
                </span>
              </button>
            </div>

            {/* Mobile Map Switch Button */}
            <button
              onClick={() => setActiveTab('map')}
              className="md:hidden py-1.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 text-xs font-semibold flex items-center gap-1.5 border border-slate-700 shrink-0"
            >
              <MapIcon className="w-3.5 h-3.5" />
              <span>Map View</span>
            </button>
          </div>

          {/* Tab Content Area */}
          <div className="flex-1 p-3 overflow-hidden">
            {activeTab === 'pandals' && (
              <PandalList
                pandals={pandals}
                userLocation={userLocation}
                selectedPandalId={selectedPandal?.id}
                onSelectPandal={handleSelectPandal}
                onFindFoodNearPandal={handleFindFoodNearPandal}
                onShowOnMap={handleShowOnMap}
                radiusMeters={radiusMeters}
                onRadiusChange={setRadiusMeters}
              />
            )}

            {activeTab === 'restaurants' && (
              <RestaurantList
                userLocation={userLocation}
                focusedPandal={focusedFoodPandal}
                onClearFocusedPandal={() => setFocusedFoodPandal(null)}
                onHighlightRestaurant={(resto) => setHighlightedRestoId(resto.id)}
                onLoadedRestaurants={setRestaurants}
              />
            )}

            {activeTab === 'washrooms' && (
              <WashroomList
                washrooms={washrooms}
                userLocation={userLocation}
                radiusMeters={washroomRadius}
                onRadiusChange={setWashroomRadius}
                isLoading={isLoadingWashrooms}
                onShowOnMap={() => setActiveTab('map')}
              />
            )}

            {activeTab === 'hospitals' && (
              <HospitalList
                hospitals={hospitals}
                userLocation={userLocation}
                radiusMeters={hospitalRadius}
                onRadiusChange={setHospitalRadius}
                isLoading={isLoadingHospitals}
                onShowOnMap={() => setActiveTab('map')}
              />
            )}
          </div>
        </section>

        {/* Right Column: Full Interactive Leaflet Map */}
        <section
          className={`flex-1 h-full relative overflow-hidden ${
            activeTab === 'map' ? 'flex flex-col' : 'hidden md:flex flex-col'
          }`}
        >
          {/* Leaflet Map Component */}
          <div className="w-full h-full relative">
            <MapContainerView
              userLocation={userLocation}
              pandals={pandals}
              restaurants={restaurants}
              washrooms={washrooms}
              hospitals={hospitals}
              selectedPandalId={selectedPandal?.id}
              onSelectPandal={handleSelectPandal}
              onFindFoodNearPandal={handleFindFoodNearPandal}
              radiusMeters={radiusMeters}
              highlightedRestaurantId={highlightedRestoId}
            />

            {/* Mobile Floating Drawer / Bottom Card on Map View */}
            {selectedPandal && isDrawerOpenOnMobileMap && (
              <div className="md:hidden absolute bottom-20 left-3 right-3 z-[1000] bg-slate-900/95 border border-amber-500/40 rounded-2xl p-3 shadow-2xl backdrop-blur-md animate-in slide-in-from-bottom-4 duration-200">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-rose-400">
                      {selectedPandal.zone}
                    </span>
                    <h4 className="text-sm font-bold text-white leading-tight">
                      {selectedPandal.name}
                    </h4>
                  </div>
                  <button
                    onClick={() => setIsDrawerOpenOnMobileMap(false)}
                    className="text-xs text-slate-400 hover:text-white p-1"
                  >
                    ✕
                  </button>
                </div>
                <p className="text-xs text-slate-300 mt-1 line-clamp-2">
                  {selectedPandal.description}
                </p>
                <div className="flex items-center gap-2 mt-2 pt-2 border-t border-slate-800">
                  <a
                    href={`https://www.google.com/maps/dir/?api=1&origin=${userLocation.lat},${userLocation.lng}&destination=${selectedPandal.lat},${selectedPandal.lng}&travelmode=walking`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 py-1.5 rounded-lg bg-rose-600 text-white font-bold text-xs flex items-center justify-center gap-1"
                  >
                    <span>Walking Directions</span>
                  </a>
                  <button
                    onClick={() => handleFindFoodNearPandal(selectedPandal)}
                    className="flex-1 py-1.5 rounded-lg bg-amber-500 text-slate-950 font-bold text-xs flex items-center justify-center gap-1"
                  >
                    <span>Food Nearby</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>
      </main>

      {/* 4. Sticky Creator Branding (Visible on both desktop & mobile) */}
      <StickyBranding variant="banner" />

      {/* 5. Mobile Bottom Navigation Bar (Pandals, Map, Food, Washrooms, Hospitals) */}
      <nav className="md:hidden bg-slate-950/95 backdrop-blur-md border-t border-slate-800/80 px-2 py-1 safe-bottom flex items-center justify-around z-30 shrink-0">
        <button
          onClick={() => setActiveTab('pandals')}
          className={`flex-1 flex flex-col items-center justify-center py-1 px-0.5 rounded-xl transition-all ${
            activeTab === 'pandals'
              ? 'text-amber-400 font-bold bg-amber-500/10'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <span className="text-sm">🕉️</span>
          <span className="text-[10px] mt-0.5">Pandals</span>
        </button>

        <button
          onClick={() => setActiveTab('map')}
          className={`flex-1 flex flex-col items-center justify-center py-1 px-0.5 rounded-xl transition-all ${
            activeTab === 'map'
              ? 'text-amber-400 font-bold bg-amber-500/10'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <MapIcon className="w-3.5 h-3.5 text-amber-400" />
          <span className="text-[10px] mt-0.5">Live Map</span>
        </button>

        <button
          onClick={() => setActiveTab('restaurants')}
          className={`flex-1 flex flex-col items-center justify-center py-1 px-0.5 rounded-xl transition-all ${
            activeTab === 'restaurants'
              ? 'text-amber-400 font-bold bg-amber-500/10'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Utensils className="w-3.5 h-3.5 text-amber-400" />
          <span className="text-[10px] mt-0.5">Food</span>
        </button>

        <button
          onClick={() => setActiveTab('washrooms')}
          className={`flex-1 flex flex-col items-center justify-center py-1 px-0.5 rounded-xl transition-all ${
            activeTab === 'washrooms'
              ? 'text-cyan-400 font-bold bg-cyan-500/10'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <span className="text-sm">🚻</span>
          <span className="text-[10px] mt-0.5">Toilets</span>
        </button>

        <button
          onClick={() => setActiveTab('hospitals')}
          className={`flex-1 flex flex-col items-center justify-center py-1 px-0.5 rounded-xl transition-all ${
            activeTab === 'hospitals'
              ? 'text-red-400 font-bold bg-red-500/10'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <span className="text-sm">🏥</span>
          <span className="text-[10px] mt-0.5">Hospitals</span>
        </button>
      </nav>

      {/* 6. Offline & Emergency SOS Hub Modal */}
      <EmergencyModal
        isOpen={isEmergencyModalOpen}
        onClose={() => setIsEmergencyModalOpen(false)}
        userLocation={userLocation}
      />
    </div>
  );
}

export default function Home() {
  return (
    <Suspense
      fallback={
        <div className="h-screen w-screen bg-slate-950 flex flex-col items-center justify-center text-white">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center mb-3">
            <Compass className="w-6 h-6 text-amber-400 animate-spin" />
          </div>
          <p className="text-sm font-bold text-amber-200">Loading Pujo Parikrama &amp; Companion...</p>
        </div>
      }
    >
      <PujoParikramaApp />
    </Suspense>
  );
}
