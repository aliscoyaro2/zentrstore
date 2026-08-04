import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Bike, FileCheck, FileX, ChevronRight, LogOut, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Screen, PageHeader, Panel } from "@/components/zentra/shell";
import { RiderBottomNav } from "@/components/zentra/rider-bottom-nav";
import { useRoleGuard } from "@/hooks/use-role-guard";

export const Route = createFileRoute("/rider/account")({
  head: () => ({
    meta: [
      { title: "Account — Zentra Rider" },
      { name: "description", content: "Manage your Zentra rider profile, motorcycle and documents." },
    ],
  }),
  component: RiderAccount,
});

const STATUS_COPY: Record<string, { label: string; className: string; icon: typeof ShieldCheck }> = {
  approved: { label: "Verified", className: "bg-success-soft text-success", icon: ShieldCheck },
  pending: { label: "Pending review", className: "bg-accent-soft text-accent-foreground", icon: FileCheck },
  suspended: { label: "Suspended", className: "bg-destructive/10 text-destructive", icon: FileX },
};

function RiderAccount() {
  const { user, ready } = useRoleGuard("rider");
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [plate, setPlate] = useState("");
  const [busy, setBusy] = useState(false);

  const profile = useQuery({
    queryKey: ["profile", user?.id],
    enabled: ready,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("full_name,phone,email")
        .eq("id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const rider = useQuery({
    queryKey: ["rider-account", user?.id],
    enabled: ready,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("riders")
        .select("status,vehicle_make,vehicle_model,plate_number,photo_url,national_id_doc_url,created_at")
        .eq("id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  function startEdit() {
    setMake(rider.data?.vehicle_make ?? "");
    setModel(rider.data?.vehicle_model ?? "");
    setPlate(rider.data?.plate_number ?? "");
    setEditing(true);
  }

  async function saveVehicle() {
    if (!user) return;
    setBusy(true);
    const { error } = await supabase
      .from("riders")
      .update({
        vehicle_make: make.trim(),
        vehicle_model: model.trim(),
        plate_number: plate.trim().toUpperCase(),
      })
      .eq("id", user.id);
    setBusy(false);
    if (error) {
      toast.error("Could not save", { description: error.message });
      return;
    }
    toast.success("Motorcycle details updated");
    setEditing(false);
    queryClient.invalidateQueries({ queryKey: ["rider-account", user.id] });
  }

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/" });
  }

  if (!ready) return null;

  const status = rider.data?.status ?? "pending";
  const statusMeta = STATUS_COPY[status] ?? STATUS_COPY['pending']!;
  const StatusIcon = statusMeta.icon;

  return (
    <Screen navSlot={<RiderBottomNav />}>
      <PageHeader title="Account" subtitle="Profile & motorcycle" back="/rider" />

      <div className="space-y-4 px-4 py-5">
        {/* Identity */}
        <Panel className="flex items-center gap-4 p-4">
          <span className="grid size-14 shrink-0 place-items-center rounded-full bg-primary/10 text-lg font-bold text-primary">
            {(profile.data?.full_name ?? "R").charAt(0).toUpperCase()}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-base font-bold">{profile.data?.full_name ?? "Rider"}</p>
            <p className="truncate text-xs text-muted-foreground">
              {profile.data?.phone ?? profile.data?.email ?? "—"}
            </p>
          </div>
          <span className={`flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold ${statusMeta.className}`}>
            <StatusIcon className="size-3" strokeWidth={2.5} />
            {statusMeta.label}
          </span>
        </Panel>

        {status === "pending" ? (
          <div className="rounded-xl border border-accent/30 bg-accent-soft p-3 text-xs text-accent-foreground">
            Your documents are still being reviewed. You can go online once an admin approves your account.
          </div>
        ) : status === "suspended" ? (
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
            Your account is suspended. Contact support to find out why and how to resolve it.
          </div>
        ) : null}

        {/* Motorcycle */}
        <div>
          <div className="flex items-center justify-between pb-2">
            <h2 className="text-xs font-bold uppercase tracking-[0.15em] text-muted-foreground">Motorcycle</h2>
            {!editing ? (
              <button type="button" onClick={startEdit} className="text-xs font-bold text-primary">
                Edit
              </button>
            ) : null}
          </div>

          {!editing ? (
            <Panel className="flex items-center gap-3 p-4">
              <span className="grid size-11 shrink-0 place-items-center rounded-full bg-secondary text-muted-foreground">
                <Bike className="size-5" strokeWidth={2.2} />
              </span>
              <div>
                <p className="text-sm font-bold">
                  {[rider.data?.vehicle_make, rider.data?.vehicle_model].filter(Boolean).join(" ") || "Not set"}
                </p>
                <p className="text-xs text-muted-foreground">
                  Plate {rider.data?.plate_number ?? "—"}
                </p>
              </div>
            </Panel>
          ) : (
            <Panel className="space-y-3 p-4">
              <Field label="Make" value={make} onChange={setMake} placeholder="e.g. Bajaj" />
              <Field label="Model" value={model} onChange={setModel} placeholder="e.g. Boxer" />
              <Field label="Plate number" value={plate} onChange={setPlate} placeholder="e.g. BOR 123 XY" />
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setEditing(false)}
                  disabled={busy}
                  className="flex-1 rounded-xl border border-border py-2.5 text-sm font-bold text-muted-foreground"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={saveVehicle}
                  disabled={busy}
                  className="flex-1 rounded-xl bg-primary py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-60"
                >
                  {busy ? "Saving…" : "Save"}
                </button>
              </div>
            </Panel>
          )}
        </div>

        {/* Documents — read-only here; uploads/changes go through support
            since a document change needs re-verification, same as a
            fresh application. */}
        <div>
          <h2 className="pb-2 text-xs font-bold uppercase tracking-[0.15em] text-muted-foreground">Documents</h2>
          <Panel className="divide-y divide-border">
            <DocRow label="Profile photo" present={Boolean(rider.data?.photo_url)} />
            <DocRow label="Government ID / NIN" present={Boolean(rider.data?.national_id_doc_url)} />
          </Panel>
          <p className="mt-2 px-1 text-xs text-muted-foreground">
            To update a document, message support with the new file — a document change needs
            re-verification before it takes effect.
          </p>
        </div>

        {/* Other account actions */}
        <div>
          <h2 className="pb-2 text-xs font-bold uppercase tracking-[0.15em] text-muted-foreground">More</h2>
          <div className="space-y-2">
            <MenuLink to="/settings" label="Change password" />
            <MenuLink to="/rider/support" label="Contact support" />
            <MenuLink to="/about" label="Terms & policies" />
          </div>
        </div>

        <button
          type="button"
          onClick={signOut}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-destructive/30 bg-destructive/5 py-3 text-sm font-bold text-destructive"
        >
          <LogOut className="size-4" strokeWidth={2.2} />
          Log out
        </button>
      </div>
    </Screen>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-bold text-muted-foreground">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-border bg-secondary/40 px-3 py-2.5 text-sm outline-none focus:border-primary"
      />
    </label>
  );
}

function DocRow({ label, present }: { label: string; present: boolean }) {
  return (
    <div className="flex items-center justify-between p-3.5">
      <span className="text-sm font-medium">{label}</span>
      <span
        className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold ${
          present ? "bg-success-soft text-success" : "bg-secondary text-muted-foreground"
        }`}
      >
        {present ? <FileCheck className="size-3" strokeWidth={2.5} /> : <FileX className="size-3" strokeWidth={2.5} />}
        {present ? "On file" : "Missing"}
      </span>
    </div>
  );
}

function MenuLink({ to, label }: { to: string; label: string }) {
  return (
    <Link
      to={to}
      className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3 text-sm font-medium"
    >
      {label}
      <ChevronRight className="size-4 text-muted-foreground" />
    </Link>
  );
}
