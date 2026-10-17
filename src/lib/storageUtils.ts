/**
 * Universal Multi-Tier Storage Engine with Bulletproof Mobile Fallbacks
 * Supports iOS Safari (including Private Browsing & PWA mode), Android (Chrome, Samsung Internet),
 * and In-App WebViews (Instagram, WhatsApp, Facebook, LinkedIn, WeChat).
 *
 * Tier 1: LocalStorage (with active writability detection)
 * Tier 2: SessionStorage (fallback for strict quota/privacy policies)
 * Tier 3: Persistent Document Cookie (1-year lifetime, cross-session for iOS)
 * Tier 4: IndexedDB (asynchronous high-capacity persistent storage)
 * Tier 5: In-Memory Map (guarantees zero crashes even if all storage APIs are blocked)
 */

import { ActiveLocation } from '@/types';

const LOCATION_STORAGE_KEY = 'pujo_saved_active_location';
const FAVORITES_STORAGE_KEY = 'pujo_favorite_pandals';
const PANDALS_CACHE_KEY = 'pujo_offline_pandals_cache';

// In-Memory fallback map for sandboxed / private browsing environments
const memoryStore = new Map<string, string>();

/**
 * Checks if localStorage is truly available and writable
 */
export function isLocalStorageAvailable(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const testKey = '__pujo_storage_test__';
    window.localStorage.setItem(testKey, '1');
    window.localStorage.removeItem(testKey);
    return true;
  } catch {
    return false;
  }
}

/**
 * Checks if sessionStorage is truly available and writable
 */
export function isSessionStorageAvailable(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const testKey = '__pujo_session_test__';
    window.sessionStorage.setItem(testKey, '1');
    window.sessionStorage.removeItem(testKey);
    return true;
  } catch {
    return false;
  }
}

/**
 * Sets a persistent cookie (fallback for iOS Safari when localStorage is restricted)
 */
export function setCookie(name: string, value: string, days = 365): void {
  if (typeof document === 'undefined') return;
  try {
    const maxAge = days * 24 * 60 * 60;
    document.cookie = `${encodeURIComponent(name)}=${encodeURIComponent(value)}; max-age=${maxAge}; path=/; SameSite=Lax`;
  } catch {
    // Cookie disabled or blocked
  }
}

/**
 * Gets a cookie by name
 */
export function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  try {
    const cookies = document.cookie ? document.cookie.split('; ') : [];
    for (const c of cookies) {
      const [k, v] = c.split('=');
      if (decodeURIComponent(k.trim()) === name) {
        return decodeURIComponent(v || '');
      }
    }
  } catch {
    // Ignore cookie read errors
  }
  return null;
}

/**
 * Removes a cookie
 */
export function removeCookie(name: string): void {
  if (typeof document === 'undefined') return;
  try {
    document.cookie = `${encodeURIComponent(name)}=; max-age=0; path=/; SameSite=Lax`;
  } catch {
    // Ignore
  }
}

/**
 * Universal Synchronous Storage GET
 * Checks LocalStorage -> SessionStorage -> Cookie -> In-Memory Fallback
 */
export function universalStorageGet(key: string): string | null {
  // 1. Try LocalStorage
  if (isLocalStorageAvailable()) {
    try {
      const val = window.localStorage.getItem(key);
      if (val !== null) return val;
    } catch {
      // Ignore
    }
  }

  // 2. Try SessionStorage
  if (isSessionStorageAvailable()) {
    try {
      const val = window.sessionStorage.getItem(key);
      if (val !== null) return val;
    } catch {
      // Ignore
    }
  }

  // 3. Try Cookie
  const cookieVal = getCookie(key);
  if (cookieVal !== null) return cookieVal;

  // 4. Try In-Memory Store
  return memoryStore.get(key) || null;
}

/**
 * Universal Synchronous Storage SET
 * Writes to LocalStorage, SessionStorage, Cookie, and In-Memory Fallback
 */
export function universalStorageSet(key: string, value: string): void {
  // Always update in-memory store
  memoryStore.set(key, value);

  // Try LocalStorage
  if (isLocalStorageAvailable()) {
    try {
      window.localStorage.setItem(key, value);
    } catch {
      // Quota exceeded or restricted
    }
  }

  // Try SessionStorage
  if (isSessionStorageAvailable()) {
    try {
      window.sessionStorage.setItem(key, value);
    } catch {
      // Restricted
    }
  }

  // Always write 365-day Cookie fallback for mobile longevity
  setCookie(key, value, 365);
}

/**
 * Universal Synchronous Storage REMOVE
 */
export function universalStorageRemove(key: string): void {
  memoryStore.delete(key);

  if (isLocalStorageAvailable()) {
    try {
      window.localStorage.removeItem(key);
    } catch {
      // Ignore
    }
  }

  if (isSessionStorageAvailable()) {
    try {
      window.sessionStorage.removeItem(key);
    } catch {
      // Ignore
    }
  }

  removeCookie(key);
}

/* ====================================================================
 * IndexedDB Async Fallback Engine (for high-capacity & offline storage)
 * ==================================================================== */

const IDB_NAME = 'pujo_parikrama_db';
const IDB_STORE = 'app_state';
const IDB_VERSION = 1;

function openIdb(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      return resolve(null);
    }

    try {
      const request = window.indexedDB.open(IDB_NAME, IDB_VERSION);

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(IDB_STORE)) {
          db.createObjectStore(IDB_STORE);
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export async function idbSet(key: string, value: unknown): Promise<void> {
  try {
    const db = await openIdb();
    if (!db) return;
    const tx = db.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).put(value, key);
  } catch {
    // Ignore IndexedDB write failure in restricted environments
  }
}

export async function idbGet<T>(key: string): Promise<T | null> {
  try {
    const db = await openIdb();
    if (!db) return null;
    return new Promise((resolve) => {
      const tx = db.transaction(IDB_STORE, 'readonly');
      const req = tx.objectStore(IDB_STORE).get(key);
      req.onsuccess = () => resolve((req.result as T) ?? null);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

/* ====================================================================
 * Domain-Specific Storage Helpers
 * ==================================================================== */

/**
 * Safely persists active location across all iOS, Android, and WebViews
 */
export function persistActiveLocation(location: ActiveLocation): void {
  if (!location || typeof location.lat !== 'number' || typeof location.lng !== 'number') return;

  const serialized = JSON.stringify(location);
  universalStorageSet(LOCATION_STORAGE_KEY, serialized);

  // Also store in IndexedDB asynchronously for robust offline resilience
  idbSet(LOCATION_STORAGE_KEY, location).catch(() => {});
}

/**
 * Safely retrieves previously saved active location
 */
export function retrieveActiveLocation(): ActiveLocation | null {
  const raw = universalStorageGet(LOCATION_STORAGE_KEY);
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (
        parsed &&
        typeof parsed.lat === 'number' &&
        !isNaN(parsed.lat) &&
        typeof parsed.lng === 'number' &&
        !isNaN(parsed.lng)
      ) {
        return parsed as ActiveLocation;
      }
    } catch {
      // Ignore JSON parse error
    }
  }
  return null;
}

/**
 * Asynchronously retrieves active location from IndexedDB if memory/sync storage was cleared
 */
export async function retrieveActiveLocationAsync(): Promise<ActiveLocation | null> {
  const sync = retrieveActiveLocation();
  if (sync) return sync;
  return await idbGet<ActiveLocation>(LOCATION_STORAGE_KEY);
}

/**
 * Persists favorite pandals list
 */
export function persistFavorites(ids: string[]): void {
  const serialized = JSON.stringify(ids);
  universalStorageSet(FAVORITES_STORAGE_KEY, serialized);
  idbSet(FAVORITES_STORAGE_KEY, ids).catch(() => {});
}

/**
 * Retrieves favorite pandals list
 */
export function retrieveFavorites(): string[] {
  const raw = universalStorageGet(FAVORITES_STORAGE_KEY);
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      // Ignore
    }
  }
  return [];
}

/**
 * Caches loaded pandals for 100% offline access in crowded Kolkata queues
 */
export function cacheOfflinePandals(pandals: unknown[]): void {
  if (!Array.isArray(pandals) || pandals.length === 0) return;
  idbSet(PANDALS_CACHE_KEY, pandals).catch(() => {});
}

/**
 * Retrieves cached offline pandals from IndexedDB
 */
export async function retrieveOfflinePandals<T>(): Promise<T[] | null> {
  return await idbGet<T[]>(PANDALS_CACHE_KEY);
}
