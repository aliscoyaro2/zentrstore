import { useEffect, useRef } from "react";
import { MapContainer, TileLayer, Polyline, useMap } from "react-leaflet";
import type { LatLngExpression } from "leaflet";
import "leaflet/dist/leaflet.css";
import type { ReactNode } from "react";

// Maiduguri, Borno State — sensible default center when no location is
// known yet (e.g. before a customer has granted geolocation permission).
export const MAIDUGURI_CENTER: LatLngExpression = [11.8464, 13.1607];

const DEFAULT_ZOOM = 14;

interface LeafletMapProps {
  center?: LatLngExpression;
  zoom?: number;
  /** Markers, popups, etc. — anything from react-leaflet or this map/ folder. */
  children?: ReactNode;
  /** Route geometry as [lat, lng] pairs, from MapProviderService.route(). */
  routePolyline?: [number, number][];
  className?: string;
  /** Fired with the map's current center whenever the user finishes panning/zooming. */
  onMoveEnd?: (center: { lat: number; lng: number }) => void;
}

/**
 * Base map surface for every map in Zentra (customer, merchant, rider,
 * admin). Renders OpenStreetMap tiles via Leaflet — no API key needed for
 * this part; only geocoding/routing (server-side) needs GraphHopper.
 */
export function LeafletMap({
  center = MAIDUGURI_CENTER,
  zoom = DEFAULT_ZOOM,
  children,
  routePolyline,
  className = "h-64 w-full",
  onMoveEnd,
}: LeafletMapProps) {
  return (
    <div className={`${className} overflow-hidden rounded-2xl border border-border`}>
      <MapContainer
        center={center}
        zoom={zoom}
        scrollWheelZoom
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {routePolyline && routePolyline.length > 1 && (
          <Polyline positions={routePolyline} pathOptions={{ color: "oklch(0.6 0.1 183)", weight: 4, opacity: 0.85 }} />
        )}
        {children}
        <RecenterOnChange center={center} />
        {onMoveEnd && <MoveEndListener onMoveEnd={onMoveEnd} />}
      </MapContainer>
    </div>
  );
}

/** Keeps the map centered when `center` changes programmatically (e.g. rider location updates). */
function RecenterOnChange({ center }: { center: LatLngExpression }) {
  const map = useMap();
  const lastCenter = useRef<LatLngExpression>(center);

  useEffect(() => {
    if (JSON.stringify(lastCenter.current) !== JSON.stringify(center)) {
      lastCenter.current = center;
      map.setView(center);
    }
  }, [center, map]);

  return null;
}

function MoveEndListener({ onMoveEnd }: { onMoveEnd: (center: { lat: number; lng: number }) => void }) {
  const map = useMap();

  useEffect(() => {
    const handler = () => {
      const c = map.getCenter();
      onMoveEnd({ lat: c.lat, lng: c.lng });
    };
    map.on("moveend", handler);
    return () => {
      map.off("moveend", handler);
    };
  }, [map, onMoveEnd]);

  return null;
}
