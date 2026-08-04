import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Package, Bike, Store, Wallet, Clock, RefreshCcw, LifeBuoy } from "lucide-react";
import { Bar, BarChart, CartesianGrid, XAxis, Line, LineChart, YAxis } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "@/components/admin/admin-layout";
import { StatCard } from "@/components/admin/stat-card";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { useRoleGuard } from "@/hooks/use-role-guard";
import { naira } from "@/lib/money";
import { statusLabel } from "@/components/zentra/status-rail";

export const Route = createFileRoute("/admin/")({
  head: () => ({
    meta: [
      { title: "Dashboard — Zentra Admin" },
      { name: "description", content: "Live overview of Zentra orders, riders, merchants and revenue." },
    ],
  }),
  component: DashboardPage,
});

const ACTIVE_ORDER_STATUSES = [
  "paid",
  "merchant_accepted",
  "preparing",
  "rider_assigned",
  "rider_en_route_to_merchant",
  "picked_up",
  "rider_en_route_to_customer",
];

const ORDER_STATUS_GROUPS = [
  { key: "pending", label: "Pending", statuses: ["placed", "paid"] },
  { key: "preparing", label: "Preparing", statuses: ["merchant_accepted", "preparing"] },
  { key: "picked_up", label: "Picked up", statuses: ["rider_assigned", "rider_en_route_to_merchant", "picked_up", "rider_en_route_to_customer"] },
  { key: "delivered", label: "Delivered", statuses: ["delivered"] },
  { key: "cancelled", label: "Cancelled", statuses: ["cancelled", "refunded"] },
];

const chartConfig: ChartConfig = {
  orders: { label: "Orders", color: "var(--chart-1)" },
  revenue: { label: "Revenue", color: "var(--chart-1)" },
};

function DashboardPage() {
  const { ready } = useRoleGuard("admin");

  const today = useQuery({
    queryKey: ["admin-dashboard-today"],
    enabled: ready,
    refetchInterval: 30000,
    queryFn: async () => {
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);

      const [ordersToday, ridersOnline, merchantsOnline, pendingMerchants, pendingRiders, openTickets] =
        await Promise.all([
          supabase
            .from("orders")
            .select("id,status,total_kobo", { count: "exact" })
            .gte("placed_at", startOfDay.toISOString()),
          supabase.from("riders").select("id", { count: "exact", head: true }).eq("is_online", true),
          supabase
            .from("merchants")
            .select("id", { count: "exact", head: true })
            .eq("status", "approved")
            .eq("is_open_override", true),
          supabase
            .from("merchants")
            .select("id", { count: "exact", head: true })
            .eq("status", "pending"),
          supabase.from("riders").select("id", { count: "exact", head: true }).eq("status", "pending"),
          supabase
            .from("support_tickets")
            .select("id", { count: "exact", head: true })
            .in("status", ["open", "in_progress"]),
        ]);

      return {
        ordersToday: ordersToday.data ?? [],
        ordersTodayCount: ordersToday.count ?? 0,
        ridersOnline: ridersOnline.count ?? 0,
        merchantsOnline: merchantsOnline.count ?? 0,
        pendingMerchants: pendingMerchants.count ?? 0,
        pendingRiders: pendingRiders.count ?? 0,
        openTickets: openTickets.count ?? 0,
      };
    },
  });

  const trend = useQuery({
    queryKey: ["admin-dashboard-trend"],
    enabled: ready,
    queryFn: async () => {
      const since = new Date();
      since.setDate(since.getDate() - 6);
      since.setHours(0, 0, 0, 0);

      const { data, error } = await supabase
        .from("orders")
        .select("placed_at,total_kobo,status")
        .gte("placed_at", since.toISOString());
      if (error) throw error;

      const days: { date: string; label: string; orders: number; revenue: number }[] = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        days.push({
          date: d.toDateString(),
          label: d.toLocaleDateString("en-NG", { weekday: "short" }),
          orders: 0,
          revenue: 0,
        });
      }

      for (const row of data ?? []) {
        if (!row.placed_at) continue;
        const dateStr = new Date(row.placed_at).toDateString();
        const bucket = days.find((d) => d.date === dateStr);
        if (!bucket) continue;
        bucket.orders += 1;
        if (row.status !== "cancelled" && row.status !== "refunded") {
          bucket.revenue += row.total_kobo;
        }
      }
      return days;
    },
  });

  const statusBreakdown = useQuery({
    queryKey: ["admin-dashboard-status-breakdown"],
    enabled: ready,
    refetchInterval: 30000,
    queryFn: async () => {
      const { data, error } = await supabase.from("orders").select("status").limit(2000);
      if (error) throw error;
      return ORDER_STATUS_GROUPS.map((g) => ({
        ...g,
        count: (data ?? []).filter((o) => g.statuses.includes(o.status)).length,
      }));
    },
  });

  const activeSnapshot = useQuery({
    queryKey: ["admin-dashboard-active-orders"],
    enabled: ready,
    refetchInterval: 15000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("id,status,total_kobo,merchants(business_name)")
        .in("status", ACTIVE_ORDER_STATUSES as never)
        .order("placed_at", { ascending: false })
        .limit(8);
      if (error) throw error;
      return data;
    },
  });

  if (!ready) return null;

  const revenueToday = (today.data?.ordersToday ?? [])
    .filter((o) => o.status !== "cancelled" && o.status !== "refunded")
    .reduce((sum, o) => sum + o.total_kobo, 0);

  return (
    <AdminLayout title="Dashboard" subtitle="Maiduguri operations, live">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Today's orders" value={String(today.data?.ordersTodayCount ?? 0)} icon={Package} />
        <StatCard label="Active riders" value={String(today.data?.ridersOnline ?? 0)} icon={Bike} />
        <StatCard label="Online merchants" value={String(today.data?.merchantsOnline ?? 0)} icon={Store} />
        <StatCard label="Revenue today" value={naira(revenueToday)} icon={Wallet} />
        <StatCard
          label="Pending merchants"
          value={String(today.data?.pendingMerchants ?? 0)}
          icon={Clock}
          tone="warning"
        />
        <StatCard label="Pending riders" value={String(today.data?.pendingRiders ?? 0)} icon={Clock} tone="warning" />
        <StatCard
          label="Refund requests"
          value={String((statusBreakdown.data?.find((g) => g.key === "cancelled")?.count ?? 0))}
          icon={RefreshCcw}
        />
        <StatCard label="Support tickets" value={String(today.data?.openTickets ?? 0)} icon={LifeBuoy} tone="warning" />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <p className="text-sm font-semibold text-foreground">Orders, last 7 days</p>
          <ChartContainer config={chartConfig} className="mt-4 h-56 w-full">
            <BarChart data={trend.data ?? []}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={12} />
              <YAxis tickLine={false} axisLine={false} fontSize={12} width={28} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="orders" fill="var(--color-orders)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ChartContainer>
        </div>

        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <p className="text-sm font-semibold text-foreground">Revenue, last 7 days</p>
          <ChartContainer config={chartConfig} className="mt-4 h-56 w-full">
            <LineChart data={trend.data ?? []}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={12} />
              <YAxis
                tickLine={false}
                axisLine={false}
                fontSize={12}
                width={44}
                tickFormatter={(v) => `₦${Math.round(v / 1000)}k`}
              />
              <ChartTooltip content={<ChartTooltipContent formatter={(v) => naira(Number(v))} />} />
              <Line
                type="monotone"
                dataKey="revenue"
                stroke="var(--color-revenue)"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ChartContainer>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-[1fr_1.3fr]">
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <p className="text-sm font-semibold text-foreground">Order status</p>
          <div className="mt-4 space-y-3">
            {(statusBreakdown.data ?? ORDER_STATUS_GROUPS.map((g) => ({ ...g, count: 0 }))).map((g) => {
              const max = Math.max(1, ...(statusBreakdown.data ?? []).map((x) => x.count));
              const pct = Math.round((g.count / max) * 100);
              return (
                <div key={g.key}>
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-muted-foreground">{g.label}</span>
                    <span className="font-semibold text-foreground">{g.count}</span>
                  </div>
                  <div className="mt-1 h-2 rounded-full bg-secondary">
                    <div
                      className="h-2 rounded-full bg-primary transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-foreground">Live operations map</p>
            <span className="rounded-full bg-accent-soft px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-accent-foreground">
              Not connected
            </span>
          </div>
          <div className="mt-4 flex h-56 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-secondary/50 text-center">
            <p className="max-w-xs text-xs text-muted-foreground">
              A live map needs a mapping provider (Google Maps or Mapbox) wired in with an API key —
              let me know which one you use and I'll connect rider and order pins here.
            </p>
          </div>

          <p className="mt-5 text-xs font-bold uppercase tracking-wide text-muted-foreground">
            Active orders right now
          </p>
          <div className="mt-2 divide-y divide-border">
            {(activeSnapshot.data ?? []).length === 0 ? (
              <p className="py-4 text-center text-xs text-muted-foreground">Nothing in flight right now.</p>
            ) : (
              (activeSnapshot.data ?? []).map((o) => (
                <div key={o.id} className="flex items-center justify-between py-2 text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-foreground">
                      {o.merchants?.business_name ?? "Store"}
                    </p>
                    <p className="text-xs text-muted-foreground">{statusLabel(o.status)}</p>
                  </div>
                  <span className="shrink-0 font-display text-sm font-bold text-foreground">
                    {naira(o.total_kobo)}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
