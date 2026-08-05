// Geographic Hierarchy Service — frontend query helpers.
//
// Wraps the countries → states → cities → zones → areas → streets → addresses
// chain described in the Module 1 PRD. Import these instead of querying the
// hierarchy tables directly from route components, so the query shape lives
// in one place.
//
// NOTE: `zones` keeps its existing dispatch/pricing columns (delivery_fee_kobo,
// max_radius_km, estimated_minutes, minimum_order_kobo, is_active, lat/lng) —
// those are untouched by this module. This file only adds the hierarchy-aware
// reads/writes described in the PRD (city_id, polygon_coordinates, etc.).

import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert } from "@/integrations/supabase/types";

export type Country = Tables<"countries">;
export type StateRow = Tables<"states">;
export type City = Tables<"cities">;
export type Zone = Tables<"zones">;
export type Area = Tables<"areas">;
export type Street = Tables<"streets">;
export type AddressRow = Tables<"addresses">;

// ---------------------------------------------------------------------------
// Reads — each scoped to ACTIVE rows only, matching the PRD's rule that only
// ACTIVE locations are available for customers.
// ---------------------------------------------------------------------------

export async function listCountries() {
  const { data, error } = await supabase
    .from("countries")
    .select("*")
    .eq("status", "active")
    .order("name");
  if (error) throw error;
  return data;
}

export async function listStates(countryId: string) {
  const { data, error } = await supabase
    .from("states")
    .select("*")
    .eq("country_id", countryId)
    .eq("status", "active")
    .order("name");
  if (error) throw error;
  return data;
}

export async function listCities(stateId: string) {
  const { data, error } = await supabase
    .from("cities")
    .select("*")
    .eq("state_id", stateId)
    .eq("status", "active")
    .order("name");
  if (error) throw error;
  return data;
}

export async function listZonesForCity(cityId: string) {
  const { data, error } = await supabase
    .from("zones")
    .select("*")
    .eq("city_id", cityId)
    .eq("status", "active")
    .order("name");
  if (error) throw error;
  return data;
}

export async function listAreasForZone(zoneId: string) {
  const { data, error } = await supabase
    .from("areas")
    .select("*")
    .eq("zone_id", zoneId)
    .eq("status", "active")
    .order("area_name");
  if (error) throw error;
  return data;
}

export async function listStreetsForArea(areaId: string) {
  const { data, error } = await supabase
    .from("streets")
    .select("*")
    .eq("area_id", areaId)
    .eq("status", "active")
    .order("street_name");
  if (error) throw error;
  return data;
}

/** Full hierarchy path for one city — used by breadcrumbs / admin views. */
export async function getCityWithAncestors(cityId: string) {
  const { data, error } = await supabase
    .from("cities")
    .select("*, states(*, countries(*))")
    .eq("id", cityId)
    .single();
  if (error) throw error;
  return data;
}

// ---------------------------------------------------------------------------
// Admin writes — create/rename/archive. All deletes are soft (status update),
// per the PRD's "no physical deletion" rule.
// ---------------------------------------------------------------------------

export async function createCity(input: TablesInsert<"cities">) {
  const { data, error } = await supabase.from("cities").insert(input).select().single();
  if (error) throw error;
  return data;
}

export async function createArea(input: TablesInsert<"areas">) {
  const { data, error } = await supabase.from("areas").insert(input).select().single();
  if (error) throw error;
  return data;
}

export async function createStreet(input: TablesInsert<"streets">) {
  const { data, error } = await supabase.from("streets").insert(input).select().single();
  if (error) throw error;
  return data;
}

/** Soft-delete (archive) any hierarchy row instead of hard-deleting it. */
export async function archiveLocation(
  table: "countries" | "states" | "cities" | "zones" | "areas" | "streets",
  id: string,
) {
  const { error } = await supabase.from(table).update({ status: "archived" }).eq("id", id);
  if (error) throw error;
}

export async function restoreLocation(
  table: "countries" | "states" | "cities" | "zones" | "areas" | "streets",
  id: string,
) {
  const { error } = await supabase.from(table).update({ status: "active" }).eq("id", id);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Address helpers — building a full-hierarchy address for checkout, merchant
// onboarding, or rider profile forms.
// ---------------------------------------------------------------------------

export interface FullAddressInput {
  streetId: string;
  lat: number;
  lng: number;
  buildingNumber?: string;
  apartment?: string;
  floor?: string;
  landmark?: string;
  formatted?: string;
  label?: string;
  userId?: string;
  isDefault?: boolean;
}

export async function createFullAddress(input: FullAddressInput) {
  const payload: TablesInsert<"addresses"> = {
    street_id: input.streetId,
    lat: input.lat,
    lng: input.lng,
    building_number: input.buildingNumber,
    apartment: input.apartment,
    floor: input.floor,
    landmark: input.landmark,
    formatted: input.formatted,
    label: input.label,
    user_id: input.userId,
    is_default: input.isDefault ?? false,
  };
  const { data, error } = await supabase.from("addresses").insert(payload).select().single();
  if (error) throw error;
  return data;
}
