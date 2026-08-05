import { useEffect, useRef, useState } from "react";
import { calculateRoute } from "@/lib/routing.functions";

interface Point {
  lat: number;
  lng: number;
}

const ROUTE_REFRESH_MS = 20_000; // recompute periodically as the rider moves, not on every GPS write

/**
 * Given two points that may change over time (typically: rider's live
 * position -> the next stop, merchant or customer), keeps a route polyline
 * + distance/duration in sync without recalculating on every render or
 * every single GPS write.
 *
 * This hook does NOT subscribe to Supabase itself — pass in `from` from
 * whatever live-position source the screen already has (e.g. a Supabase
 * realtime subscription on the riders table, or a polling useQuery). That
 * keeps this hook focused only on the GraphHopper side of things.
 */
export function useOrderRoute(from: Point | null | undefined, to: Point | null | undefined) {
  const [polyline, setPolyline] = useState<[number, number][] | null>(null);
  const [distanceMeters, setDistanceMeters] = useState<number | null>(null);
  const [durationSeconds, setDurationSeconds] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const lastFetch = useRef(0);

  useEffect(() => {
    if (!from || !to) return;

    const now = Date.now();
    if (now - lastFetch.current < ROUTE_REFRESH_MS) return;
    lastFetch.current = now;

    let cancelled = false;
    calculateRoute({ data: { points: [from, to] } })
      .then((route) => {
        if (cancelled) return;
        setPolyline(route.polyline);
        setDistanceMeters(route.distanceMeters);
        setDurationSeconds(route.durationSeconds);
        setError(null);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Couldn't calculate the route");
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from?.lat, from?.lng, to?.lat, to?.lng]);

  return { polyline, distanceMeters, durationSeconds, error };
}