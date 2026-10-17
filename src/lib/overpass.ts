/**
 * OpenStreetMap Overpass API fetcher for nearby restaurants, cafes, and eateries
 * 100% Free - zero paid API keys
 */

import { Restaurant } from '@/types';
import { haversineDistance } from './geoUtils';

// Overpass API Endpoints (Primary with fallback mirror)
const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];

// Fallback iconic Kolkata eateries if Overpass is temporarily unavailable or rate-limited
export const ICONIC_KOLKATA_RESTAURANTS: Array<{
  name: string;
  lat: number;
  lng: number;
  cuisine: string;
  amenity: string;
  address: string;
}> = [
  {
    name: 'Peter Cat',
    lat: 22.5532,
    lng: 88.3524,
    cuisine: 'Continental & Chelo Kebab',
    amenity: 'restaurant',
    address: '18A Park Street, Park Street area, Kolkata',
  },
  {
    name: 'Mocambo Restaurant',
    lat: 22.5534,
    lng: 88.3522,
    cuisine: 'Continental, Devilled Crab, Fish Florentine',
    amenity: 'restaurant',
    address: '25B Park Street, Kolkata',
  },
  {
    name: 'Flurys Heritage Tea Room',
    lat: 22.5538,
    lng: 88.3516,
    cuisine: 'European Bakery, English Breakfast, Pastries',
    amenity: 'cafe',
    address: '18 Park Street, Kolkata',
  },
  {
    name: 'Arsalan Restaurant (Park Circus)',
    lat: 22.5414,
    lng: 88.3655,
    cuisine: 'Kolkata Biryani & Mughlai',
    amenity: 'restaurant',
    address: '138 Park Street, 7-Point Crossing, Kolkata',
  },
  {
    name: 'Aminia Restaurant (New Market)',
    lat: 22.5606,
    lng: 88.3533,
    cuisine: 'Awadhi & Kolkata Biryani, Rezala',
    amenity: 'restaurant',
    address: 'SN Banerjee Road, near Corporation, New Market',
  },
  {
    name: '6 Ballygunge Place',
    lat: 22.5273,
    lng: 88.3658,
    cuisine: 'Authentic Bengali (Daab Chingri, Kosha Mangsho)',
    amenity: 'restaurant',
    address: '6 Ballygunge Place, Ballygunge, Kolkata',
  },
  {
    name: 'Bhojohori Manna (Gariahat)',
    lat: 22.5182,
    lng: 88.3685,
    cuisine: 'Traditional Bengali Homestyle, Ilish & Pulao',
    amenity: 'restaurant',
    address: 'Ekdalia Road, Gariahat, Kolkata',
  },
  {
    name: 'Mitra Cafe (Shyambazar)',
    lat: 22.6006,
    lng: 88.3705,
    cuisine: 'Bengali Fast Food, Diamond Fish Fry, Kabiraji',
    amenity: 'fast_food',
    address: '47 Jatindra Mohan Ave, Sovabazar / Shyambazar',
  },
  {
    name: 'Golbari (New Punjabi Hotel)',
    lat: 22.6008,
    lng: 88.3712,
    cuisine: 'Legendary Kosha Mangsho & Paratha',
    amenity: 'restaurant',
    address: 'Acharya Prafulla Chandra Rd, Shyambazar 5-Point',
  },
  {
    name: 'Paramount Cold Drinks & Sherbets',
    lat: 22.5746,
    lng: 88.3644,
    cuisine: 'Heritage Daab Sherbet, Malai Syrup',
    amenity: 'cafe',
    address: '1/1/1D Bankim Chatterjee St, College Square',
  },
  {
    name: 'Kusum Rolls',
    lat: 22.5529,
    lng: 88.3528,
    cuisine: 'Famous Kolkata Kathi Rolls',
    amenity: 'fast_food',
    address: '21 Park Street, Kolkata',
  },
  {
    name: 'Olypub',
    lat: 22.5539,
    lng: 88.3521,
    cuisine: 'Pub Food, Beef Steak, Beer',
    amenity: 'restaurant',
    address: '21 Park Street, Kolkata',
  },
  {
    name: 'Dhiren Cabin',
    lat: 22.5976,
    lng: 88.3657,
    cuisine: 'Heritage Fish Finger & Mutton Cutlet',
    amenity: 'cafe',
    address: 'Sovabazar, North Kolkata',
  },
  {
    name: 'Hatari Restaurant (Gariahat)',
    lat: 22.5195,
    lng: 88.3639,
    cuisine: 'Indo-Chinese & Tandoor',
    amenity: 'restaurant',
    address: 'Rashbehari Avenue, Gariahat, Kolkata',
  },
  {
    name: 'Bedwin Restaurant (Gariahat)',
    lat: 22.5188,
    lng: 88.3659,
    cuisine: 'Kolkata Rolls, Biryani, Mughlai',
    amenity: 'fast_food',
    address: 'Gariahat Market Crossing, Kolkata',
  },
  {
    name: 'Kewpie’s Kitchen',
    lat: 22.5358,
    lng: 88.3496,
    cuisine: 'Traditional Bengali Thali',
    amenity: 'restaurant',
    address: '2 Elgin Lane, Near Netaji Bhawan, Kolkata',
  },
  {
    name: 'Saptapadi Restaurant',
    lat: 22.5125,
    lng: 88.3582,
    cuisine: 'Retro Bengali Fusion Feast',
    amenity: 'restaurant',
    address: 'Purna Das Road, Hindustan Park, Kolkata',
  },
  {
    name: 'Santa’s Fantasea',
    lat: 22.5142,
    lng: 88.3605,
    cuisine: 'Tribal & Coastal Seafood Cuisine',
    amenity: 'restaurant',
    address: 'Golpark, Keyatala Road, Kolkata',
  },
];

/**
 * Builds cache key for sessionStorage
 */
function getCacheKey(lat: number, lng: number, radiusMeters: number): string {
  const latKey = lat.toFixed(3);
  const lngKey = lng.toFixed(3);
  return `pujo_resto_${latKey}_${lngKey}_${radiusMeters}`;
}

/**
 * Fetches nearby restaurants using Overpass API with local sessionStorage caching
 */
export async function fetchNearbyRestaurants(
  lat: number,
  lng: number,
  radiusMeters: number = 1000
): Promise<Restaurant[]> {
  // Check sessionStorage cache (browser only)
  const cacheKey = getCacheKey(lat, lng, radiusMeters);
  if (typeof window !== 'undefined') {
    try {
      const cached = sessionStorage.getItem(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Recalculate distance dynamically relative to current lat/lng
          return parsed.map((item: Restaurant) => {
            const distance = haversineDistance(lat, lng, item.lat, item.lng);
            return {
              ...item,
              distanceMeters: distance,
              distanceKm: Number((distance / 1000).toFixed(2)),
            };
          }).sort((a: Restaurant, b: Restaurant) => (a.distanceMeters || 0) - (b.distanceMeters || 0));
        }
      }
    } catch {
      // Ignore cache read errors
    }
  }

  // Construct Overpass QL query
  const query = `
    [out:json][timeout:20];
    (
      node["amenity"~"restaurant|cafe|fast_food|food_court"](around:${radiusMeters},${lat},${lng});
      way["amenity"~"restaurant|cafe|fast_food|food_court"](around:${radiusMeters},${lat},${lng});
    );
    out center 40;
  `;

  let fetchedData: Restaurant[] = [];

  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 12000);

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: `data=${encodeURIComponent(query)}`,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        continue;
      }

      const json = await response.json();
      const elements = json.elements || [];

      fetchedData = elements
        .filter((el: Record<string, unknown>) => {
          const tags = el.tags as Record<string, string> | undefined;
          return tags && (tags.name || tags['name:en']);
        })
        .map((el: Record<string, unknown>) => {
          const tags = (el.tags as Record<string, string>) || {};
          const rLat =
            (el.lat as number) ||
            ((el.center as Record<string, number>)?.lat ?? lat);
          const rLng =
            (el.lon as number) ||
            ((el.center as Record<string, number>)?.lon ?? lng);
          const dist = haversineDistance(lat, lng, rLat, rLng);

          const cuisineRaw = tags.cuisine || tags.food || '';
          const cuisineClean = cuisineRaw
            ? cuisineRaw.replace(/;/g, ', ')
            : tags.amenity === 'cafe'
            ? 'Cafe, Snacks & Beverages'
            : tags.amenity === 'fast_food'
            ? 'Fast Food & Street Snacks'
            : 'Multi-cuisine Restaurant';

          return {
            id: `osm-${el.id}`,
            name: tags['name:en'] || tags.name,
            lat: rLat,
            lng: rLng,
            cuisine: cuisineClean,
            amenity: tags.amenity || 'restaurant',
            distanceMeters: dist,
            distanceKm: Number((dist / 1000).toFixed(2)),
            address:
              tags['addr:street'] ||
              tags['addr:full'] ||
              tags['addr:suburb'] ||
              undefined,
            openingHours: tags.opening_hours,
            phone: tags.phone || tags['contact:phone'],
            website: tags.website || tags['contact:website'],
          };
        });

      if (fetchedData.length > 0) {
        break; // Successfully got data
      }
    } catch {
      // Try next endpoint mirror
      continue;
    }
  }

  // If Overpass returned no results (e.g. rate limit, offline, or sparse area),
  // supplement with iconic Kolkata eateries closest to the user / pandal
  if (fetchedData.length === 0) {
    fetchedData = ICONIC_KOLKATA_RESTAURANTS.map((resto, idx) => {
      const dist = haversineDistance(lat, lng, resto.lat, resto.lng);
      return {
        id: `iconic-${idx}`,
        name: resto.name,
        lat: resto.lat,
        lng: resto.lng,
        cuisine: resto.cuisine,
        amenity: resto.amenity,
        distanceMeters: dist,
        distanceKm: Number((dist / 1000).toFixed(2)),
        address: resto.address,
      };
    })
      // Filter by radius if within 5km, or return closest ones
      .filter((r) => radiusMeters >= 5000 || (r.distanceMeters || 0) <= Math.max(radiusMeters, 4000))
      .slice(0, 15);
  }

  // Sort by nearest distance first
  fetchedData.sort((a, b) => (a.distanceMeters || 0) - (b.distanceMeters || 0));

  // Save in sessionStorage
  if (typeof window !== 'undefined' && fetchedData.length > 0) {
    try {
      sessionStorage.setItem(cacheKey, JSON.stringify(fetchedData));
    } catch {
      // Ignore sessionStorage full
    }
  }

  return fetchedData;
}
