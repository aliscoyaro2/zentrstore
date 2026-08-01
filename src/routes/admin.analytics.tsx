import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, Line, LineChart } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "@/components/admin/admin-layout";
import { StatCard } from "@/components/admin/stat-card";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { useRoleGuard } from "@/hooks/use-role-guard";
import { naira } from "@/lib/money";
import { TrendingUp, Clock, XCircle, Users } from "lucide-react";

export const Route = createFileRoute("/admin/analytics")({
  head: () => ({
    meta: [
      { title: "Analytics — Zentra Admin" },
      { name: "description", content: "Revenue, order and performance trends across Zentra." },
    ],
  }),
  component: AnalyticsPage,
});

const chartConfig: ChartConfig = {
  orders: { label: "Orders", color: "var(--chart-1)" },
  revenue: { label: "Revenue", color: "var(--chart-2)" },
};

const DONE_STATUSES = ["delivered"];
const LOST_STATUSES = ["cancelled", "refunded"];

function AnalyticsPage() {
  const { ready } = useRoleGuard("admin");

  // Raw 30-day order slice — every derived metric below reads from this
  // single query so the page stays cheap on Supabase calls.
  const orders30d = useQuery({
    queryKey: ["admin-analytics-orders-30d"],
    enabled: ready,
    queryFn: async () => {
      const since = new Date();
      since.setDate(since.getDate() - 29);
      since.setHours(0, 0, 0, 0);

      const { data, error } = await supabase
        .from("orders")
        .select("id,status,total_kobo,placed_at,delivered_at,merchant_id,rider_id,merchants(business_name)")
        .gte("placed_at", since.toISOString());
      if (error) throw error;
      return data;
    },
  });

  const riders = useQuery({
    queryKey: ["admin-analytics-riders"],
    enabled: ready,
    queryFn: async () => {
      const { data, error } = await supabase.from("riders").select("id,vehicle_make,plate_number,rating_avg");
      if (error) throw error;
      return data;
    },
  });

  const newCustomers30d = useQuery({
    queryKey: ["admin-analytics-new-customers"],
    enabled: ready,
    queryFn: async () => {
      const since = new Date();
      since.setDate(since.getDate() - 29);
      since.setHours(0, 0, 0, 0);
      const { count, error } = await supabase
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("role", "customer")
        .gte("created_at", since.toISOString());
      if (error) throw error;
      return count ?? 0;
    },
  });

  if (!ready) return null;

  const rows = orders30d.data ?? [];
  const completed = rows.filter((r) => DONE_STATUSES.includes(r.status));
  const lost = rows.filter((r) => LOST_STATUSES.includes(r.status));
  const revenueTotal = completed.reduce((sum, r) => sum + r.total_kobo, 0);

  // Daily trend buckets
  const days: { date: string; label: string; orders: number; revenue: number }[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push({ date: d.toDateString(), label: d.toLocaleDateString("en-NG", { day: "2-digit", month: "short" }), orders: 0, revenue: 0 });
  }
  for (const r of rows) {
    if (!r.placed_at) continue;
    const bucket = days.find((d) => d.date === new Date(r.placed_at!).toDateString());
    if (!bucket) continue;
    bucket.orders += 1;
    if (!LOST_STATUSES.includes(r.status)) bucket.revenue += r.total_kobo;
  }

  // Top merchants by revenue
  const merchantMap = new Map<string, { name: string; revenue: number; orders: number }>();
  for (const r of completed) {
    if (!r.merchant_id) continue;
    const name = r.merchants?.business_name ?? "Store";
    const cur = merchantMap.get(r.merchant_id) ?? { name, revenue: 0, orders: 0 };
    cur.revenue += r.total_kobo;
    cur.orders += 1;
    merchantMap.set(r.merchant_id, cur);
  }
  const topMerchants = [...merchantMap.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 6);

  // Top riders by completed deliveries
  const riderCounts = new Map<string, number>();
  for (const r of completed) {
    if (!r.rider_id) continue;
    riderCounts.set(r.rider_id, (riderCounts.get(r.rider_id) ?? 0) + 1);
  }
  const riderById = new Map((riders.data ?? []).map((r) => [r.id, r]));
  const topRiders = [...riderCounts.entries()]
    .map(([id, count]) => ({ id, count, rider: riderById.get(id) }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);

  // Peak hours (0-23) from placed_at
  const hourBuckets = Array.from({ length: 24 }, (_, h) => ({ hour: h, label: `${h}:00`, orders: 0 }));
  for (const r of rows) {
    if (!r.placed_at) continue;
    const h = new Date(r.placed_at).getHours();
    hourBuckets[h].orders += 1;
  }
  const peakHour = [...hourBuckets].sort((a, b) => b.orders - a.orders)[0];

  // Avg delivery time (placed -> delivered), minutes
  const deliveryTimes = completed
    .filter((r) => r.placed_at && r.delivered_at)
    .map((r) => (new Date(r.delivered_at!).getTime() - new Date(r.placed_at!).getTime()) / 60000);
  const avgDeliveryMins =
    deliveryTimes.length > 0 ? Math.round(deliveryTimes.reduce((a, b) => a + b, 0) / deliveryTimes.length) : null;

  const cancellationRate = rows.length > 0 ? Math.round((lost.length / rows.length) * 100) : 0;

  return (
    <AdminLayout title="Analytics" subtitle="Last 30 days across Zentra">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Revenue (30d)" value={naira(revenueTotal)} icon={TrendingUp} />
        <StatCard
          label="Avg delivery time"
          value={avgDeliveryMins !== null ? `${avgDeliveryMins} min` : "—"}
          icon={Clock}
        />
        <StatCard label="Cancellation rate" value={`${cancellationRate}%`} icon={XCircle} tone={cancellationRate > 15 ? "warning" : "default"} />
        <StatCard label="New customers (30d)" value={String(newCustomers30d.data ?? 0)} icon={Users} />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <p className="text-sm font-semibold text-foreground">Revenue, last 30 days</p>
          <ChartContainer config={chartConfig} className="mt-4 h-56 w-full">
            <LineChart data={days}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={10} interval={4} />
              <YAxis tickLine={false} axisLine={false} fontSize={12} width={44} tickFormatter={(v) => `₦${Math.round(v / 1000)}k`} />
              <ChartTooltip content={<ChartTooltipContent formatter={(v) => naira(Number(v))} />} />
              <Line type="monotone" dataKey="revenue" stroke="var(--color-revenue)" strokeWidth={2} dot={false} />
            </LineChart>
          </ChartContainer>
        </div>

        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <p className="text-sm font-semibold text-foreground">Orders, last 30 days</p>
          <ChartContainer config={chartConfig} className="mt-4 h-56 w-full">
            <BarChart data={days}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={10} interval={4} />
              <YAxis tickLine={false} axisLine={false} fontSize={12} width={28} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="orders" fill="var(--color-orders)" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ChartContainer>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <p className="text-sm font-semibold text-foreground">Top merchants by revenue</p>
          <div className="mt-3 divide-y divide-border">
            {topMerchants.length === 0 ? (
              <p className="py-6 text-center text-xs text-muted-foreground">No completed orders in the last 30 days.</p>
            ) : (
              topMerchants.map((m, i) => (
                <div key={m.name + i} className="flex items-center justify-between py-2.5 text-sm">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="grid size-6 shrink-0 place-items-center rounded-full bg-secondary text-[11px] font-bold text-muted-foreground">
                      {i + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate font-medium text-foreground">{m.name}</p>
                      <p className="text-xs text-muted-foreground">{m.orders} orders</p>
                    </div>
                  </div>
                  <span className="shrink-0 font-display text-sm font-bold text-foreground">{naira(m.revenue)}</span>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <p className="text-sm font-semibold text-foreground">Top riders by deliveries</p>
          <div className="mt-3 divide-y divide-border">
            {topRiders.length === 0 ? (
              <p className="py-6 text-center text-xs text-muted-foreground">No completed deliveries in the last 30 days.</p>
            ) : (
              topRiders.map((r, i) => (
                <div key={r.id} className="flex items-center justify-between py-2.5 text-sm">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="grid size-6 shrink-0 place-items-center rounded-full bg-secondary text-[11px] font-bold text-muted-foreground">
                      {i + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate font-medium text-foreground">
                        {r.rider?.vehicle_make ?? "Rider"} {r.rider?.plate_number ?? ""}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {r.rider?.rating_avg ? `★ ${r.rider.rating_avg.toFixed(1)}` : "No rating yet"}
                      </p>
                    </div>
                  </div>
                  <span className="shrink-0 font-display text-sm font-bold text-foreground">{r.count} deliveries</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="mt-6 rounded-xl border border-border bg-card p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-foreground">Orders by hour of day</p>
          {peakHour && peakHour.orders > 0 ? (
            <span className="rounded-full bg-accent-soft px-2.5 py-1 text-[11px] font-bold text-accent-foreground">
              Peak: {peakHour.label} ({peakHour.orders} orders)
            </span>
          ) : null}
        </div>
        <ChartContainer config={chartConfig} className="mt-4 h-48 w-full">
          <BarChart data={hourBuckets}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={9} interval={2} />
            <YAxis tickLine={false} axisLine={false} fontSize={12} width={28} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Bar dataKey="orders" fill="var(--color-orders)" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ChartContainer>
      </div>
    </AdminLayout>
  );
}
