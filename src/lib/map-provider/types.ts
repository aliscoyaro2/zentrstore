// Provider-agnostic types for the Map Provider Service.
//
// Every provider implementation (GraphHopperProvider today, possibly
// GoogleMapsProvider / MapboxProvider / HereProvider later) normalizes its
// raw API response into these shapes. Nothing outside this module should
// ever see a raw GraphHopper (or any other provider's) response type.

export interface LatLng {
  lat: number;
  lng: number;
}

export interface GeocodeResult {
  formatted: string;
  lat: number;
  lng: number;
  /** Provider-assigned confidence/relevance, 0-1 where known. */
  confidence?: number;
  /** Raw address components, when the provider exposes them. */
  components?: {
    houseNumber?: string | undefined;
    street?: string | undefined;
    city?: string | undefined;
    state?: string | undefined;
    country?: string | undefined;
    postcode?: string | undefined;
  };
}

export interface ReverseGeocodeResult {
  formatted: string;
  lat: number;
  lng: number;
  components?: GeocodeResult["components"];
}

export interface RouteResult {
  /** Total distance in meters. */
  distanceMeters: number;
  /** Total travel time in seconds. */
  durationSeconds: number;
  /** Route geometry as [lat, lng] pairs, decoded and ready for Leaflet's Polyline. */
  polyline: [number, number][];
}

export interface DistanceResult {
  distanceMeters: number;
  durationSeconds: number;
}

export interface EtaResult {
  /** Seconds from now until arrival. */
  etaSeconds: number;
  /** Convenience ISO timestamp of estimated arrival. */
  arrivesAt: string;
}

/**
 * Contract every map provider (GraphHopper today, others later) must
 * implement. MapProviderService depends only on this interface, never on a
 * concrete provider — that's what makes swapping providers a config change
 * instead of a rewrite.
 */
export interface MapProvider {
  geocode(query: string, opts?: { limit?: number; near?: LatLng }): Promise<GeocodeResult[]>;
  reverseGeocode(point: LatLng): Promise<ReverseGeocodeResult>;
  route(points: LatLng[]): Promise<RouteResult>;
  distance(from: LatLng, to: LatLng): Promise<DistanceResult>;
}

export class MapProviderError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "INVALID_COORDINATES"
      | "PROVIDER_ERROR"
      | "RATE_LIMITED"
      | "NOT_FOUND"
      | "NETWORK_ERROR"
      | "CONFIG_ERROR",
    public override readonly cause?: unknown,
  ) {
    super(message);
    this.name = "MapProviderError";
  }
}
