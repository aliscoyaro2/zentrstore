import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Clock, CheckCircle2, XCircle, Package, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { MerchantLayout } from "@/components/zentra/merchant-layout";
import { AdminStatusBadge } from "@/components/admin/admin-status-badge";
import { statusLabel } from "@/components/zentra/status-rail";
import { naira } from "@/lib/money";
import {
  merchantAcceptOrder,
  merchantRejectOrder,
  merchantMarkReady,
} from "@/lib/merchant-order.functions";

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
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<OrderStatusTab>("pending");
  const [prepTime, setPrepTime] = useState<number>(15);
  const [rejectReason, setRejectReason] = useState("");
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [showRejectModal, setShowRejectModal] = useState(false);

  // Get store ID
  const { data: store } = useQuery({
    queryKey: ["merchant-store-id"],
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
          customer_id,
          profiles:customer_id (
            full_name,
            phone
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

  async function handleAccept(orderId: string) {
    try {
      await merchantAcceptOrder({
        data: {
          orderId,
          prepTimeMins: prepTime,
        },
      });
      toast.success("Order accepted!");
      setPrepTime(15);
      queryClient.invalidateQueries({ queryKey: ["merchant-orders", storeId] });
    } catch (err) {
      toast.error("Could not accept", { description: err instanceof Error ? err.message : undefined });
    }
  }

  async function handleReject(orderId: string) {
    if (!rejectReason.trim()) {
      toast.error("Please provide a reason for rejecting.");
      return;
    }
    try {
      await merchantRejectOrder({
        data: {
          orderId,
          reason: rejectReason.trim(),
        },
      });
      toast.success("Order rejected");
      setRejectReason("");
      setShowRejectModal(false);
      setSelectedOrderId(null);
      queryClient.invalidateQueries({ queryKey: ["merchant-orders", storeId] });
    } catch (err) {
      toast.error("Could not reject", { description: err instanceof Error ? err.message : undefined });
    }
  }

  async function handleMarkReady(orderId: string) {
    try {
      await merchantMarkReady({ data: { orderId } });
      toast.success("Order marked ready!");
      queryClient.invalidateQueries({ queryKey: ["merchant-orders", storeId] });
    } catch (err) {
      toast.error("Could not mark ready", { description: err instanceof Error ? err.message : undefined });
    }
  }

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
              const isReadyable = order.status === "merchant_accepted";

              return (
                <div
                  key={order.id}
                  className={`rounded-xl border p-4 bg-card transition-shadow ${
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
                    <div className="text-right">
                      <p className="font-display font-bold">{naira(order.total_kobo)}</p>
                      {order.prep_time_mins && (
                        <p className="text-xs text-muted-foreground">
                          Prep: {order.prep_time_mins} min
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="mt-3 flex flex-wrap gap-2">
                    {isPending && (
                      <>
                        <div className="flex items-center gap-2">
                          <select
                            value={prepTime}
                            onChange={(e) => setPrepTime(Number(e.target.value))}
                            className="rounded-lg border border-border bg-background px-2 py-1.5 text-xs"
                          >
                            {[5, 10, 15, 20, 25, 30, 45, 60].map(m => (
                              <option key={m} value={m}>{m} min</option>
                            ))}
                          </select>
                          <button
                            type="button"
                            onClick={() => handleAccept(order.id)}
                            className="rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground"
                          >
                            <span className="flex items-center gap-1">
                              <CheckCircle2 className="size-3.5" />
                              Accept
                            </span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedOrderId(order.id);
                              setShowRejectModal(true);
                            }}
                            className="rounded-lg border border-destructive px-3 py-1.5 text-xs font-bold text-destructive"
                          >
                            <span className="flex items-center gap-1">
                              <XCircle className="size-3.5" />
                              Reject
                            </span>
                          </button>
                        </div>
                      </>
                    )}

                    {isReadyable && (
                      <button
                        type="button"
                        onClick={() => handleMarkReady(order.id)}
                        className="rounded-lg bg-accent px-3 py-1.5 text-xs font-bold text-accent-foreground"
                      >
                        <span className="flex items-center gap-1">
                          <Package className="size-3.5" />
                          Mark Ready for Pickup
                        </span>
                      </button>
                    )}

                    {order.status === "preparing" && (
                      <button
                        type="button"
                        disabled
                        className="rounded-lg bg-secondary px-3 py-1.5 text-xs font-bold text-muted-foreground"
                      >
                        <span className="flex items-center gap-1">
                          <Clock className="size-3.5 animate-pulse" />
                          Looking for rider...
                        </span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Reject Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowRejectModal(false)}>
          <div className="w-full max-w-sm rounded-xl bg-card p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-display text-lg font-bold">Reject Order</h3>
            <p className="mt-1 text-sm text-muted-foreground">Why are you rejecting this order?</p>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={3}
              placeholder="e.g. Item unavailable, store closed..."
              className="mt-3 w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowRejectModal(false);
                  setRejectReason("");
                  setSelectedOrderId(null);
                }}
                className="flex-1 rounded-lg border border-border py-2 text-sm font-bold text-muted-foreground"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => selectedOrderId && handleReject(selectedOrderId)}
                className="flex-1 rounded-lg bg-destructive py-2 text-sm font-bold text-destructive-foreground"
              >
                Reject Order
              </button>
            </div>
          </div>
        </div>
      )}
    </MerchantLayout>
  );
}