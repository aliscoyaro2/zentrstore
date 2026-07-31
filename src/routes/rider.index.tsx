import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Screen, PageHeader, Panel, EmptyState } from "@/components/zentra/shell";
import { statusLabel } from "@/components/zentra/status-rail";
import { useRoleGuard } from "@/hooks/use-role-guard";
import { naira } from "@/lib/money";

export const Route = createFileRoute("/rider/")({
  head: () => ({
    meta: [
      { title: "Rider dashboard — Zentra" },
      {
        name: "description",
        content: "Go online, pick up assigned deliveries and move each Zentra order to delivered.",
      },
      { property: "og:title", content: "Zentra rider dashboard" },
      { property: "og:description", content: "Your assigned Maiduguri deliveries, step by step." },
    ],
  }),
  component: RiderDashboard,
});

const NEXT: Partial<Record<string, { status: string; label: string }>> = {
  rider_assigned: { status: "rider_en_route_to_merchant", label: "Heading to store" },
  rider_en_route_to_merchant: { status: "picked_up", label: "Picked up order" },
  picked_up: { status: "rider_en_route_to_customer", label: "Heading to customer" },
  rider_en_route_to_customer: { status: "delivered", label: "Mark delivered" },
};

function RiderDashboard() {
  const { user, ready } = useRoleGuard("rider");

  const rider = useQuery({
    queryKey: ["rider", user?.id],
    enabled: ready,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("riders")
        .select("id,status,is_online,total_deliveries,rating_avg,vehicle_make,vehicle_model")
        .eq("id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const balance = useQuery({
    queryKey: ["rider-balance", user?.id],
    enabled: ready,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rider_balances")
        .select("balance_kobo")
        .eq("rider_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const jobs = useQuery({
    queryKey: ["rider-jobs", user?.id],
    enabled: ready,
    refetchInterval: 20000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("id,status,total_kobo,delivery_fee_kobo,merchants(business_name,address_text),addresses(formatted)")
        .order("placed_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  async function toggleOnline() {
    if (!rider.data) return;
    const { error } = await supabase
      .from("riders")
      .update({ is_online: !rider.data.is_online })
      .eq("id", rider.data.id);
    if (error) toast.error("Could not update", { description: error.message });
    else await rider.refetch();
  }

  async function advance(orderId: string, status: string) {
    const { error } = await supabase
      .from("orders")
      .update(
        status === "delivered"
          ? { status: "delivered" as const, delivered_at: new Date().toISOString() }
          : { status: status as "rider_en_route_to_merchant" | "picked_up" | "rider_en_route_to_customer" },
      )
      .eq("id", orderId);
    if (error) toast.error("Update failed", { description: error.message });
    else await jobs.refetch();
  }

  if (!ready) return null;

  if (rider.isFetched && !rider.data) {
    return (
      <Screen>
        <PageHeader title="Rider" back="/" />
        <div className="px-4 py-8">
          <EmptyState
            title="You're not a rider yet"
            body="Apply with your motorcycle details and we'll verify you."
          />
          <Link
            to="/rider/apply"
            className="mt-4 block rounded-xl bg-primary py-3.5 text-center font-bold text-primary-foreground"
          >
            Apply to ride
          </Link>
        </div>
      </Screen>
    );
  }

  const active = (jobs.data ?? []).filter((j) => j.status !== "delivered" && j.status !== "cancelled");

  return (
    <Screen>
      <PageHeader
        title="Rider"
        subtitle={
          rider.data
            ? `${rider.data.vehicle_make ?? ""} ${rider.data.vehicle_model ?? ""}`.trim() || "Motorcycle"
            : undefined
        }
        back="/"
        right={
          rider.data ? (
            <button
              type="button"
              onClick={toggleOnline}
              disabled={rider.data.status !== "approved"}
              className={`rounded-full px-3 py-1.5 text-[10px] font-bold disabled:opacity-50 ${
                rider.data.is_online ? "bg-success-soft text-success" : "bg-secondary text-muted-foreground"
              }`}
            >
              {rider.data.is_online ? "ONLINE" : "OFFLINE"}
            </button>
          ) : undefined
        }
      />

      <div className="space-y-4 px-4 py-5">
        {rider.data?.status !== "approved" ? (
          <div className="rounded-2xl border border-accent/30 bg-accent-soft p-4 text-sm">
            <p className="font-bold text-accent-foreground">Verification pending</p>
            <p className="mt-1 text-xs text-muted-foreground">
              You can go online once an admin approves your documents.
            </p>
          </div>
        ) : null}

        <div className="grid grid-cols-3 gap-2">
          <Stat label="Deliveries" value={String(rider.data?.total_deliveries ?? 0)} />
          <Stat label="Rating" value={Number(rider.data?.rating_avg ?? 5).toFixed(1)} />
          <Stat label="Earnings" value={naira(balance.data?.balance_kobo ?? 0)} />
        </div>

        <h2 className="pt-1 text-xs font-bold uppercase tracking-[0.15em] text-muted-foreground">
          Assigned jobs
        </h2>
        {active.length === 0 ? (
          <EmptyState title="No jobs right now" body="Stay online — dispatch assigns nearby orders to you." />
        ) : (
          active.map((j) => {
            const next = NEXT[j.status];
            return (
              <Panel key={j.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold">{j.merchants?.business_name ?? "Store"}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Pickup: {j.merchants?.address_text ?? "See store"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Drop: {j.addresses?.formatted ?? "Customer address"}
                    </p>
                  </div>
                  <span className="shrink-0 font-display text-sm font-extrabold">
                    {naira(j.delivery_fee_kobo)}
                  </span>
                </div>
                <p className="mt-2 text-[11px] font-bold uppercase tracking-wider text-primary">
                  {statusLabel(j.status)}
                </p>
                {next ? (
                  <button
                    type="button"
                    onClick={() => advance(j.id, next.status)}
                    className="mt-3 w-full rounded-lg bg-primary py-2.5 text-xs font-bold text-primary-foreground"
                  >
                    {next.label}
                  </button>
                ) : null}
              </Panel>
            );
          })
        )}
      </div>
    </Screen>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-3 text-center shadow-card">
      <p className="font-display text-base font-extrabold leading-none">{value}</p>
      <p className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
    </div>
  );
}