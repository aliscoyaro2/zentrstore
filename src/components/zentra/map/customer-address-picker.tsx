import { LocationPicker, type PickedLocation } from "./location-picker";
import { customerIcon } from "./map-icons";

/** Location picker for a customer choosing/confirming a delivery address. */
export function CustomerAddressPicker({
  value,
  onChange,
}: {
  value?: PickedLocation | null;
  onChange: (location: PickedLocation) => void;
}) {
  return <LocationPicker value={value} onChange={onChange} icon={customerIcon} placeholder="Search for your delivery address" />;
}