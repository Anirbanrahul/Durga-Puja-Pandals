# Project Specification: Pujo Parikrama & Companion Web App

## 1. Overview & Objective
Build a production-ready, mobile-first, 100% free-to-run Progressive Web Application (PWA) called **"Pujo Parikrama & Companion"** using **Next.js (App Router), TypeScript, Tailwind CSS, and Lucide React**.

Users must be able to:
1. Set their location via 4 methods (Live GPS, Search/Type, Paste from Notification/Clipboard/Map Link, or PWA Web Share Target).
2. Discover nearby Durga Puja pandals fetched from this Google MyMaps link: `https://goo.gl/maps/jB2cW6c9L27WFVs56?g_st=aw`.
3. Find nearby restaurants around their current location or any selected pandal for free.
4. Access offline-ready emergency numbers (Police, Ambulance, Fire, Women/Child Helpline) and share their live SOS location.

---

## 2. Strict Zero-Cost Architecture (No Paid API Keys)
Do NOT use paid Google Maps JS SDK or Google Places API that require billing. Use this 100% free stack:
- **Map UI:** `leaflet` + `react-leaflet` with free OpenStreetMap / CartoDB Voyager tiles.
- **Location Search (Geocoding):** OpenStreetMap **Nominatim API** (`https://nominatim.openstreetmap.org/search?format=json&countrycodes=in`) with 400ms debounce.
- **Nearby Restaurants:** OpenStreetMap **Overpass API** (`https://overpass-api.de/api/interpreter`) querying `["amenity"~"restaurant|cafe|fast_food|food_court"]` within a selectable radius (500m, 1km, 2km, 5km), paired with a zero-cost **"Open in Google Maps"** deep link (`https://www.google.com/maps/search/restaurants/@{lat},{lng},16z`).
- **Durga Puja Map Data (`https://goo.gl/maps/jB2cW6c9L27WFVs56?g_st=aw`):**
  - Create a Next.js API Route (`/api/pujo-locations`) that follows HTTP redirects on `https://goo.gl/maps/jB2cW6c9L27WFVs56?g_st=aw` to extract the `mid` parameter, fetches the raw KML via `https://www.google.com/maps/d/kml?mid={MID}&forcekml=1`, and converts it to GeoJSON using `@tmcw/togeojson` and `@xmldom/xmldom`.
  - Include a static fallback `public/data/pujo-pandals.geojson` and an in-app "Upload KML/GeoJSON" button so the app never fails offline or under rate limits.

---

## 3. Core Features to Implement

### A. Multi-Mode Location Selector (`LocationControlBar.tsx`)
1. **Current Location (GPS):** Uses `navigator.geolocation.getCurrentPosition` and an optional live `watchPosition` toggle.
2. **Search / Write Location:** Debounced input querying Nominatim API.
3. **Paste from Notification / App / Link:** Input parser that extracts `lat, lng` from:
   - Raw coordinates (`22.5726, 88.3639`)
   - Google Maps URLs (`@22.5726,88.3639` or `?q=22.5726,88.3639`)
   - Copied notification text or WhatsApp location messages.
   - If the pasted text is a shortened URL (`maps.app.goo.gl/...` or `goo.gl/maps/...`), resolve it via a server endpoint (`/api/resolve-url`) to extract coordinates.
4. **PWA Web Share Target:** Configure `public/manifest.json` with `share_target` pointing to `/share-target` so users can share locations directly from Google Maps or notifications into the app.

### B. Nearby Durga Puja Pandals (`PandalList.tsx` & `MapContainerView.tsx`)
- Compute distance from user's active location to each pandal using the **Haversine formula**.
- Filter by radius (`1 km`, `3 km`, `5 km`, `10 km`, `All`) and search by Pandal name.
- Sort by **Nearest First** or **Alphabetical**.
- Each Pandal card & map popup must include:
  - Name, description, and distance in km/m.
  - **"Nearby Restaurants"** button (loads restaurants around that pandal).
  - **"Navigate"** button (`https://www.google.com/maps/dir/?api=1&origin={userLat},{userLng}&destination={pandalLat},{pandalLng}&travelmode=walking`).

### C. Nearby Restaurants (`RestaurantList.tsx`)
- Fetch restaurants around the active location or selected pandal using Overpass API and cache results in `sessionStorage`.
- Display name, cuisine, distance, and two action buttons:
  - **"Directions"** (Google Maps route link).
  - **"View on Google Maps"** (opens `https://www.google.com/maps/search/?api=1&query={name}&query_place_id=...` or coordinate search for ratings/photos).

### D. Emergency & SOS Hub (`EmergencyModal.tsx`)
- Persistent red **"SOS / Emergency"** button in the header/floating bar.
- Works 100% offline with one-tap `tel:` links:
  - National Emergency: `112`
  - Police: `100`
  - Fire: `101`
  - Ambulance: `102` / `108`
  - Women Helpline: `1091`
  - Child Helpline: `1098`
  - Traffic Helpline: `1073`
- **"Share My SOS Location" button:** Uses Web Share API / WhatsApp link to send: `"Emergency! My current location is: https://www.google.com/maps?q={lat},{lng}"`.

---

## 4. Required File Structure
```text
src/
├── app/
│   ├── api/
│   │   ├── pujo-locations/route.ts   # Resolves goo.gl link, fetches MyMaps KML & converts to GeoJSON
│   │   └── resolve-url/route.ts      # Resolves shortened shared Google Maps links to coordinates
│   ├── share-target/page.tsx         # PWA share target handler
│   ├── layout.tsx
│   └── page.tsx                      # Main responsive UI (Map + Tabs for Pandals, Food, Emergency)
├── components/
│   ├── MapContainerView.tsx          # Dynamic SSR-disabled Leaflet map
│   ├── LocationControlBar.tsx        # 4-mode location input bar
│   ├── PandalList.tsx                # Pandal cards with distance & navigation
│   ├── RestaurantList.tsx            # Overpass restaurant finder + Google Maps deep links
│   └── EmergencyModal.tsx            # Offline emergency numbers & SOS location share
├── lib/
│   ├── geoUtils.ts                   # Haversine distance & regex coordinate/URL parsers
│   ├── overpass.ts                   # Overpass API fetcher
│   └── nominatim.ts                  # Nominatim geocoding helper
└── types/
    └── index.ts                      # TypeScript interfaces
```

## 5. Reference Code for Critical Endpoints

### `/api/pujo-locations/route.ts`
```typescript
import { NextResponse } from 'next/server';
import { DOMParser } from '@xmldom/xmldom';
import * as toGeoJSON from '@tmcw/togeojson';

const SHORT_MAP_URL = 'https://goo.gl/maps/jB2cW6c9L27WFVs56?g_st=aw';

export async function GET() {
  try {
    const redirectRes = await fetch(SHORT_MAP_URL, { method: 'GET', redirect: 'follow' });
    const finalUrl = new URL(redirectRes.url);
    const mid = finalUrl.searchParams.get('mid');

    if (!mid) {
      return NextResponse.json({ error: 'Could not extract mid parameter', url: redirectRes.url }, { status: 400 });
    }

    const kmlUrl = `https://www.google.com/maps/d/kml?mid=${mid}&forcekml=1`;
    const kmlRes = await fetch(kmlUrl, { next: { revalidate: 3600 } });
    const kmlText = await kmlRes.text();

    const xmlDoc = new DOMParser().parseFromString(kmlText, 'text/xml');
    const geoJson = toGeoJSON.kml(xmlDoc);

    return NextResponse.json(geoJson);
  } catch (err) {
    return NextResponse.json({ error: 'Failed to load KML, use fallback dataset' }, { status: 500 });
  }
}
```