import { Marker, Popup } from "react-leaflet";
import { LeafletMap } from "./leaflet-map";
import { merchantIcon, customerIcon, riderIcon } from "./map-icons";

interface OrderRouteMapProps {
  merchant: { lat: number; lng: number; label?: string };
  customer: { lat: number; lng: number; label?: string };
  /** Rider's current position, if assigned and en route. Omit before assignment. */
  rider?: { lat: number; lng: number } | null | undefined;
  /** Route geometry from calculateRoute(), e.g. rider -> merchant or merchant -> customer depending on delivery stage. */
  routePolyline?: [number, number][] | undefined;
  className?: string;
}

/**
 * Order-tracking map: merchant pickup pin, customer drop-off pin, and (once
 * assigned) the rider's live position, with the active leg's route drawn
 * as a polyline. Used on the customer order-tracking screen and the rider
 * app's active-job view.
 */
export function OrderRouteMap({ merchant, customer, rider, routePolyline, className = "h-72 w-full" }: OrderRouteMapProps) {
  const center = rider ? [rider.lat, rider.lng] : [merchant.lat, merchant.lng];

  return (
    <LeafletMap center={center as [number, number]} zoom={14} routePolyline={routePolyline} className={className}>
      <Marker position={[merchant.lat, merchant.lng]} icon={merchantIcon}>
        <Popup>{merchant.label ?? "Pickup"}</Popup>
      </Marker>
      <Marker position={[customer.lat, customer.lng]} icon={customerIcon}>
        <Popup>{customer.label ?? "Drop-off"}</Popup>
      </Marker>
      {rider && (
        <Marker position={[rider.lat, rider.lng]} icon={riderIcon}>
          <Popup>Rider</Popup>
        </Marker>
      )}
    </LeafletMap>
  );
}