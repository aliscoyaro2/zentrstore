import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Clock, Package, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { MerchantLayout } from "@/components/zentra/merchant-layout";
import { AdminStatusBadge } from "@/components/admin/admin-status-badge";
import { statusLabel } from "@/components/zentra/status-rail";
import { naira } from "@/lib/money";

export const Route = createFileRoute("/merchant/orders/")({
  head: () => ({
    meta: [{ title: "Orders – Merchant" }],
  }),
  component: MerchantOrdersPage,
});

const STATUS_TABS = [
  { id: "all", label: "All" },
  { id: "pending", label: "Pending" },
  { id: "active", label: "Active" },
  { id: "completed", label: "Completed" },
  { id: "cancelled", label: "Cancelled" },
] as const;

type OrderStatusTab = typeof STATUS_TABS[number]["id"];

function MerchantOrdersPage() {
  const [activeTab, setActiveTab] = useState<OrderStatusTab>("pending");

  // Get store ID
  const { data: store } = useQuery({
    queryKey: ["merchant-store-id"],
    queryFn: async () => {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) return null;
      
      const { data, error } = await supabase
        .from("merchants")
        .select("id,lat,lng")
        .eq("owner_id", user.user.id)
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
  });

  const storeId = store?.id;

  // Fetch orders directly - REMOVED merchant_accepted_at column
  const orders = useQuery({
    queryKey: ["merchant-orders", storeId, activeTab],
    enabled: Boolean(storeId),
    refetchInterval: 15000,
    queryFn: async () => {
      let query = supabase
        .from("orders")
        .select(`
          id,
          status,
          total_kobo,
          placed_at,
          paid_at,
          prep_time_mins,
          pickup_code,
          customer_id,
          profiles:customer_id (
            full_name,
            phone
          ),
          addresses (
            lat,
            lng
          ),
          riders (
            current_lat,
            current_lng
          ),
          order_items (
            id,
            quantity,
            unit_price_kobo,
            products (
              name
            )
          )
        `)
        .eq("merchant_id", storeId!)
        .order("placed_at", { ascending: false });

      if (activeTab === "pending") {
        query = query.in("status", [
          "placed",
          "created",
          "payment_pending",
          "paid",
          "merchant_pending"
        ]);
      } else if (activeTab === "active") {
        query = query.in("status", [
          "merchant_accepted",
          "preparing",
          "ready_for_pickup",
          "rider_assigned",
          "rider_en_route_to_merchant",
          "picked_up",
          "rider_en_route_to_customer"
        ]);
      } else if (activeTab === "completed") {
        query = query.in("status", ["delivered", "completed"]);
      } else if (activeTab === "cancelled") {
        query = query.in("status", [
          "cancelled",
          "refunded",
          "merchant_rejected"
        ]);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    retry: 1,
  });

  if (!storeId) {
    return (
      <MerchantLayout>
        <div className="text-center py-10">
          <AlertCircle className="mx-auto size-8 text-muted-foreground" />
          <p className="mt-2 text-sm text-muted-foreground">No store found.</p>
        </div>
      </MerchantLayout>
    );
  }

  if (orders.isLoading) {
    return (
      <MerchantLayout>
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-32 animate-pulse rounded-xl bg-secondary" />
          ))}
        </div>
      </MerchantLayout>
    );
  }

  if (orders.error) {
    return (
      <MerchantLayout>
        <div className="text-center py-10">
          <AlertCircle className="mx-auto size-8 text-destructive" />
          <p className="mt-2 text-sm text-destructive">Failed to load orders</p>
          <p className="text-xs text-muted-foreground">
            {orders.error instanceof Error ? orders.error.message : "Unknown error"}
          </p>
          <button
            type="button"
            onClick={() => orders.refetch()}
            className="mt-4 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground"
          >
            Retry
          </button>
        </div>
      </MerchantLayout>
    );
  }

  const rows = orders.data ?? [];
  const pendingCount = rows.filter(o =>
    o.status === "paid" || o.status === "merchant_pending" || o.status === "placed"
  ).length;

  return (
    <MerchantLayout>
      <div className="space-y-4">
        {/* Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {STATUS_TABS.map((tab) => {
            const count = tab.id === "pending" ? pendingCount : 0;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition-colors ${
                  activeTab === tab.id
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-muted-foreground hover:bg-secondary/70"
                }`}
              >
                {tab.label}
                {count > 0 && (
                  <span className="grid size-4 place-items-center rounded-full bg-destructive text-[9px] font-bold text-destructive-foreground">
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Orders List */}
        {rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Package className="size-12 text-muted-foreground/30" />
            <p className="mt-3 font-medium">No orders in this status</p>
            <p className="text-sm text-muted-foreground">
              {activeTab === "pending" ? "New orders will appear here." : "Check other tabs."}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {rows.map((order) => {
              const isPending = order.status === "paid" || order.status === "merchant_pending" || order.status === "placed";

              return (
                <Link
                  key={order.id}
                  to="/merchant/orders/$orderId"
                  params={{ orderId: order.id }}
                  className={`block rounded-xl border p-4 bg-card transition-shadow active:scale-[0.99] ${
                    isPending ? "border-primary/30 bg-primary/5" : "border-border"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold">
                          #{order.id.slice(0, 8)}
                        </p>
                        <AdminStatusBadge status={order.status} label={statusLabel(order.status)} />
                        {isPending && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-accent/20 px-2 py-0.5 text-[10px] font-bold text-accent-foreground">
                            <Clock className="size-3" />
                            New
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        {order.profiles?.full_name || "Customer"} · {order.profiles?.phone || ""}
                      </p>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {(order.order_items ?? []).map((item, idx) => (
                          <span key={idx} className="text-xs bg-secondary px-2 py-0.5 rounded-full">
                            {item.quantity}× {item.products?.name || "Item"}
                          </span>
                        ))}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {order.placed_at ? new Date(order.placed_at).toLocaleString() : ""}
                      </p>
                    </div>
                    <div className="text-right shrink-0 pl-2">
                      <p className="font-display font-bold">{naira(order.total_kobo)}</p>
                      {order.prep_time_mins && (
                        <p className="text-xs text-muted-foreground">
                          Prep: {order.prep_time_mins} min
                        </p>
                      )}
                      {order.status === "ready_for_pickup" && order.pickup_code && (
                        <p className="mt-1 font-display text-sm font-extrabold tracking-[0.2em] text-primary">
                          {order.pickup_code}
                        </p>
                      )}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </MerchantLayout>
  );
}