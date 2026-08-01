import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Star, PackageCheck, Percent, Timer } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Screen, PageHeader, Panel } from "@/components/zentra/shell";
import { RiderBottomNav } from "@/components/zentra/rider-bottom-nav";
import { useRoleGuard } from "@/hooks/use-role-guard";

export const Route = createFileRoute("/rider/performance")({
  head: () => ({
    meta: [
      { title: "Performance — Zentra Rider" },
      {
        name: "description",
        content: "Your acceptance rate, completed deliveries and rating on Zentra.",
      },
    ],
  }),
  component: RiderPerformance,
});

function RiderPerformance() {
  const { user, ready } = useRoleGuard("rider");

  const rider = useQuery({
    queryKey: ["rider-performance", user?.id],
    enabled: ready,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("riders")
        .select("acceptance_rate,total_deliveries,rating_avg,created_at")
        .eq("id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  // Completion is derived from the rider's own order history rather than
  // stored as a column — `orders.status` already distinguishes delivered
  // from cancelled, so this is the source of truth for a completion rate.
  const orderStats = useQuery({
    queryKey: ["rider-order-stats", user?.id],
    enabled: ready,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("status,placed_at,delivered_at")
        .eq("rider_id", user!.id);
      if (error) throw error;
      const delivered = data.filter((o) => o.status === "delivered");
      const cancelled = data.filter((o) => o.status === "cancelled");
      const finished = delivered.length + cancelled.length;
      const completionRate = finished > 0 ? (delivered.length / finished) * 100 : null;

      const durations = delivered
        .filter((o) => o.placed_at && o.delivered_at)
        .map((o) => (new Date(o.delivered_at!).getTime() - new Date(o.placed_at!).getTime()) / 60000);
      const avgMinutes =
        durations.length > 0 ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : null;

      return { deliveredCount: delivered.length, completionRate, avgMinutes };
    },
  });

  if (!ready) return null;

  const acceptancePct = rider.data?.acceptance_rate != null ? Math.round(rider.data.acceptance_rate) : null;
  const rating = rider.data?.rating_avg != null ? Number(rider.data.rating_avg).toFixed(1) : "New";
  const memberSince = rider.data?.created_at
    ? new Date(rider.data.created_at).toLocaleDateString("en-NG", { month: "long", year: "numeric" })
    : null;

  return (
    <Screen navSlot={<RiderBottomNav />}>
      <PageHeader title="Performance" subtitle="How you're doing on Zentra" back="/rider" />

      <div className="space-y-4 px-4 py-5">
        {/* Rating — the number riders care about most, given its own
            prominent block rather than buried in a stat grid. */}
        <Panel className="flex items-center gap-4 p-5">
          <span className="grid size-14 shrink-0 place-items-center rounded-full bg-accent-soft text-accent-foreground">
            <Star className="size-6 fill-current" strokeWidth={2} />
          </span>
          <div>
            <p className="font-display text-2xl font-extrabold leading-none">{rating}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {rider.data?.rating_avg != null ? "Average customer rating" : "Complete deliveries to build a rating"}
            </p>
          </div>
        </Panel>

        <div className="grid grid-cols-2 gap-3">
          <MetricCard
            icon={PackageCheck}
            label="Total deliveries"
            value={String(rider.data?.total_deliveries ?? 0)}
          />
          <MetricCard
            icon={Percent}
            label="Acceptance rate"
            value={acceptancePct != null ? `${acceptancePct}%` : "—"}
            hint={
              acceptancePct != null && acceptancePct < 70
                ? "Accepting more requests helps you get offered more jobs"
                : undefined
            }
          />
          <MetricCard
            icon={PackageCheck}
            label="Completion rate"
            value={
              orderStats.data?.completionRate != null ? `${Math.round(orderStats.data.completionRate)}%` : "—"
            }
          />
          <MetricCard
            icon={Timer}
            label="Avg. delivery time"
            value={orderStats.data?.avgMinutes != null ? `${orderStats.data.avgMinutes} min` : "—"}
          />
        </div>

        {memberSince ? (
          <p className="text-center text-xs text-muted-foreground">Riding with Zentra since {memberSince}</p>
        ) : null}

        <div className="rounded-2xl border border-border bg-secondary/40 p-4">
          <p className="text-sm font-bold">What affects these numbers</p>
          <ul className="mt-2 space-y-1.5 text-xs leading-relaxed text-muted-foreground">
            <li>• Accepting job requests quickly keeps your acceptance rate healthy.</li>
            <li>• Completing a delivery once you've picked it up counts toward your completion rate.</li>
            <li>• Customers rate each delivery after it's marked delivered.</li>
          </ul>
        </div>
      </div>
    </Screen>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: typeof Star;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <Panel className="p-4">
      <Icon className="size-4 text-muted-foreground" strokeWidth={2.2} />
      <p className="mt-2 font-display text-xl font-extrabold leading-none">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{label}</p>
      {hint ? <p className="mt-1.5 text-[11px] leading-relaxed text-accent-foreground">{hint}</p> : null}
    </Panel>
  );
}
