import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "@/components/admin/admin-layout";
import { useRoleGuard } from "@/hooks/use-role-guard";

export const Route = createFileRoute("/admin/settings")({
  head: () => ({
    meta: [
      { title: "Settings — Zentra Admin" },
      { name: "description", content: "Platform-wide commission, fee and support defaults." },
    ],
  }),
  component: SettingsPage,
});

type Settings = {
  default_commission_pct: number;
  base_delivery_fee_kobo: number;
  per_km_fee_kobo: number;
  service_fee_pct: number;
  service_fee_min_kobo: number;
  platform_currency: string;
  support_phone: string | null;
  support_email: string | null;
};

function SettingsPage() {
  const { ready } = useRoleGuard("admin");
  const queryClient = useQueryClient();
  const [form, setForm] = useState<Settings | null>(null);
  const [saving, setSaving] = useState(false);

  const settings = useQuery({
    queryKey: ["admin-platform-settings"],
    enabled: ready,
    queryFn: async () => {
      const { data, error } = await supabase.from("platform_settings").select("*").eq("id", true).single();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (settings.data && !form) {
      setForm({
        default_commission_pct: settings.data.default_commission_pct,
        base_delivery_fee_kobo: settings.data.base_delivery_fee_kobo,
        per_km_fee_kobo: settings.data.per_km_fee_kobo,
        service_fee_pct: settings.data.service_fee_pct,
        service_fee_min_kobo: settings.data.service_fee_min_kobo,
        platform_currency: settings.data.platform_currency,
        support_phone: settings.data.support_phone,
        support_email: settings.data.support_email,
      });
    }
  }, [settings.data, form]);

  async function save() {
    if (!form) return;
    setSaving(true);
    const { data: userData } = await supabase.auth.getUser();
    const { error } = await supabase
      .from("platform_settings")
      .update({ ...form, updated_at: new Date().toISOString(), updated_by: userData.user?.id ?? null })
      .eq("id", true);
    setSaving(false);
    if (error) {
      toast.error("Could not save settings", { description: error.message });
      return;
    }
    toast.success("Settings saved");
    queryClient.invalidateQueries({ queryKey: ["admin-platform-settings"] });
  }

  if (!ready || !form) return null;

  return (
    <AdminLayout title="Settings" subtitle="Platform-wide defaults">
      <div className="max-w-2xl space-y-6">
        <Section title="Commission & fees">
          <NumberField
            label="Default merchant commission"
            suffix="%"
            value={form.default_commission_pct}
            onChange={(v) => setForm({ ...form, default_commission_pct: v })}
            hint="Applied to newly approved merchants. Individual merchants can still be set differently on the Merchants page."
          />
          <NumberField
            label="Base delivery fee"
            suffix="kobo"
            value={form.base_delivery_fee_kobo}
            onChange={(v) => setForm({ ...form, base_delivery_fee_kobo: v })}
            hint="Zone-level fees on the Delivery Zones page override this per zone."
          />
          <NumberField
            label="Per-km fee"
            suffix="kobo"
            value={form.per_km_fee_kobo}
            onChange={(v) => setForm({ ...form, per_km_fee_kobo: v })}
            hint="Set to 0 to keep delivery pricing flat, zone-based only."
          />
          <NumberField
            label="Service fee"
            suffix="%"
            value={form.service_fee_pct}
            onChange={(v) => setForm({ ...form, service_fee_pct: v })}
          />
          <NumberField
            label="Minimum service fee"
            suffix="kobo"
            value={form.service_fee_min_kobo}
            onChange={(v) => setForm({ ...form, service_fee_min_kobo: v })}
          />
        </Section>

        <Section title="Currency">
          <TextField
            label="Currency code"
            value={form.platform_currency}
            onChange={(v) => setForm({ ...form, platform_currency: v.toUpperCase() })}
          />
        </Section>

        <Section title="Support contact">
          <TextField
            label="Support phone"
            value={form.support_phone ?? ""}
            onChange={(v) => setForm({ ...form, support_phone: v || null })}
            placeholder="+234…"
          />
          <TextField
            label="Support email"
            value={form.support_email ?? ""}
            onChange={(v) => setForm({ ...form, support_email: v || null })}
            placeholder="support@zentra.ng"
          />
        </Section>

        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-50"
        >
          <Save className="size-4" />
          {saving ? "Saving…" : "Save settings"}
        </button>
      </div>
    </AdminLayout>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <p className="text-sm font-semibold text-foreground">{title}</p>
      <div className="mt-4 space-y-4">{children}</div>
    </div>
  );
}

function NumberField({
  label,
  suffix,
  value,
  onChange,
  hint,
}: {
  label: string;
  suffix: string;
  value: number;
  onChange: (v: number) => void;
  hint?: string;
}) {
  return (
    <div>
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      <div className="mt-1 flex items-center gap-2">
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none ring-primary/20 focus:ring-2"
        />
        <span className="shrink-0 text-xs text-muted-foreground">{suffix}</span>
      </div>
      {hint ? <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none ring-primary/20 focus:ring-2"
      />
    </div>
  );
}
