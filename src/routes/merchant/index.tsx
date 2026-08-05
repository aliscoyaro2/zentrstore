import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Package, Clock, TrendingUp, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { MerchantLayout } from "@/components/zentra/merchant-layout";
import { StatCard } from "@/components/admin/stat-card";
import { statusLabel } from "@/components/zentra/status-rail";
import { naira } from "@/lib/money";

export const Route = createFileRoute("/merchant/")({
  head: () => ({
    meta: [
      { title: "Merchant Dashboard – Zentra" },
      { name: "description", content: "Manage your store, orders and products." },
    ],
  }),
  component: MerchantDashboard,
});

function MerchantDashboard() {
  // ✅ ALL HOOKS FIRST, UNCONDITIONALLY

  // Get store ID
  const { data: store } = useQuery({
    queryKey: ["merchant-dashboard-store"],
    queryFn: async () => {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) return null;
      const { data, error } = await supabase
        .from("merchants")
        .select("id")
        .eq("owner_id", user.user.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    retry: 1,
  });

  const storeId = store?.id;

  // Dashboard stats
  const stats = useQuery({
    queryKey: ["merchant-dashboard-stats", storeId],
    enabled: Boolean(storeId),
    queryFn: async () => {
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);

      const [ordersToday, allOrders, revenueToday] = await Promise.all([
        supabase
          .from("orders")
          .select("id,status", { count: "exact", head: false })
          .eq("merchant_id", storeId!)
          .gte("placed_at", startOfDay.toISOString()),
        supabase
          .from("orders")
          .select("status", { count: "exact", head: false })
          .eq("merchant_id", storeId!),
        supabase
          .from("orders")
          .select("total_kobo,status")
          .eq("merchant_id", storeId!)
          .gte("placed_at", startOfDay.toISOString()),
      ]);

      const todayCount = ordersToday.count ?? 0;
      const totalOrders = allOrders.count ?? 0;
      const revenue = (revenueToday.data ?? [])
        .filter(o => o.status !== "cancelled" && o.status !== "refunded")
        .reduce((sum, o) => sum + o.total_kobo, 0);

      const pending = (ordersToday.data ?? []).filter(o =>
        o.status === "paid" || o.status === "merchant_pending" || o.status === "placed"
      ).length;

      return { todayCount, totalOrders, revenue, pending };
    },
    retry: 1,
  });

  // Pending orders count
  const pendingOrders = useQuery({
    queryKey: ["merchant-pending-count", storeId],
    enabled: Boolean(storeId),
    refetchInterval: 15000,
    queryFn: async () => {
      const { count, error } = await supabase
        .from("orders")
        .select("id", { count: "exact", head: true })
        .eq("merchant_id", storeId!)
        .in("status", ["placed", "paid", "merchant_pending"]);
      if (error) throw error;
      return count || 0;
    },
    retry: 1,
  });

  // Recent orders
  const recentOrders = useQuery({
    queryKey: ["merchant-recent-orders", storeId],
    enabled: Boolean(storeId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("id, status, total_kobo, placed_at, order_items(quantity, products(name))")
        .eq("merchant_id", storeId!)
        .order("placed_at", { ascending: false })
        .limit(5);
      if (error) throw error;
      return data;
    },
    retry: 1,
  });

  // ✅ EARLY RETURNS AFTER ALL HOOKS
  if (!storeId) {
    return (
      <MerchantLayout>
        <div className="text-center py-10">
          <AlertCircle className="mx-auto size-8 text-muted-foreground" />
          <p className="mt-2 text-sm text-muted-foreground">No store associated with this account.</p>
        </div>
      </MerchantLayout>
    );
  }

  if (stats.isLoading || recentOrders.isLoading || pendingOrders.isLoading) {
    return (
      <MerchantLayout>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-20 animate-pulse rounded-xl bg-secondary" />
            ))}
          </div>
          <div className="h-40 animate-pulse rounded-xl bg-secondary" />
        </div>
      </MerchantLayout>
    );
  }

  if (stats.error || recentOrders.error) {
    return (
      <MerchantLayout>
        <div className="text-center py-10">
          <AlertCircle className="mx-auto size-8 text-destructive" />
          <p className="mt-2 text-sm text-destructive">Could not load dashboard data</p>
          <button
            type="button"
            onClick={() => { stats.refetch(); recentOrders.refetch(); }}
            className="mt-4 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground"
          >
            Retry
          </button>
        </div>
      </MerchantLayout>
    );
  }

  const data = stats.data;
  const orders = recentOrders.data ?? [];

  return (
    <MerchantLayout>
      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-3">
          <StatCard label="Today's orders" value={String(data?.todayCount ?? 0)} icon={Package} />
          <StatCard label="Revenue today" value={naira(data?.revenue ?? 0)} icon={TrendingUp} />
          <StatCard
            label="Pending orders"
            value={String(pendingOrders.data ?? 0)}
            icon={Clock}
            tone={pendingOrders.data > 0 ? "warning" : "default"}
          />
          <StatCard label="Total orders" value={String(data?.totalOrders ?? 0)} icon={Package} />
        </div>

        <div>
          <h2 className="text-sm font-semibold mb-3">Recent orders</h2>
          <div className="space-y-2">
            {orders.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No orders yet.</p>
            ) : (
              orders.map(o => (
                <div key={o.id} className="flex items-center justify-between rounded-xl border border-border p-3 bg-card">
                  <div>
                    <p className="text-sm font-medium">
                      {o.order_items?.[0]?.products?.name
                        ? `${o.order_items[0].quantity}× ${o.order_items[0].products.name}`
                        : "Order"}
                      {o.order_items?.length && o.order_items.length > 1 && ` +${o.order_items.length - 1} more`}
                    </p>
                    <p className="text-xs text-muted-foreground">{statusLabel(o.status)}</p>
                  </div>
                  <span className="font-display font-bold">{naira(o.total_kobo)}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </MerchantLayout>
  );
}