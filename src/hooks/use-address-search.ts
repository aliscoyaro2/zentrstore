import { useEffect, useRef, useState } from "react";
import { searchAddress } from "@/lib/geocoding.functions";
import type { GeocodeResult } from "@/lib/map-provider/types";

const DEBOUNCE_MS = 400;

/**
 * Debounced wrapper around the searchAddress server function, for use in
 * an address-picker text input (customer address, merchant location).
 */
export function useAddressSearch(query: string, near?: { lat: number; lng: number }) {
  const [results, setResults] = useState<GeocodeResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setError(null);
      return;
    }

    const currentRequest = ++requestId.current;
    setLoading(true);

    const timer = setTimeout(async () => {
      try {
        const { results: hits } = await searchAddress({ data: { query: trimmed, near } });
        if (currentRequest === requestId.current) {
          setResults(hits);
          setError(null);
        }
      } catch (err) {
        if (currentRequest === requestId.current) {
          setError(err instanceof Error ? err.message : "Address search failed");
          setResults([]);
        }
      } finally {
        if (currentRequest === requestId.current) setLoading(false);
      }
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, near?.lat, near?.lng]);

  return { results, loading, error };
}