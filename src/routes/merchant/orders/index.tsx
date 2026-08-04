import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Clock, Package } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { MerchantLayout } from "@/components/zentra/merchant-layout";
import { statusLabel } from "@/components/zentra/status-rail";
import { naira } from "@/lib/money";
import { useMerchantPermissions } from "@/hooks/use-merchant-permissions";

export const Route = createFileRoute("/merchant/orders/")({
  head: () => ({
    meta: [
      { title: "Orders – Merchant" },
      { name: "description", content: "Incoming and in-progress orders for your store." },
    ],
  }),
  component: MerchantOrdersPage,
});

// Statuses a merchant is actively responsible for moving forward.
// Once an order reaches "rider_assigned" it's the rider's job from here.
const ACTIVE_STATUSES = ["paid", "merchant_accepted", "preparing"] as const;

// What a merchant can move an order to next, and the button label for it.
const NEXT_ACTION: Partial<Record<string, { next: string; label: string }>> = {
  paid: { next: "merchant_accepted", label: "Accept order" },
  merchant_accepted: { next: "preparing", label: "Start preparing" },
  preparing: { next: "rider_assigned", label: "Mark ready for pickup" },
};

const STATUS_FILTERS = ["active", "completed", "all"] as const;

function MerchantOrdersPage() {
  const { storeId, permissions, isLoading: permsLoading } = useMerchantPermissions();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<(typeof STATUS_FILTERS)[number]>("active");

  // All hooks must run unconditionally, on every render, in the same
  // order — never place a hook call after an early `return`. We gate
  // the query itself with `enabled` and gate what we *render* below.
  const orders = useQuery({
    queryKey: ["merchant-orders", storeId, filter],
    enabled: Boolean(storeId),
    queryFn: async () => {
      let query = supabase
        .from("orders")
        .select("id, status, total_kobo, subtotal_kobo, placed_at, order_items(quantity, products(name))")
        .eq("merchant_id", storeId)
        .order("placed_at", { ascending: false });

      if (filter === "active") {
        query = query.in("status", ACTIVE_STATUSES as unknown as string[]);
      } else if (filter === "completed") {
        query = query.in("status", ["delivered", "cancelled", "refunded"]);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  if (permsLoading) return <MerchantLayout>Loading...</MerchantLayout>;
  if (!storeId) return <MerchantLayout>No store found.</MerchantLayout>;

  const canManageOrders = permissions?.orders === "full" || permissions?.orders === "view";
  const canUpdateOrders = permissions?.orders === "full";
  if (!canManageOrders) {
    return <MerchantLayout><p>You don't have permission to view orders.</p></MerchantLayout>;
  }

  async function advanceOrder(orderId: string, nextStatus: string) {
    const { error } = await supabase
      .from("orders")
      .update({ status: nextStatus as never })
      .eq("id", orderId);
    if (error) {
      toast.error("Could not update order", { description: error.message });
      return;
    }
    toast.success("Order updated");
    queryClient.invalidateQueries({ queryKey: ["merchant-orders", storeId] });
    queryClient.invalidateQueries({ queryKey: ["merchant-dashboard-stats", storeId] });
    queryClient.invalidateQueries({ queryKey: ["merchant-recent-orders", storeId] });
  }

  const orderList = orders.data ?? [];

  return (
    <MerchantLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">Orders</h2>
        </div>

        <div className="flex gap-2">
          {STATUS_FILTERS.map(f => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`rounded-full px-3 py-1 text-xs font-bold capitalize transition-colors ${
                filter === f
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-muted-foreground"
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        {orders.isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-20 animate-pulse rounded-xl bg-secondary" />
            ))}
          </div>
        ) : orders.error ? (
          <div className="text-center py-10">
            <p className="text-destructive font-semibold">Could not load orders</p>
            <p className="text-sm text-muted-foreground mt-1">Please try refreshing the page.</p>
          </div>
        ) : orderList.length === 0 ? (
          <div className="text-center py-10">
            <Package className="mx-auto size-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground mt-2">No orders here yet.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {orderList.map(o => {
              const action = NEXT_ACTION[o.status];
              const itemSummary = o.order_items?.[0]?.products?.name
                ? `${o.order_items[0].quantity}× ${o.order_items[0].products.name}`
                : "Order";
              const extra = o.order_items?.length && o.order_items.length > 1
                ? ` +${o.order_items.length - 1} more`
                : "";
              return (
                <div key={o.id} className="rounded-xl border border-border p-3 bg-card space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">{itemSummary}{extra}</p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                        <Clock className="size-3" />
                        {statusLabel(o.status)}
                      </p>
                    </div>
                    <span className="font-display font-bold">{naira(o.total_kobo)}</span>
                  </div>
                  {action && canUpdateOrders && (
                    <button
                      type="button"
                      onClick={() => advanceOrder(o.id, action.next)}
                      className="w-full rounded-lg bg-primary py-2 text-xs font-bold text-primary-foreground"
                    >
                      {action.label}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </MerchantLayout>
  );
}
