// Caching layer for the Map Provider Service — explicitly a no-op for now.
//
// Geocoding results in particular are a natural cache target (the same
// addresses get looked up repeatedly), but caching is out of scope for
// this pass per spec. This file exists so the *shape* is in place: swap
// the body of get/set for a real store (in-memory LRU, Redis, a Postgres
// table) later without touching any provider or server-function code.

interface MapCache {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttlSeconds?: number): Promise<void>;
}

class NoopCache implements MapCache {
  async get<T>(_key: string): Promise<T | null> {
    return null;
  }
  async set<T>(_key: string, _value: T, _ttlSeconds?: number): Promise<void> {
    // intentionally does nothing
  }
}

export const mapCache: MapCache = new NoopCache();

/** Deterministic cache key builder, so a future real cache has consistent keys from day one. */
export function cacheKey(operation: string, params: Record<string, unknown>): string {
  const sorted = Object.keys(params)
    .sort()
    .map((k) => `${k}=${JSON.stringify(params[k])}`)
    .join("&");
  return `map:${operation}:${sorted}`;
}