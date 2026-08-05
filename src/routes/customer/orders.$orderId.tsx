import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Screen, PageHeader, Panel, EmptyState } from "@/components/zentra/shell";
import { StatusRail, statusLabel } from "@/components/zentra/status-rail";
import { useSession } from "@/hooks/use-session";
import { naira } from "@/lib/money";

export const Route = createFileRoute("/customer/orders/$orderId")({
  head: () => ({
    meta: [
      { title: "Order details — Zentra" },
      {
        name: "description",
        content: "Track this Zentra order from payment to the rider knocking on your gate.",
      },
    ],
  }),
  component: OrderDetailPage,
});

function OrderDetailPage() {
  const { orderId } = Route.useParams();
  const { user, loading } = useSession();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [loading, user, navigate]);

  const order = useQuery({
    queryKey: ["order-detail", orderId, user?.id],
    enabled: Boolean(user),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select(
          "id,status,subtotal_kobo,delivery_fee_kobo,service_fee_kobo,total_kobo,placed_at,cancel_reason,merchants(business_name,address_text,phone),order_items(id,quantity,unit_price_kobo,products(name))",
        )
        .eq("id", orderId)
        .eq("customer_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  return (
    <Screen>
      <PageHeader
        title={order.data ? `Order · ${statusLabel(order.data.status)}` : "Order"}
        subtitle={order.data?.merchants?.business_name ?? "Maiduguri delivery"}
      />
      <div className="space-y-4 px-4 py-6">
        {order.isLoading ? (
          <div className="h-40 animate-pulse rounded-2xl bg-secondary" />
        ) : !order.data ? (
          <EmptyState title="Order not found" body="This order doesn't exist or isn't yours." />
        ) : (
          <>
            <Panel className="p-4">
              <StatusRail status={order.data.status} />
              {order.data.status === "cancelled" && order.data.cancel_reason && (
                <p className="mt-4 text-xs text-destructive">{order.data.cancel_reason}</p>
              )}
            </Panel>

            <Panel className="space-y-3 p-4">
              <p className="text-sm font-semibold">Items</p>
              <div className="space-y-2">
                {(order.data.order_items ?? []).map((item) => (
                  <div key={item.id} className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      {item.quantity}× {item.products?.name ?? "Item"}
                    </span>
                    <span>{naira(item.unit_price_kobo * item.quantity)}</span>
                  </div>
                ))}
              </div>
            </Panel>

            <Panel className="space-y-2 p-4">
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>Subtotal</span>
                <span>{naira(order.data.subtotal_kobo)}</span>
              </div>
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>Delivery fee</span>
                <span>{naira(order.data.delivery_fee_kobo)}</span>
              </div>
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>Service fee</span>
                <span>{naira(order.data.service_fee_kobo)}</span>
              </div>
              <div className="flex items-center justify-between border-t border-border pt-2 font-display font-extrabold">
                <span>Total</span>
                <span>{naira(order.data.total_kobo)}</span>
              </div>
            </Panel>

            {order.data.merchants?.address_text && (
              <Panel className="p-4 text-sm text-muted-foreground">
                <p className="font-semibold text-foreground">Store</p>
                <p className="mt-1">{order.data.merchants.address_text}</p>
                {order.data.merchants.phone && <p className="mt-1">{order.data.merchants.phone}</p>}
              </Panel>
            )}
          </>
        )}
      </div>
    </Screen>
  );
}
