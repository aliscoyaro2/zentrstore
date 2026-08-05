import { useState } from "react";
import { Marker, useMapEvents } from "react-leaflet";
import { LocateFixed, Search, Loader2 } from "lucide-react";
import { LeafletMap, MAIDUGURI_CENTER } from "./leaflet-map";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useAddressSearch } from "@/hooks/use-address-search";
import { useCurrentLocation } from "@/hooks/use-current-location";
import { reverseGeocodeLocation } from "@/lib/geocoding.functions";
import type { Icon, DivIcon } from "leaflet";

export interface PickedLocation {
  lat: number;
  lng: number;
  formatted: string;
}

interface LocationPickerProps {
  value?: PickedLocation | null;
  onChange: (location: PickedLocation) => void;
  icon: Icon | DivIcon;
  placeholder?: string;
  className?: string;
}

/**
 * Shared location-picking UI: search box with live results, a map that
 * shows the current selection and can be tapped to drop a pin, and a
 * "use my current location" button. Used by both the merchant location
 * picker and the customer delivery address picker — they only differ in
 * marker color and copy.
 */
export function LocationPicker({ value, onChange, icon, placeholder = "Search for an address", className }: LocationPickerProps) {
  const [query, setQuery] = useState("");
  const [showResults, setShowResults] = useState(false);
  const { results, loading: searching } = useAddressSearch(query, value ?? undefined);
  const { locate, loading: locating, error: locateError } = useCurrentLocation();

  async function handleMapClick(point: { lat: number; lng: number }) {
    try {
      const address = await reverseGeocodeLocation({ data: point });
      onChange({ lat: point.lat, lng: point.lng, formatted: address.formatted });
      setQuery(address.formatted);
    } catch {
      // Reverse geocoding failed (e.g. remote spot with no address data) —
      // still let the pin drop with coordinates only, rather than blocking selection.
      onChange({ lat: point.lat, lng: point.lng, formatted: `${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}` });
    }
  }

  async function handleUseCurrentLocation() {
    const point = await locate();
    if (point) await handleMapClick(point);
  }

  return (
    <div className={className}>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setShowResults(true);
          }}
          onFocus={() => setShowResults(true)}
          placeholder={placeholder}
          className="pl-9 pr-10"
        />
        {searching && <Loader2 className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />}

        {showResults && results.length > 0 && (
          <div className="absolute z-[1000] mt-1 w-full overflow-hidden rounded-xl border border-border bg-card shadow-md">
            {results.map((r, i) => (
              <button
                key={`${r.lat}-${r.lng}-${i}`}
                type="button"
                className="block w-full px-3 py-2 text-left text-sm hover:bg-secondary"
                onClick={() => {
                  onChange({ lat: r.lat, lng: r.lng, formatted: r.formatted });
                  setQuery(r.formatted);
                  setShowResults(false);
                }}
              >
                {r.formatted}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="mt-2 flex items-center justify-between">
        <Button type="button" variant="ghost" size="sm" onClick={handleUseCurrentLocation} disabled={locating} className="gap-1.5 text-xs">
          {locating ? <Loader2 className="size-3.5 animate-spin" /> : <LocateFixed className="size-3.5" />}
          Use my current location
        </Button>
      </div>
      {locateError && <p className="mt-1 text-xs text-destructive">{locateError}</p>}

      <div className="mt-3">
        <LeafletMap center={value ? [value.lat, value.lng] : MAIDUGURI_CENTER} className="h-56 w-full">
          <ClickToPlacePin onPlace={handleMapClick} />
          {value && <Marker position={[value.lat, value.lng]} icon={icon} />}
        </LeafletMap>
      </div>
      <p className="mt-1.5 text-xs text-muted-foreground">Tap the map to fine-tune the pin.</p>
    </div>
  );
}

function ClickToPlacePin({ onPlace }: { onPlace: (point: { lat: number; lng: number }) => void }) {
  useMapEvents({
    click(e) {
      onPlace({ lat: e.latlng.lat, lng: e.latlng.lng });
    },
  });
  return null;
}