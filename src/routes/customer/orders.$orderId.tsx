import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, Loader2, MapPin, TriangleAlert } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Screen, PageHeader, Panel, EmptyState } from "@/components/zentra/shell";
import { StatusRail, statusLabel } from "@/components/zentra/status-rail";
import { useSession } from "@/hooks/use-session";
import { naira } from "@/lib/money";
import { OrderRouteMap } from "@/components/zentra/map/order-route-map";

const RIDER_IN_FLIGHT_STATUSES = ["rider_assigned", "rider_en_route_to_merchant", "picked_up", "rider_en_route_to_customer"];

// Statuses that should keep polling: rider in flight, or waiting on the
// customer to confirm (delivered) since that can also change from the
// 24h auto-complete safety net running server-side.
const POLLING_STATUSES = [...RIDER_IN_FLIGHT_STATUSES, "delivered"];

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
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [loading, user, navigate]);

  const order = useQuery({
    queryKey: ["order-detail", orderId, user?.id],
    enabled: Boolean(user),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status && POLLING_STATUSES.includes(status) ? 8000 : false;
    },
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select(
          "id,status,subtotal_kobo,delivery_fee_kobo,service_fee_kobo,total_kobo,placed_at,cancel_reason,customer_report_reason,merchants(business_name,address_text,phone,lat,lng),addresses(formatted,landmark,lat,lng),riders(current_lat,current_lng),order_items(id,quantity,unit_price_kobo,products(name))",
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

            {order.data.status === "delivered" && (
              <DeliveryConfirmationPanel
                orderId={order.data.id}
                reportedReason={order.data.customer_report_reason}
                onDone={() => {
                  queryClient.invalidateQueries({ queryKey: ["order-detail", orderId, user?.id] });
                }}
              />
            )}

            {order.data.merchants?.lat != null &&
              order.data.merchants?.lng != null &&
              order.data.addresses?.lat != null &&
              order.data.addresses?.lng != null && (
                <Panel className="overflow-hidden p-0">
                  <OrderRouteMap
                    merchant={{
                      lat: order.data.merchants.lat,
                      lng: order.data.merchants.lng,
                      label: order.data.merchants.business_name ?? "Store",
                    }}
                    customer={{
                      lat: order.data.addresses.lat,
                      lng: order.data.addresses.lng,
                      label: order.data.addresses.formatted ?? "Delivery address",
                    }}
                    rider={
                      RIDER_IN_FLIGHT_STATUSES.includes(order.data.status) &&
                      order.data.riders?.current_lat != null &&
                      order.data.riders?.current_lng != null
                        ? { lat: order.data.riders.current_lat, lng: order.data.riders.current_lng }
                        : null
                    }
                    className="h-56 w-full rounded-none border-0"
                  />
                </Panel>
              )}

            {order.data.addresses?.formatted && (
              <Panel className="flex items-start gap-3 p-4">
                <MapPin className="mt-0.5 size-4 shrink-0 text-primary" strokeWidth={2.2} />
                <div className="min-w-0">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    Delivery address
                  </p>
                  <p className="mt-0.5 text-sm text-foreground">{order.data.addresses.formatted}</p>
                  {order.data.addresses.landmark && (
                    <p className="mt-0.5 text-xs text-muted-foreground">Landmark: {order.data.addresses.landmark}</p>
                  )}
                </div>
              </Panel>
            )}

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

// ── Delivery confirmation panel ──
// Shown only while status === "delivered": the rider says they dropped it
// off, but the order isn't "completed" (and the rider isn't paid) until the
// customer confirms or the 24h auto-complete safety net fires server-side.
function DeliveryConfirmationPanel({
  orderId,
  reportedReason,
  onDone,
}: {
  orderId: string;
  reportedReason: string | null;
  onDone: () => void;
}) {
  const [reporting, setReporting] = useState(false);
  const [reason, setReason] = useState("");

  const confirm = useMutation({
    mutationFn: async () => {
      const { confirmDelivery } = await import("@/lib/delivery-confirmation.functions");
      return confirmDelivery({ data: { orderId } });
    },
    onSuccess: () => {
      toast.success("Delivery confirmed", { description: "Thanks — enjoy!" });
      onDone();
    },
    onError: (err) => {
      toast.error("Could not confirm", { description: err instanceof Error ? err.message : undefined });
    },
  });

  const report = useMutation({
    mutationFn: async () => {
      const { reportDeliveryProblem } = await import("@/lib/delivery-confirmation.functions");
      return reportDeliveryProblem({ data: { orderId, reason: reason.trim() } });
    },
    onSuccess: () => {
      toast.success("Thanks — we've logged this", {
        description: "Our support team will follow up with you.",
      });
      setReporting(false);
      onDone();
    },
    onError: (err) => {
      toast.error("Could not send report", { description: err instanceof Error ? err.message : undefined });
    },
  });

  if (reportedReason) {
    return (
      <Panel className="flex items-start gap-3 border-info/30 bg-info-soft p-4">
        <TriangleAlert className="mt-0.5 size-4 shrink-0 text-info" strokeWidth={2.2} />
        <div>
          <p className="text-sm font-bold text-info">Problem reported</p>
          <p className="mt-1 text-xs text-muted-foreground">
            We've logged your report and support will reach out. This order will still auto-complete if
            we don't hear otherwise.
          </p>
        </div>
      </Panel>
    );
  }

  return (
    <Panel className="overflow-hidden border-primary/30">
      <div className="border-b border-border bg-primary/5 px-4 py-2.5">
        <p className="text-[11px] font-bold uppercase tracking-wider text-primary">
          Your rider marked this delivered
        </p>
      </div>
      <div className="space-y-3 p-4">
        {!reporting ? (
          <>
            <p className="text-sm text-muted-foreground">Did everything arrive okay?</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setReporting(true)}
                className="flex-1 rounded-xl border border-border bg-card py-3 text-sm font-bold text-muted-foreground"
              >
                Report a problem
              </button>
              <button
                type="button"
                onClick={() => confirm.mutate()}
                disabled={confirm.isPending}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground disabled:opacity-60"
              >
                {confirm.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="size-4" strokeWidth={2.5} />
                )}
                Confirm delivery
              </button>
            </div>
          </>
        ) : (
          <>
            <label className="block text-sm text-muted-foreground">
              What went wrong?
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                placeholder="e.g. item missing, wrong order, never arrived…"
                className="mt-1.5 w-full rounded-xl border border-border bg-card p-3 text-sm text-foreground"
              />
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setReporting(false)}
                className="flex-1 rounded-xl border border-border bg-card py-3 text-sm font-bold text-muted-foreground"
              >
                Back
              </button>
              <button
                type="button"
                onClick={() => report.mutate()}
                disabled={report.isPending || reason.trim().length === 0}
                className="flex-1 rounded-xl bg-destructive py-3 text-sm font-bold text-destructive-foreground disabled:opacity-60"
              >
                {report.isPending ? "Sending…" : "Send report"}
              </button>
            </div>
          </>
        )}
      </div>
    </Panel>
  );
}
