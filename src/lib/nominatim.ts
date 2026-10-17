/**
 * OpenStreetMap Nominatim Geocoding and Reverse Geocoding Helper
 * Free-to-use search without paid API keys.
 */

export interface NominatimResult {
  place_id: number;
  osm_id: number;
  osm_type: string;
  lat: string;
  lon: string;
  display_name: string;
  type?: string;
  importance?: number;
  address?: {
    road?: string;
    suburb?: string;
    neighbourhood?: string;
    city?: string;
    state?: string;
    postcode?: string;
  };
}

export interface GeocodeLocation {
  name: string;
  displayName: string;
  lat: number;
  lng: number;
  zone?: string;
}

// Common Kolkata Quick Suggestions for immediate UX
export const POPULAR_KOLKATA_HUBS: GeocodeLocation[] = [
  {
    name: 'Bagbazar Ghat / Shyambazar',
    displayName: 'Bagbazar, Shyambazar, North Kolkata',
    lat: 22.6033,
    lng: 88.3664,
    zone: 'North Kolkata',
  },
  {
    name: 'Gariahat Crossing / Ballygunge',
    displayName: 'Gariahat, Rashbehari Crossing, South Kolkata',
    lat: 22.5186,
    lng: 88.3668,
    zone: 'South Kolkata',
  },
  {
    name: 'Maddox Square / Ritchie Road',
    displayName: 'Maddox Square, Ritchie Rd, Ballygunge',
    lat: 22.5312,
    lng: 88.3575,
    zone: 'South Kolkata',
  },
  {
    name: 'College Square / MG Road',
    displayName: 'College Street & MG Road, Central Kolkata',
    lat: 22.5762,
    lng: 88.3639,
    zone: 'Central Kolkata',
  },
  {
    name: 'Salt Lake Karunamoyee / FD Block',
    displayName: 'Karunamoyee, Sector 3, Salt Lake City',
    lat: 22.5855,
    lng: 88.4116,
    zone: 'Salt Lake',
  },
  {
    name: 'Lake Town / Sreebhumi',
    displayName: 'Lake Town, VIP Road, North East Kolkata',
    lat: 22.5968,
    lng: 88.4063,
    zone: 'North East',
  },
  {
    name: 'Kalighat / Deshapriya Park',
    displayName: 'Kalighat, Rashbehari Avenue, South Kolkata',
    lat: 22.5185,
    lng: 88.3541,
    zone: 'South Kolkata',
  },
  {
    name: 'Behala Chowrasta / Taratala',
    displayName: 'Behala Chowrasta, Diamond Harbour Rd',
    lat: 22.4985,
    lng: 88.3156,
    zone: 'Behala',
  },
];

/**
 * Searches locations using OpenStreetMap Nominatim with India and Kolkata priority
 */
export async function searchLocations(query: string): Promise<GeocodeLocation[]> {
  const trimmed = query.trim();
  if (!trimmed || trimmed.length < 2) {
    return [];
  }

  try {
    // Add Kolkata bias viewbox (left, top, right, bottom)
    const url = new URL('https://nominatim.openstreetmap.org/search');
    url.searchParams.set('format', 'json');
    url.searchParams.set('countrycodes', 'in');
    url.searchParams.set('q', trimmed);
    url.searchParams.set('limit', '8');
    url.searchParams.set('addressdetails', '1');
    url.searchParams.set('viewbox', '88.15,22.75,88.55,22.35');
    url.searchParams.set('bounded', '0');

    const response = await fetch(url.toString(), {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'PujoParikramaCompanion/1.0 (web-app; durgapujo-kolkata)',
      },
    });

    if (!response.ok) {
      throw new Error(`Nominatim error: ${response.status}`);
    }

    const data: NominatimResult[] = await response.json();

    return data.map((item) => {
      const suburb = item.address?.suburb || item.address?.neighbourhood || '';
      const city = item.address?.city || 'Kolkata';
      const shortName = item.display_name.split(',')[0];
      const zone = suburb ? `${suburb}, ${city}` : city;

      return {
        name: shortName,
        displayName: item.display_name,
        lat: parseFloat(item.lat),
        lng: parseFloat(item.lon),
        zone,
      };
    });
  } catch (error) {
    console.warn('Nominatim search failed, using local filter fallback:', error);
    // Fallback: search in popular Kolkata hubs
    const qLower = trimmed.toLowerCase();
    return POPULAR_KOLKATA_HUBS.filter(
      (hub) =>
        hub.name.toLowerCase().includes(qLower) ||
        hub.displayName.toLowerCase().includes(qLower) ||
        (hub.zone && hub.zone.toLowerCase().includes(qLower))
    );
  }
}

/**
 * Reverse geocodes coordinates to a human-readable area name
 */
export async function reverseGeocode(
  lat: number,
  lng: number
): Promise<string> {
  try {
    const url = new URL('https://nominatim.openstreetmap.org/reverse');
    url.searchParams.set('format', 'json');
    url.searchParams.set('lat', lat.toString());
    url.searchParams.set('lon', lng.toString());
    url.searchParams.set('zoom', '16');
    url.searchParams.set('addressdetails', '1');

    const response = await fetch(url.toString(), {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'PujoParikramaCompanion/1.0 (web-app; durgapujo-kolkata)',
      },
    });

    if (!response.ok) {
      return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    }

    const data: NominatimResult = await response.json();
    const road = data.address?.road;
    const suburb = data.address?.suburb || data.address?.neighbourhood;
    const city = data.address?.city;

    const parts = [road, suburb, city].filter(Boolean);
    if (parts.length > 0) {
      return parts.join(', ');
    }

    return data.display_name.split(',').slice(0, 3).join(', ') || `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  } catch {
    return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  }
}
