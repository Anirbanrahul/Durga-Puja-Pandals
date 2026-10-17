export interface LocationCoords {
  lat: number;
  lng: number;
}

export type LocationSource =
  | 'gps'
  | 'search'
  | 'paste'
  | 'share'
  | 'pandal'
  | 'manual'
  | 'default';

export interface ActiveLocation {
  lat: number;
  lng: number;
  address: string;
  source: LocationSource;
  accuracy?: number;
  timestamp?: number;
}

export interface Pandal {
  id: string;
  name: string;
  zone: string;
  description: string;
  lat: number;
  lng: number;
  distanceMeters?: number;
  distanceKm?: number;
  nearestMetro?: string;
  famousFor?: string;
  category?: 'Heritage' | 'Theme' | 'Crowd Favorite' | 'Traditional' | string;
  address?: string;
  rawProperties?: Record<string, unknown>;
}

export interface Restaurant {
  id: string | number;
  name: string;
  lat: number;
  lng: number;
  cuisine?: string;
  amenity?: string;
  distanceMeters?: number;
  distanceKm?: number;
  address?: string;
  openingHours?: string;
  phone?: string;
  website?: string;
}

export interface EmergencyContact {
  id: string;
  name: string;
  number: string;
  category: 'police' | 'medical' | 'fire' | 'women_child' | 'helpline';
  description: string;
  badge?: string;
  urgent?: boolean;
}

export type RadiusFilter = 500 | 1000 | 3000 | 5000 | 10000 | 0;
export type SortOption = 'distance' | 'alphabetical' | 'zone';
