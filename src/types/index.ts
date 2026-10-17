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

export interface Washroom {
  id: string | number;
  name: string;
  lat: number;
  lng: number;
  type: 'Mall Washroom' | 'Metro Station' | 'Public / Sulabh' | 'Petrol Pump' | string;
  distanceMeters?: number;
  distanceKm?: number;
  address?: string;
  fee?: string;
  wheelchairAccessible?: boolean;
  femaleFriendly?: boolean;
  hasDiaperChanging?: boolean;
}

export interface Hospital {
  id: string | number;
  name: string;
  lat: number;
  lng: number;
  type: 'Government Apex' | 'Private Multispeciality' | 'Cardiac Emergency' | 'General Hospital' | string;
  emergencyPhone: string;
  ambulancePhone?: string;
  distanceMeters?: number;
  distanceKm?: number;
  address?: string;
  facilities?: string[];
  is24x7: boolean;
}

export type AppTab = 'pandals' | 'map' | 'restaurants' | 'washrooms' | 'hospitals';
export type RadiusFilter = 500 | 1000 | 3000 | 5000 | 10000 | 0;
export type SortOption = 'distance' | 'alphabetical' | 'zone';
