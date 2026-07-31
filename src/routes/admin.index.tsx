import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Screen, PageHeader, Panel, EmptyState } from "@/components/zentra/shell";
import { statusLabel } from "@/components/zentra/status-rail";
import { categoryLabel } from "@/lib/categories";
import { naira } from "@/lib/money";

export const Route = createFileRoute("/admin/")({
  head: () => ({
    meta: [
      { title: "Admin control — Zentra" },
      {
        name: "description",
        content: "Approve merchants and riders, dispatch orders and watch Zentra platform revenue.",
      },
      { property: "og:title", content: "Zentra admin control" },
      { property: "og:description", content: "Approvals, dispatch and money in one operator view." },
    ],
  }),
  component: AdminPage,
});

type Tab = "approvals" | "dispatch" | "money";

function AdminPage() {
  const [tab, setTab] = useState<Tab>("approvals");

  const merchants = useQuery({
    queryKey: ["admin-merchants"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("merchants")
        .select("id,business_name,category,status,address_text")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const riders = useQuery({
    queryKey: ["admin-riders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("riders")
        .select("id,status,vehicle_make,vehicle_model,plate_number,is_online")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const orders = useQuery({
    queryKey: ["admin-orders"],
    refetchInterval: 20000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select(
          "id,status,total_kobo,service_fee_kobo,delivery_fee_kobo,rider_id,merchants(business_name)",
        )
        .order("placed_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
  });

  async function setMerchantStatus(id: string, status: "approved" | "suspended") {
    const { error } = await supabase.from("merchants").update({ status }).eq("id", id);
    if (error) toast.error("Not allowed", { description: error.message });
    else await merchants.refetch();
  }

  async function setRiderStatus(id: string, status: "approved" | "suspended") {
    const { error } = await supabase.from("riders").update({ status }).eq("id", id);
    if (error) toast.error("Not allowed", { description: error.message });
    else await riders.refetch();
  }

  async function assignRider(orderId: string, riderId: string) {
    const { error } = await supabase
      .from("orders")
      .update({ rider_id: riderId, status: "rider_assigned" })
      .eq("id", orderId);
    if (error) toast.error("Could not assign", { description: error.message });
    else await orders.refetch();
  }

  const gmv = (orders.data ?? []).reduce((sum, o) => sum + o.total_kobo, 0);
  const serviceFees = (orders.data ?? []).reduce((sum, o) => sum + o.service_fee_kobo, 0);
  const deliveryFees = (orders.data ?? []).reduce((sum, o) => sum + o.delivery_fee_kobo, 0);
  const unassigned = (orders.data ?? []).filter(
    (o) => !o.rider_id && ["paid", "merchant_accepted", "preparing"].includes(o.status),
  );
  const approvedRiders = (riders.data ?? []).filter((r) => r.status === "approved");

  return (
    <Screen>
      <PageHeader title="Admin control" subtitle="Maiduguri operations" back="/" />

      <div className="flex gap-2 px-4 pt-4">
        {(["approvals", "dispatch", "money"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`rounded-full px-4 py-2 text-sm font-bold capitalize ${
              tab === t ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "approvals" ? (
        <div className="space-y-4 px-4 py-5">
          <h2 className="text-xs font-bold uppercase tracking-[0.15em] text-muted-foreground">
            Merchants
          </h2>
          {(merchants.data ?? []).length === 0 ? (
            <EmptyState title="Nothing to review" body="Admin access is required to see this data." />
          ) : null}
          {(merchants.data ?? []).map((m) => (
            <Panel key={m.id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold">{m.business_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {categoryLabel(m.category)} · {m.address_text ?? "Maiduguri"}
                  </p>
                </div>
                <Badge status={m.status} />
              </div>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => setMerchantStatus(m.id, "approved")}
                  className="flex-1 rounded-lg bg-primary py-2 text-xs font-bold text-primary-foreground"
                >
                  Approve
                </button>
                <button
                  type="button"
                  onClick={() => setMerchantStatus(m.id, "suspended")}
                  className="flex-1 rounded-lg border border-destructive py-2 text-xs font-bold text-destructive"
                >
                  Suspend
                </button>
              </div>
            </Panel>
          ))}

          <h2 className="pt-2 text-xs font-bold uppercase tracking-[0.15em] text-muted-foreground">
            Riders
          </h2>
          {(riders.data ?? []).map((r) => (
            <Panel key={r.id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold">
                    {`${r.vehicle_make ?? ""} ${r.vehicle_model ?? ""}`.trim() || "Rider"}
                  </p>
                  <p className="text-xs text-muted-foreground">{r.plate_number ?? "No plate"}</p>
                </div>
                <Badge status={r.status} />
              </div>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => setRiderStatus(r.id, "approved")}
                  className="flex-1 rounded-lg bg-primary py-2 text-xs font-bold text-primary-foreground"
                >
                  Approve
                </button>
                <button
                  type="button"
                  onClick={() => setRiderStatus(r.id, "suspended")}
                  className="flex-1 rounded-lg border border-destructive py-2 text-xs font-bold text-destructive"
                >
                  Suspend
                </button>
              </div>
            </Panel>
          ))}
        </div>
      ) : null}

      {tab === "dispatch" ? (
        <div className="space-y-3 px-4 py-5">
          {unassigned.length === 0 ? (
            <EmptyState
              title="Nothing waiting"
              body="Paid orders without a rider appear here for assignment."
            />
          ) : null}
          {unassigned.map((o) => (
            <Panel key={o.id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold">{o.merchants?.business_name ?? "Store"}</p>
                  <p className="text-xs text-muted-foreground">{statusLabel(o.status)}</p>
                </div>
                <span className="font-display font-extrabold">{naira(o.total_kobo)}</span>
              </div>
              {approvedRiders.length === 0 ? (
                <p className="mt-2 text-xs text-muted-foreground">No approved riders yet.</p>
              ) : (
                <select
                  defaultValue=""
                  onChange={(e) => e.target.value && assignRider(o.id, e.target.value)}
                  className="mt-3 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                >
                  <option value="">Assign a rider…</option>
                  {approvedRiders.map((r) => (
                    <option key={r.id} value={r.id}>
                      {`${r.vehicle_make ?? "Rider"} ${r.plate_number ?? ""}`.trim()}
                      {r.is_online ? " · online" : ""}
                    </option>
                  ))}
                </select>
              )}
            </Panel>
          ))}
        </div>
      ) : null}

      {tab === "money" ? (
        <div className="space-y-3 px-4 py-5">
          <Panel className="p-4">
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Gross order value
            </p>
            <p className="font-display text-3xl font-extrabold">{naira(gmv)}</p>
          </Panel>
          <div className="grid grid-cols-2 gap-3">
            <Panel className="p-4">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Service fees
              </p>
              <p className="font-display text-lg font-extrabold">{naira(serviceFees)}</p>
            </Panel>
            <Panel className="p-4">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Delivery fees
              </p>
              <p className="font-display text-lg font-extrabold">{naira(deliveryFees)}</p>
            </Panel>
          </div>
          <p className="px-1 text-xs leading-relaxed text-muted-foreground">
            Merchant commission is settled from the order payment; rider earnings come out of the
            delivery fee. Every naira is paid online — Zentra never collects cash on delivery.
          </p>
        </div>
      ) : null}
    </Screen>
  );
}

function Badge({ status }: { status: "pending" | "approved" | "suspended" }) {
  const style =
    status === "approved"
      ? "bg-success-soft text-success"
      : status === "suspended"
        ? "bg-destructive/10 text-destructive"
        : "bg-accent-soft text-accent-foreground";
  return (
    <span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-bold uppercase ${style}`}>
      {status}
    </span>
  );
}
