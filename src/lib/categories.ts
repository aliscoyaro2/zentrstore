import catFood from "@/assets/cat-food.jpg";
import catWater from "@/assets/cat-water.jpg";
import catGas from "@/assets/cat-gas.jpg";
import catGrocery from "@/assets/cat-grocery.jpg";
import catMeat from "@/assets/cat-meat.jpg";
import catBakery from "@/assets/cat-bakery.jpg";

export type MerchantCategory =
  | "restaurant"
  | "home_kitchen"
  | "bakery"
  | "grocery"
  | "pharmacy"
  | "electronics"
  | "fashion"
  | "cosmetics"
  | "meat"
  | "hardware"
  | "water"
  | "gas"
  | "courier"
  | "office_supplies";

export type CategoryDef = {
  value: MerchantCategory;
  label: string;
  short: string;
  image?: string;
};

export const CATEGORIES: CategoryDef[] = [
  { value: "restaurant", label: "Restaurants", short: "Food", image: catFood },
  {
    value: "home_kitchen",
    label: "Home Kitchens / Local Vendors",
    short: "Home Kitchens",
    image: catFood,
  },
  { value: "bakery", label: "Bakeries", short: "Bakery", image: catBakery },
  { value: "grocery", label: "Grocery Stores / Supermarkets", short: "Grocery", image: catGrocery },
  { value: "pharmacy", label: "Pharmacies", short: "Pharmacy" },
  { value: "electronics", label: "Electronics", short: "Electronics" },
  { value: "fashion", label: "Fashion / Boutiques", short: "Fashion" },
  { value: "cosmetics", label: "Cosmetics", short: "Cosmetics" },
  { value: "meat", label: "Meat sellers", short: "Meat", image: catMeat },
  { value: "hardware", label: "Hardware / Building Materials", short: "Hardware" },
  { value: "water", label: "Water Suppliers", short: "Water", image: catWater },
  { value: "gas", label: "Gas Refill", short: "Gas", image: catGas },
  { value: "courier", label: "Parcel / Courier Delivery", short: "Parcel" },
  { value: "office_supplies", label: "Office Supplies", short: "Office" },
];

const byValue = new Map(CATEGORIES.map((c) => [c.value, c]));

export function categoryLabel(value: string): string {
  return byValue.get(value as MerchantCategory)?.short ?? value;
}

export function categoryImage(value: string): string | undefined {
  return byValue.get(value as MerchantCategory)?.image;
}
