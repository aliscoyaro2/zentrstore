import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, MapPin } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "@/components/admin/admin-layout";
import { useRoleGuard } from "@/hooks/use-role-guard";
import { naira } from "@/lib/money";
import { cn } from "@/lib/utils";
import { LocationPicker, type PickedLocation } from "@/components/zentra/map/location-picker";
import { merchantIcon } from "@/components/zentra/map/map-icons";

export const Route = createFileRoute("/admin/zones")({
  head: () => ({
    meta: [
      { title: "Delivery Zones — Zentra Admin" },
      { name: "description", content: "Manage Zentra's launch delivery zones, fees and coverage." },
    ],
  }),
  component: ZonesPage,
});

type ZoneRow = {
  id: string;
  name: string;
  lat: number | null;
  lng: number | null;
  delivery_fee_kobo: number;
  minimum_order_kobo: number;
  max_radius_km: number;
  estimated_minutes: number;
  is_active: boolean;
  city_id: string | null;
  cities: { name: string } | null;
};

type CityOption = { id: string; name: string };

function ZonesPage() {
  const { ready } = useRoleGuard("admin");
  const queryClient = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newCityId, setNewCityId] = useState("");
  const [newLocation, setNewLocation] = useState<PickedLocation | null>(null);

  const zones = useQuery({
    queryKey: ["admin-zones"],
    enabled: ready,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("zones")
        .select(
          "id,name,lat,lng,delivery_fee_kobo,minimum_order_kobo,max_radius_km,estimated_minutes,is_active,city_id,cities(name)",
        )
        .order("name");
      if (error) throw error;
      return data as unknown as ZoneRow[];
    },
  });

  // Cities feed the "New zone" form's city picker. Today this only ever
  // returns Maiduguri, but the picker (and createZone below) already work
  // correctly the moment a second city is added — no further changes needed.
  const cities = useQuery({
    queryKey: ["admin-geo-cities"],
    enabled: ready,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cities")
        .select("id,name")
        .eq("status", "active")
        .order("name");
      if (error) throw error;
      return data as CityOption[];
    },
  });

  const merchantCounts = useQuery({
    queryKey: ["admin-zones-merchant-counts"],
    enabled: ready,
    queryFn: async () => {
      // Zentra doesn't have a merchants.zone_id column yet — merchant-to-zone
      // is implicit via lat/lng today, so this stays a simple total count
      // rather than a per-zone breakdown until that link exists.
      const { count } = await supabase
        .from("merchants")
        .select("id", { count: "exact", head: true })
        .eq("status", "approved");
      return count ?? 0;
    },
  });

  async function updateZone(id: string, patch: Partial<ZoneRow>) {
    const { error } = await supabase.from("zones").update(patch as never).eq("id", id);
    if (error) {
      toast.error("Could not update zone", { description: error.message });
      return;
    }
    queryClient.invalidateQueries({ queryKey: ["admin-zones"] });
  }

  async function toggleActive(zone: ZoneRow) {
    await updateZone(zone.id, { is_active: !zone.is_active });
    toast.success(zone.is_active ? "Zone paused" : "Zone activated");
  }

  async function createZone() {
    if (!newName.trim()) return;
    const cityId = newCityId || cities.data?.[0]?.id;
    if (!cityId) {
      toast.error("No city available", { description: "Add a city before creating a zone." });
      return;
    }
    const { error } = await supabase.from("zones").insert({
      name: newName.trim(),
      city_id: cityId,
      lat: newLocation?.lat ?? null,
      lng: newLocation?.lng ?? null,
    });
    if (error) {
      toast.error("Could not create zone", { description: error.message });
      return;
    }
    toast.success("Zone created");
    setNewName("");
    setNewCityId("");
    setNewLocation(null);
    setCreating(false);
    queryClient.invalidateQueries({ queryKey: ["admin-zones"] });
  }

  if (!ready) return null;

  return (
    <AdminLayout
      title="Delivery Zones"
      subtitle={`${zones.data?.length ?? 0} zones · ${merchantCounts.data ?? 0} approved merchants live`}
    >
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Zentra launches zone-by-zone, not citywide. Each zone controls its own delivery fee, minimum order and coverage radius.
        </p>
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="flex shrink-0 items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-bold text-primary-foreground"
        >
          <Plus className="size-3.5" />
          New zone
        </button>
      </div>

      {creating ? (
        <div className="mb-4 space-y-3 rounded-xl border border-border bg-card p-4 shadow-sm">
          <div className="flex flex-wrap items-center gap-2">
            <input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && createZone()}
              placeholder="Zone name, e.g. Gwange"
              className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none ring-primary/20 focus:ring-2"
            />
            <select
              value={newCityId || cities.data?.[0]?.id || ""}
              onChange={(e) => setNewCityId(e.target.value)}
              aria-label="City"
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none ring-primary/20 focus:ring-2"
            >
              {(cities.data ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <p className="mb-1 text-xs font-semibold text-muted-foreground">Zone centre point (optional)</p>
            <LocationPicker
              value={newLocation}
              onChange={setNewLocation}
              icon={merchantIcon}
              placeholder="Search for the zone's centre point"
            />
          </div>

          <div className="flex items-center gap-2">
            <button type="button" onClick={createZone} className="rounded-lg bg-primary px-3 py-2 text-xs font-bold text-primary-foreground">
              Save
            </button>
            <button
              type="button"
              onClick={() => {
                setCreating(false);
                setNewName("");
                setNewCityId("");
                setNewLocation(null);
              }}
              className="rounded-lg border border-border px-3 py-2 text-xs font-bold text-muted-foreground"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {zones.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading zones…</p>
        ) : (
          (zones.data ?? []).map((zone) => (
            <div key={zone.id} className="rounded-xl border border-border bg-card p-5 shadow-sm">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <span className="grid size-8 place-items-center rounded-lg bg-secondary text-primary">
                    <MapPin className="size-4" />
                  </span>
                  <div>
                    <p className="font-display text-sm font-bold text-foreground">{zone.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {zone.cities?.name ?? "No city assigned"}
                      {zone.lat && zone.lng ? ` · ${zone.lat.toFixed(4)}, ${zone.lng.toFixed(4)}` : ""}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => toggleActive(zone)}
                  className={cn(
                    "rounded-full px-2.5 py-1 text-[11px] font-semibold",
                    zone.is_active ? "bg-success-soft text-success" : "bg-secondary text-muted-foreground",
                  )}
                >
                  {zone.is_active ? "Active" : "Paused"}
                </button>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <Field
                  label="Delivery fee"
                  value={zone.delivery_fee_kobo}
                  suffix="kobo"
                  display={naira(zone.delivery_fee_kobo)}
                  onSave={(v) => updateZone(zone.id, { delivery_fee_kobo: v })}
                />
                <Field
                  label="Minimum order"
                  value={zone.minimum_order_kobo}
                  suffix="kobo"
                  display={zone.minimum_order_kobo === 0 ? "None" : naira(zone.minimum_order_kobo)}
                  onSave={(v) => updateZone(zone.id, { minimum_order_kobo: v })}
                />
                <Field
                  label="Max radius"
                  value={zone.max_radius_km}
                  suffix="km"
                  display={`${zone.max_radius_km} km`}
                  onSave={(v) => updateZone(zone.id, { max_radius_km: v })}
                />
                <Field
                  label="Est. delivery time"
                  value={zone.estimated_minutes}
                  suffix="min"
                  display={`${zone.estimated_minutes} min`}
                  onSave={(v) => updateZone(zone.id, { estimated_minutes: v })}
                />
              </div>
            </div>
          ))
        )}
      </div>

      <div className="mt-6 rounded-xl border border-dashed border-border bg-secondary/50 p-5 text-center">
        <p className="text-xs text-muted-foreground">
          Zones are defined by a searchable centre point (via the map provider) and a radius. Hand-drawn
          polygon boundaries aren't supported yet — that's a larger feature than a centre-point + radius model.
        </p>
      </div>
    </AdminLayout>
  );
}

function Field({
  label,
  value,
  display,
  onSave,
}: {
  label: string;
  value: number;
  suffix: string;
  display: string;
  onSave: (v: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));

  function commit() {
    const n = Number(draft);
    if (!Number.isNaN(n) && n >= 0) onSave(n);
    setEditing(false);
  }

  return (
    <div>
      <p className="text-[11px] font-medium text-muted-foreground">{label}</p>
      {editing ? (
        <input
          autoFocus
          type="number"
          min={0}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => e.key === "Enter" && commit()}
          className="mt-0.5 w-full rounded-md border border-border bg-background px-2 py-1 text-sm outline-none ring-primary/20 focus:ring-2"
        />
      ) : (
        <button
          type="button"
          onClick={() => {
            setDraft(String(value));
            setEditing(true);
          }}
          className="mt-0.5 block text-left font-display text-sm font-bold text-foreground hover:text-primary"
        >
          {display}
        </button>
      )}
    </div>
  );
}
