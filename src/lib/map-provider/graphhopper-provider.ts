import type {
  DistanceResult,
  EtaResult,
  GeocodeResult,
  LatLng,
  MapProvider,
  ReverseGeocodeResult,
  RouteResult,
} from "./types";
import { MapProviderError } from "./types";
import { assertValidLatLng, assertValidRoute } from "./coordinate-validator";
import { withRetry, httpStatusToErrorCode, normalizeError } from "./map-error-handler";

const GEOCODE_URL = "https://graphhopper.com/api/1/geocode";
const ROUTE_URL = "https://graphhopper.com/api/1/route";

interface GraphHopperGeocodeHit {
  point: { lat: number; lng: number };
  name?: string;
  street?: string;
  housenumber?: string;
  city?: string;
  state?: string;
  country?: string;
  postcode?: string;
  osm_value?: string;
}

interface GraphHopperGeocodeResponse {
  hits: GraphHopperGeocodeHit[];
}

interface GraphHopperRoutePath {
  distance: number; // meters
  time: number; // ms
  points: { coordinates: [number, number][] }; // [lng, lat][] — GeoJSON order
}

interface GraphHopperRouteResponse {
  paths: GraphHopperRoutePath[];
}

/**
 * The only file in the codebase that knows GraphHopper's request/response
 * shapes. Everything it returns is normalized into the provider-agnostic
 * types in ./types before leaving this module — callers of
 * MapProviderService never see a raw GraphHopper response.
 */
export class GraphHopperProvider implements MapProvider {
  constructor(private readonly apiKey: string) {
    if (!apiKey) {
      throw new MapProviderError(
        "GraphHopper API key is not configured. Set GRAPHHOPPER_API_KEY on the server.",
        "CONFIG_ERROR",
      );
    }
  }

  async geocode(query: string, opts?: { limit?: number; near?: LatLng }): Promise<GeocodeResult[]> {
    if (!query || !query.trim()) {
      throw new MapProviderError("Geocode query must not be empty", "INVALID_COORDINATES");
    }

    const params = new URLSearchParams({
      q: query,
      limit: String(opts?.limit ?? 5),
      key: this.apiKey,
    });
    if (opts?.near) {
      assertValidLatLng(opts.near, "near");
      params.set("point", `${opts.near.lat},${opts.near.lng}`);
    }

    return withRetry(async () => {
      const res = await this.fetchJson<GraphHopperGeocodeResponse>(`${GEOCODE_URL}?${params.toString()}`);
      return res.hits.map((hit) => this.normalizeGeocodeHit(hit));
    });
  }

  async reverseGeocode(point: LatLng): Promise<ReverseGeocodeResult> {
    assertValidLatLng(point, "point");

    const params = new URLSearchParams({
      reverse: "true",
      point: `${point.lat},${point.lng}`,
      key: this.apiKey,
    });

    return withRetry(async () => {
      const res = await this.fetchJson<GraphHopperGeocodeResponse>(`${GEOCODE_URL}?${params.toString()}`);
      const hit = res.hits[0];
      if (!hit) {
        throw new MapProviderError("No address found for this location", "NOT_FOUND");
      }
      return this.normalizeGeocodeHit(hit);
    });
  }

  async route(points: LatLng[]): Promise<RouteResult> {
    assertValidRoute(points);

    const params = new URLSearchParams({
      vehicle: "car",
      points_encoded: "false",
      key: this.apiKey,
    });
    for (const p of points) {
      params.append("point", `${p.lat},${p.lng}`);
    }

    return withRetry(async () => {
      const res = await this.fetchJson<GraphHopperRouteResponse>(`${ROUTE_URL}?${params.toString()}`);
      const path = res.paths[0];
      if (!path) {
        throw new MapProviderError("No route found between these points", "NOT_FOUND");
      }
      return {
        distanceMeters: path.distance,
        durationSeconds: Math.round(path.time / 1000),
        // GraphHopper returns GeoJSON [lng, lat] — flip to [lat, lng] for Leaflet.
        polyline: path.points.coordinates.map(([lng, lat]) => [lat, lng]),
      };
    });
  }

  async distance(from: LatLng, to: LatLng): Promise<DistanceResult> {
    const { distanceMeters, durationSeconds } = await this.route([from, to]);
    return { distanceMeters, durationSeconds };
  }

  /** Convenience built on route(): ETA from "now" between two points. */
  async eta(from: LatLng, to: LatLng): Promise<EtaResult> {
    const { durationSeconds } = await this.distance(from, to);
    const arrivesAt = new Date(Date.now() + durationSeconds * 1000).toISOString();
    return { etaSeconds: durationSeconds, arrivesAt };
  }

  private normalizeGeocodeHit(hit: GraphHopperGeocodeHit): GeocodeResult {
    const parts = [
      hit.housenumber && hit.street ? `${hit.housenumber} ${hit.street}` : hit.street,
      hit.city,
      hit.state,
      hit.country,
    ].filter(Boolean);

    return {
      formatted: hit.name && hit.name.trim() ? hit.name : parts.join(", "),
      lat: hit.point.lat,
      lng: hit.point.lng,
      components: {
        houseNumber: hit.housenumber,
        street: hit.street,
        city: hit.city,
        state: hit.state,
        country: hit.country,
        postcode: hit.postcode,
      },
    };
  }

  private async fetchJson<T>(url: string): Promise<T> {
    let res: Response;
    try {
      res = await fetch(url);
    } catch (err) {
      throw new MapProviderError("Network error contacting GraphHopper", "NETWORK_ERROR", err);
    }

    if (!res.ok) {
      const code = httpStatusToErrorCode(res.status);
      let detail = "";
      try {
        detail = await res.text();
      } catch {
        // ignore — best-effort detail only
      }
      throw new MapProviderError(`GraphHopper request failed (${res.status})${detail ? `: ${detail}` : ""}`, code);
    }

    try {
      return (await res.json()) as T;
    } catch (err) {
      throw normalizeError(err);
    }
  }
}