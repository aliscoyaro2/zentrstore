import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

// How often we're willing to write a new position to the DB, even if the
// browser reports movement more often than this. Keeps writes cheap and
// avoids hammering the table while a rider is stationary waiting for a job.
const MIN_WRITE_INTERVAL_MS = 15_000;

/**
 * While `active` is true, watches the rider's GPS position using the
 * browser's built-in geolocation (no external API, no cost) and writes it
 * into riders.current_lat / current_lng / last_location_at, throttled to
 * at most once every MIN_WRITE_INTERVAL_MS.
 *
 * This does NOT show a map or compute routes — it only keeps the rider's
 * live position honest in the database. Turning that into a visual map or
 * turn-by-turn navigation is a separate piece that needs a maps API
 * (Google Maps / OpenStreetMap) once one is chosen.
 *
 * Silently does nothing if the browser has no geolocation support or the
 * rider has denied permission — callers can surface a warning via the
 * returned `error` if they want to.
 */
export function useRiderLocationTracking(riderId: string | undefined, active: boolean) {
  const lastWriteRef = useRef(0);
  const errorRef = useRef<string | null>(null);

  useEffect(() => {
    if (!active || !riderId) return;
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      errorRef.current = "This device doesn't support location sharing.";
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const now = Date.now();
        if (now - lastWriteRef.current < MIN_WRITE_INTERVAL_MS) return;
        lastWriteRef.current = now;

        supabase
          .from("riders")
          .update({
            current_lat: position.coords.latitude,
            current_lng: position.coords.longitude,
            last_location_at: new Date().toISOString(),
          })
          .eq("id", riderId)
          .then(({ error }) => {
            if (error) errorRef.current = error.message;
          });
      },
      (geoError) => {
        errorRef.current =
          geoError.code === geoError.PERMISSION_DENIED
            ? "Location permission denied — turn it on to receive nearby jobs."
            : "Couldn't get your location right now.";
      },
      { enableHighAccuracy: true, maximumAge: 10_000, timeout: 20_000 },
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [riderId, active]);
}
