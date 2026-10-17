/**
 * Geo and Location utilities for Pujo Parikrama & Companion
 */

import { LocationCoords } from '@/types';

// Radius of Earth in meters
const EARTH_RADIUS_METERS = 6371000;

/**
 * Calculates Haversine distance between two coordinates in meters
 */
export function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(EARTH_RADIUS_METERS * c);
}

/**
 * Formats meter distance to human-readable string (e.g. "450 m" or "2.3 km")
 */
export function formatDistance(meters?: number): string {
  if (meters === undefined || meters === null || isNaN(meters)) {
    return 'Distance unavailable';
  }
  if (meters < 1000) {
    return `${Math.round(meters)} m`;
  }
  const km = (meters / 1000).toFixed(1);
  return `${km} km`;
}

/**
 * Checks if a string contains a shortened URL that needs server-side redirection
 */
export function isShortUrl(text: string): boolean {
  if (!text) return false;
  const shortDomainPatterns = [
    /goo\.gl\/maps/i,
    /maps\.app\.goo\.gl/i,
    /bit\.ly/i,
    /tinyurl\.com/i,
    /t\.co/i,
  ];
  return shortDomainPatterns.some((pattern) => pattern.test(text));
}

/**
 * Extracts coordinate pair { lat, lng } from arbitrary text, coordinates, or Google Maps URLs.
 */
export function parseCoordinatesFromText(
  text: string
): { lat: number; lng: number; label?: string } | null {
  if (!text || typeof text !== 'string') return null;

  const trimmed = text.trim();

  // Pattern 1: @lat,lng (e.g. Google Maps URL path: @22.572646,88.363895,17z)
  const atMatch = /@(-?\d+\.\d+),(-?\d+\.\d+)/.exec(trimmed);
  if (atMatch) {
    const lat = parseFloat(atMatch[1]);
    const lng = parseFloat(atMatch[2]);
    if (isValidLatLng(lat, lng)) {
      return { lat, lng, label: 'Maps Pin' };
    }
  }

  // Pattern 2: URL query param (e.g. ?q=22.5726,88.3639 or ll=22.5726,88.3639 or destination=...)
  const queryParamMatch =
    /(?:[?&](?:q|query|ll|center|destination|origin|loc|saddr|daddr)=)(-?\d+\.\d+)(?:,|%2C|\+|\s+)(-?\d+\.\d+)/i.exec(
      trimmed
    );
  if (queryParamMatch) {
    const lat = parseFloat(queryParamMatch[1]);
    const lng = parseFloat(queryParamMatch[2]);
    if (isValidLatLng(lat, lng)) {
      return { lat, lng, label: 'Shared Location' };
    }
  }

  // Pattern 3: Explicit lat, lng with optional N/S/E/W (e.g. 22.5726° N, 88.3639° E or 22.5726, 88.3639)
  const rawCoordMatch =
    /(-?\d{1,2}(?:\.\d+)?)\s*[°º]?\s*([NS])?[\s,;]+(-?\d{1,3}(?:\.\d+)?)\s*[°º]?\s*([EW])?/i.exec(
      trimmed
    );
  if (rawCoordMatch) {
    let lat = parseFloat(rawCoordMatch[1]);
    const latDir = rawCoordMatch[2]?.toUpperCase();
    let lng = parseFloat(rawCoordMatch[3]);
    const lngDir = rawCoordMatch[4]?.toUpperCase();

    if (latDir === 'S') lat = -Math.abs(lat);
    if (lngDir === 'W') lng = -Math.abs(lng);

    if (isValidLatLng(lat, lng)) {
      return { lat, lng, label: 'Pasted Coordinates' };
    }
  }

  // Pattern 4: Fallback pair of decimal numbers in arbitrary text (e.g. "Near 22.5691 and 88.3654")
  const looseNumbersMatch =
    /(-?\d{1,2}\.\d{3,})\s*(?:,\s*|\s+)\s*(-?\d{1,3}\.\d{3,})/.exec(trimmed);
  if (looseNumbersMatch) {
    const lat = parseFloat(looseNumbersMatch[1]);
    const lng = parseFloat(looseNumbersMatch[2]);
    if (isValidLatLng(lat, lng)) {
      return { lat, lng, label: 'Detected Coordinates' };
    }
  }

  return null;
}

/**
 * Validates reasonable latitude & longitude bounds
 */
export function isValidLatLng(lat: number, lng: number): boolean {
  return (
    !isNaN(lat) &&
    !isNaN(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180 &&
    (lat !== 0 || lng !== 0)
  );
}

/**
 * Generates Google Maps walking directions deep link
 */
export function getGoogleMapsDirectionUrl(
  originLat: number,
  originLng: number,
  destLat: number,
  destLng: number,
  mode: 'walking' | 'driving' | 'transit' = 'walking'
): string {
  return `https://www.google.com/maps/dir/?api=1&origin=${originLat},${originLng}&destination=${destLat},${destLng}&travelmode=${mode}`;
}

/**
 * Generates Google Maps Search deep link
 */
export function getGoogleMapsSearchUrl(
  lat: number,
  lng: number,
  query?: string
): string {
  if (query) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}&query_place_id=&center=${lat},${lng}`;
  }
  return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
}

/**
 * Generates SOS Emergency Share URL message
 */
export function generateSosMessage(lat: number, lng: number): string {
  return `Emergency! My current Durga Puja location is: https://www.google.com/maps?q=${lat},${lng}`;
}

/**
 * Default central Kolkata coordinates (Esplanade / Park Street area)
 */
export const DEFAULT_KOLKATA_COORDS: LocationCoords = {
  lat: 22.5626,
  lng: 88.3518,
};
