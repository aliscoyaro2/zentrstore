import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { MerchantLayout } from "@/components/zentra/merchant-layout";
import { useMerchantPermissions } from "@/hooks/use-merchant-permissions";

export const Route = createFileRoute("/merchant/settings/")({
  head: () => ({
    meta: [
      { title: "Store Settings – Merchant" },
      { name: "description", content: "Edit your store information." },
    ],
  }),
  component: MerchantSettingsPage,
});

function MerchantSettingsPage() {
  const { storeId, permissions, isLoading: permsLoading } = useMerchantPermissions();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    business_name: "",
    phone: "",
    address_text: "",
    delivery_radius_km: 5,
    opening_time: "",
    closing_time: "",
    is_open_override: false,
  });
  const [saving, setSaving] = useState(false);

  // All hooks must run unconditionally, on every render, in the same
  // order — never place a hook call after an early `return`. We gate
  // the query itself with `enabled` and gate what we *render* below.
  const settings = useQuery({
    queryKey: ["merchant-settings", storeId],
    enabled: Boolean(storeId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("merchants")
        .select("business_name, phone, address_text, delivery_radius_km, opening_time, closing_time, is_open_override")
        .eq("id", storeId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (settings.data) {
      setForm({
        business_name: settings.data.business_name || "",
        phone: settings.data.phone || "",
        address_text: settings.data.address_text || "",
        delivery_radius_km: settings.data.delivery_radius_km ?? 5,
        opening_time: settings.data.opening_time || "",
        closing_time: settings.data.closing_time || "",
        is_open_override: settings.data.is_open_override ?? false,
      });
    }
  }, [settings.data]);

  if (permsLoading) return <MerchantLayout>Loading...</MerchantLayout>;
  if (!storeId) return <MerchantLayout>No store found.</MerchantLayout>;
  if (settings.isLoading) return <MerchantLayout>Loading settings...</MerchantLayout>;
  if (settings.error) {
    return (
      <MerchantLayout>
        <div className="text-center py-10">
          <p className="text-destructive font-semibold">Could not load settings</p>
          <p className="text-sm text-muted-foreground mt-1">Please try refreshing the page.</p>
        </div>
      </MerchantLayout>
    );
  }

  const canEditSettings = permissions?.settings === "full";

  async function saveSettings(e: React.FormEvent) {
    e.preventDefault();
    if (!canEditSettings) {
      toast.error("You don't have permission to edit settings.");
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("merchants")
      .update({
        business_name: form.business_name.trim(),
        phone: form.phone.trim() || null,
        address_text: form.address_text.trim() || null,
        delivery_radius_km: form.delivery_radius_km,
        opening_time: form.opening_time || null,
        closing_time: form.closing_time || null,
        is_open_override: form.is_open_override,
      })
      .eq("id", storeId);
    setSaving(false);
    if (error) {
      toast.error("Could not save", { description: error.message });
      return;
    }
    toast.success("Settings saved");
    queryClient.invalidateQueries({ queryKey: ["merchant-settings", storeId] });
  }

  const inputClass = "w-full rounded-lg border border-border px-3 py-2 text-sm bg-background";

  return (
    <MerchantLayout>
      <form onSubmit={saveSettings} className="space-y-4 max-w-md">
        <div>
          <label className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Store name</label>
          <input
            className={inputClass}
            value={form.business_name}
            onChange={e => setForm({ ...form, business_name: e.target.value })}
            disabled={!canEditSettings}
            required
          />
        </div>
        <div>
          <label className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Phone</label>
          <input
            className={inputClass}
            value={form.phone}
            onChange={e => setForm({ ...form, phone: e.target.value })}
            disabled={!canEditSettings}
            placeholder="e.g. 0803 123 4567"
          />
        </div>
        <div>
          <label className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Address</label>
          <input
            className={inputClass}
            value={form.address_text}
            onChange={e => setForm({ ...form, address_text: e.target.value })}
            disabled={!canEditSettings}
          />
        </div>
        <div>
          <label className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Delivery radius (km)</label>
          <input
            type="number"
            min="1"
            step="0.5"
            className={inputClass}
            value={form.delivery_radius_km}
            onChange={e => setForm({ ...form, delivery_radius_km: parseFloat(e.target.value) || 0 })}
            disabled={!canEditSettings}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Opening time</label>
            <input
              type="time"
              className={inputClass}
              value={form.opening_time}
              onChange={e => setForm({ ...form, opening_time: e.target.value })}
              disabled={!canEditSettings}
            />
          </div>
          <div>
            <label className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Closing time</label>
            <input
              type="time"
              className={inputClass}
              value={form.closing_time}
              onChange={e => setForm({ ...form, closing_time: e.target.value })}
              disabled={!canEditSettings}
            />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="is_open"
            checked={form.is_open_override}
            onChange={e => setForm({ ...form, is_open_override: e.target.checked })}
            disabled={!canEditSettings}
          />
          <label htmlFor="is_open" className="text-sm">Store is currently open</label>
        </div>
        {canEditSettings ? (
          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-lg bg-primary py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-60"
          >
            {saving ? "Saving..." : "Save changes"}
          </button>
        ) : (
          <p className="text-sm text-muted-foreground">You don't have permission to edit settings.</p>
        )}
      </form>
    </MerchantLayout>
  );
}
