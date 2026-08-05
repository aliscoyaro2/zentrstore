import { LocationPicker, type PickedLocation } from "./location-picker";
import { merchantIcon } from "./map-icons";

/** Location picker for a merchant setting their store's pickup location. */
export function MerchantLocationPicker({
  value,
  onChange,
}: {
  value?: PickedLocation | null;
  onChange: (location: PickedLocation) => void;
}) {
  return <LocationPicker value={value} onChange={onChange} icon={merchantIcon} placeholder="Search for your store's address" />;
}