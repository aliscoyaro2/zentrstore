import { useCallback, useState } from "react";

interface CurrentLocationState {
  loading: boolean;
  error: string | null;
}

/**
 * One-shot "use my current location" for address/location pickers
 * (customer delivery address, merchant location picker). Uses the
 * browser's native geolocation directly — no map provider involved.
 *
 * This is deliberately separate from useRiderLocationTracking, which is a
 * continuous watch that writes to the DB. This hook just answers "where am
 * I right now" once, on demand, for a UI action like tapping a locate
 * button.
 */
export function useCurrentLocation() {
  const [state, setState] = useState<CurrentLocationState>({ loading: false, error: null });

  const locate = useCallback((): Promise<{ lat: number; lng: number } | null> => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setState({ loading: false, error: "This device doesn't support location detection." });
      return Promise.resolve(null);
    }

    setState({ loading: true, error: null });

    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setState({ loading: false, error: null });
          resolve({ lat: position.coords.latitude, lng: position.coords.longitude });
        },
        (geoError) => {
          const message =
            geoError.code === geoError.PERMISSION_DENIED
              ? "Location permission denied. You can still search for your address."
              : "Couldn't detect your location right now.";
          setState({ loading: false, error: message });
          resolve(null);
        },
        { enableHighAccuracy: true, timeout: 15_000, maximumAge: 30_000 },
      );
    });
  }, []);

  return { locate, ...state };
}