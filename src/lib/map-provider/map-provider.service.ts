// MapProviderService — the single source of truth for all mapping
// operations in Zentra.
//
// SERVER-ONLY. This module reads GRAPHHOPPER_API_KEY from process.env and
// must only ever be imported from TanStack Start server functions
// (src/lib/*.functions.ts) or other server-only code — never from a
// component or anything that ships to the client bundle. TanStack Start's
// createServerFn boundary is what actually enforces this at build time;
// this file just never touches anything client-safe (no "use client",
// no default export consumed by a route component).
//
// No other module should import GraphHopperProvider directly or call
// GraphHopper's API. Everything — dispatch, orders, customer app, rider
// app, merchant app — goes through the functions exported from this file
// (or, in practice, through the thinner *.functions.ts wrappers in
// geocoding.functions.ts / routing.functions.ts / eta.functions.ts).
//
// Swapping providers later (Google Maps, Mapbox, HERE) means writing a new
// class that implements MapProvider and changing the one line below that
// constructs `provider`. Nothing else in the app changes.

import { GraphHopperProvider } from "./graphhopper-provider";
import { withUsageLogging } from "./usage-logger";
import { mapCache, cacheKey } from "./cache";
import { normalizeError } from "./map-error-handler";
import type { DistanceResult, EtaResult, GeocodeResult, LatLng, ReverseGeocodeResult, RouteResult } from "./types";

let cachedProvider: GraphHopperProvider | null = null;

/** Lazily constructs the provider so a missing API key only throws when mapping is actually used, not at module load / import time. */
function getProvider(): GraphHopperProvider {
  if (!cachedProvider) {
    cachedProvider = new GraphHopperProvider(process.env['GRAPHHOPPER_API_KEY'] ?? "");
  }
  return cachedProvider;
}

export const MapProviderService = {
  async geocode(query: string, opts?: { limit?: number; near?: LatLng }): Promise<GeocodeResult[]> {
    const key = cacheKey("geocode", { query, ...opts });
    const cached = await mapCache.get<GeocodeResult[]>(key);
    if (cached) return cached;

    try {
      const result = await withUsageLogging("geocode", () => getProvider().geocode(query, opts));
      await mapCache.set(key, result);
      return result;
    } catch (err) {
      throw normalizeError(err);
    }
  },

  async reverseGeocode(point: LatLng): Promise<ReverseGeocodeResult> {
    const key = cacheKey("reverseGeocode", { lat: point.lat, lng: point.lng });
    const cached = await mapCache.get<ReverseGeocodeResult>(key);
    if (cached) return cached;

    try {
      const result = await withUsageLogging("reverseGeocode", () => getProvider().reverseGeocode(point));
      await mapCache.set(key, result);
      return result;
    } catch (err) {
      throw normalizeError(err);
    }
  },

  async route(points: LatLng[]): Promise<RouteResult> {
    try {
      return await withUsageLogging("route", () => getProvider().route(points));
    } catch (err) {
      throw normalizeError(err);
    }
  },

  async distance(from: LatLng, to: LatLng): Promise<DistanceResult> {
    try {
      return await withUsageLogging("distance", () => getProvider().distance(from, to));
    } catch (err) {
      throw normalizeError(err);
    }
  },

  async eta(from: LatLng, to: LatLng): Promise<EtaResult> {
    try {
      return await withUsageLogging("distance", () => getProvider().eta(from, to));
    } catch (err) {
      throw normalizeError(err);
    }
  },
};