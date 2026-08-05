import { MapProviderError } from "./types";
import type { LatLng } from "./types";

/**
 * CoordinateValidator — the one place that decides whether a lat/lng pair
 * is well-formed before it's sent to a provider or written to the DB.
 *
 * Kept intentionally tiny: structural validity only (range + finite
 * numbers). It deliberately does NOT check "is this point inside
 * Maiduguri" — that's a product/zone concern, not a coordinate-validity
 * concern, and belongs in the zones module if it's ever needed.
 */
export function isValidLatLng(point: unknown): point is LatLng {
  if (typeof point !== "object" || point === null) return false;
  const { lat, lng } = point as Record<string, unknown>;
  return (
    typeof lat === "number" &&
    typeof lng === "number" &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}

export function assertValidLatLng(point: unknown, label = "coordinate"): asserts point is LatLng {
  if (!isValidLatLng(point)) {
    throw new MapProviderError(`Invalid ${label}: expected { lat, lng } within valid ranges`, "INVALID_COORDINATES");
  }
}

export function assertValidRoute(points: unknown[]): asserts points is LatLng[] {
  if (!Array.isArray(points) || points.length < 2) {
    throw new MapProviderError("A route needs at least two points", "INVALID_COORDINATES");
  }
  points.forEach((p, i) => assertValidLatLng(p, `route point ${i}`));
}