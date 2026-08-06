import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, CheckCircle2, XCircle, Package, MapPin, Phone } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { MerchantLayout } from "@/components/zentra/merchant-layout";
import { AdminStatusBadge } from "@/components/admin/admin-status-badge";
import { statusLabel } from "@/components/zentra/status-rail";
import { naira } from "@/lib/money";
import { OrderRouteMap } from "@/components/zentra/map/order-route-map";
import {
  merchantAcceptOrder,
  merchantRejectOrder,
  merchantMarkReady,
  merchantConfirmReadyForPickup,
} from "@/lib/merchant-order.functions";

const MAP_STATUSES = [
  "rider_assigned",
  "rider_en_route_to_merchant",
  "ready_for_pickup",
  "picked_up",
  "rider_en_route_to_customer",
];

export const Route = createFileRoute("/merchant/orders/$orderId")({
  head: () => ({
    meta: [{ title: "Order details — Merchant" }],
  }),
  component: MerchantOrderDetailPage,
});

function MerchantOrderDetailPage() {
  const { orderId } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [prepTime, setPrepTime] = useState<number>(15);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

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

  const order = useQuery({
    queryKey: ["merchant-order-detail", orderId],
    enabled: Boolean(orderId),
    refetchInterval: 8000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select(`
          id,
          status,
          total_kobo,
          subtotal_kobo,
          delivery_fee_kobo,
          service_fee_kobo,
          placed_at,
          prep_time_mins,
          pickup_code,
          cancel_reason,
          customer_id,
          profiles:customer_id ( full_name, phone ),
          addresses ( formatted, lat, lng ),
          riders ( current_lat, current_lng ),
          order_items ( id, quantity, unit_price_kobo, products ( name ) )
        `)
        .eq("id", orderId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  function invalidateAll() {
    queryClient.invalidateQueries({ queryKey: ["merchant-order-detail", orderId] });
    queryClient.invalidateQueries({ queryKey: ["merchant-orders"] });
  }

  async function handleAccept() {
    try {
      await merchantAcceptOrder({ data: { orderId, prepTimeMins: prepTime } });
      toast.success("Order accepted!");
      invalidateAll();
    } catch (err) {
      toast.error("Could not accept", { description: err instanceof Error ? err.message : undefined });
    }
  }

  async function handleReject() {
    if (!rejectReason.trim()) {
      toast.error("Please provide a reason for rejecting.");
      return;
    }
    try {
      await merchantRejectOrder({ data: { orderId, reason: rejectReason.trim() } });
      toast.success("Order rejected");
      setShowRejectModal(false);
      setRejectReason("");
      invalidateAll();
    } catch (err) {
      toast.error("Could not reject", { description: err instanceof Error ? err.message : undefined });
    }
  }

  async function handleMarkReady() {
    try {
      await merchantMarkReady({ data: { orderId } });
      toast.success("Order marked ready!");
      invalidateAll();
    } catch (err) {
      toast.error("Could not mark ready", { description: err instanceof Error ? err.message : undefined });
    }
  }

  async function handleConfirmReadyForPickup() {
    try {
      const result = await merchantConfirmReadyForPickup({ data: { orderId } });
      toast.success(`Pickup code: ${result.pickupCode}`, {
        description: "Read this to the rider when they arrive.",
      });
      invalidateAll();
    } catch (err) {
      toast.error("Could not confirm ready", { description: err instanceof Error ? err.message : undefined });
    }
  }

  return (
    <MerchantLayout>
      <div className="-mx-4 -mt-5 mb-4 flex items-center gap-3 border-b border-border bg-card px-4 py-3">
        <button
          type="button"
          onClick={() => navigate({ to: "/merchant/orders" })}
          className="grid size-8 shrink-0 place-items-center rounded-full border border-border"
        >
          <ArrowLeft className="size-4" />
        </button>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">
            {order.data ? `#${order.data.id.slice(0, 8)}` : "Order"}
          </p>
          {order.data && (
            <p className="text-xs text-muted-foreground">{statusLabel(order.data.status)}</p>
          )}
        </div>
      </div>

      {order.isLoading ? (
        <div className="space-y-3">
          <div className="h-32 animate-pulse rounded-xl bg-secondary" />
          <div className="h-24 animate-pulse rounded-xl bg-secondary" />
        </div>
      ) : !order.data ? (
        <div className="py-12 text-center">
          <Package className="mx-auto size-10 text-muted-foreground/30" />
          <p className="mt-3 font-medium">Order not found</p>
          <p className="text-sm text-muted-foreground">
            It may not exist, or it doesn't belong to your store.
          </p>
        </div>
      ) : (
        <OrderDetailBody
          order={order.data}
          storeLat={store?.lat ?? null}
          storeLng={store?.lng ?? null}
          prepTime={prepTime}
          setPrepTime={setPrepTime}
          onAccept={handleAccept}
          onOpenReject={() => setShowRejectModal(true)}
          onMarkReady={handleMarkReady}
          onConfirmReady={handleConfirmReadyForPickup}
        />
      )}

      {showRejectModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={() => setShowRejectModal(false)}
        >
          <div
            className="w-full max-w-sm rounded-xl bg-card p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
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
                }}
                className="flex-1 rounded-lg border border-border py-2 text-sm font-bold text-muted-foreground"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleReject}
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

type OrderDetailData = NonNullable<ReturnType<typeof useOrderDataShape>>;
// Type helper only — never called. Keeps the body component's prop type
// tied to the query's inferred shape without duplicating the select string.
function useOrderDataShape() {
  return null as unknown as {
    id: string;
    status: string;
    total_kobo: number;
    subtotal_kobo: number;
    delivery_fee_kobo: number;
    service_fee_kobo: number;
    placed_at: string | null;
    prep_time_mins: number | null;
    pickup_code: string | null;
    cancel_reason: string | null;
    customer_id: string;
    profiles: { full_name: string | null; phone: string | null } | null;
    addresses: { formatted: string | null; lat: number | null; lng: number | null } | null;
    riders: { current_lat: number | null; current_lng: number | null } | null;
    order_items: { id: string; quantity: number; unit_price_kobo: number; products: { name: string | null } | null }[] | null;
  };
}

function OrderDetailBody({
  order,
  storeLat,
  storeLng,
  prepTime,
  setPrepTime,
  onAccept,
  onOpenReject,
  onMarkReady,
  onConfirmReady,
}: {
  order: OrderDetailData;
  storeLat: number | null;
  storeLng: number | null;
  prepTime: number;
  setPrepTime: (n: number) => void;
  onAccept: () => void;
  onOpenReject: () => void;
  onMarkReady: () => void;
  onConfirmReady: () => void;
}) {
  const isPending = order.status === "paid" || order.status === "merchant_pending" || order.status === "placed";
  const isReadyable = order.status === "merchant_accepted";
  const canConfirmReady = order.status === "preparing";
  const showMap =
    MAP_STATUSES.includes(order.status) &&
    storeLat != null &&
    storeLng != null &&
    order.addresses?.lat != null &&
    order.addresses?.lng != null;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-start justify-between">
          <AdminStatusBadge status={order.status} label={statusLabel(order.status)} />
          <p className="font-display text-lg font-extrabold">{naira(order.total_kobo)}</p>
        </div>
        {order.status === "cancelled" && order.cancel_reason && (
          <p className="mt-3 text-xs text-destructive">{order.cancel_reason}</p>
        )}
        <p className="mt-2 text-xs text-muted-foreground">
          {order.placed_at ? new Date(order.placed_at).toLocaleString() : ""}
        </p>
      </div>

      <div className="rounded-xl border border-border bg-card p-4">
        <p className="text-sm font-semibold">Customer</p>
        <p className="mt-1 text-sm text-muted-foreground">{order.profiles?.full_name || "Customer"}</p>
        {order.profiles?.phone && (
          <a
            href={`tel:${order.profiles.phone}`}
            className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-primary"
          >
            <Phone className="size-3.5" />
            {order.profiles.phone}
          </a>
        )}
        {order.addresses?.formatted && (
          <p className="mt-2 flex items-start gap-1.5 text-xs text-muted-foreground">
            <MapPin className="mt-0.5 size-3.5 shrink-0" />
            {order.addresses.formatted}
          </p>
        )}
      </div>

      {showMap && (
        <div className="overflow-hidden rounded-xl border border-border">
          <OrderRouteMap
            merchant={{ lat: storeLat!, lng: storeLng!, label: "Your store" }}
            customer={{
              lat: order.addresses!.lat!,
              lng: order.addresses!.lng!,
              label: order.addresses!.formatted ?? "Delivery address",
            }}
            rider={
              order.riders?.current_lat != null && order.riders?.current_lng != null
                ? { lat: order.riders.current_lat, lng: order.riders.current_lng }
                : null
            }
            className="h-56 w-full rounded-none border-0"
          />
        </div>
      )}

      <div className="rounded-xl border border-border bg-card p-4">
        <p className="text-sm font-semibold">Items</p>
        <div className="mt-2 space-y-2">
          {(order.order_items ?? []).map((item) => (
            <div key={item.id} className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                {item.quantity}× {item.products?.name ?? "Item"}
              </span>
              <span>{naira(item.unit_price_kobo * item.quantity)}</span>
            </div>
          ))}
        </div>
        <div className="mt-3 space-y-1.5 border-t border-border pt-3">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Subtotal</span>
            <span>{naira(order.subtotal_kobo)}</span>
          </div>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Delivery fee</span>
            <span>{naira(order.delivery_fee_kobo)}</span>
          </div>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Service fee</span>
            <span>{naira(order.service_fee_kobo)}</span>
          </div>
          <div className="flex items-center justify-between border-t border-border pt-1.5 text-sm font-bold">
            <span>Total</span>
            <span>{naira(order.total_kobo)}</span>
          </div>
        </div>
      </div>

      {order.status === "ready_for_pickup" && (
        <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 text-center">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Pickup code — read to rider
          </p>
          <p className="font-display text-3xl font-extrabold tracking-[0.3em] text-primary">
            {order.pickup_code ?? "----"}
          </p>
        </div>
      )}

      {/* Actions */}
      {isPending && (
        <div className="space-y-3 rounded-xl border border-primary/30 bg-primary/5 p-4">
          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-muted-foreground">Prep time</label>
            <select
              value={prepTime}
              onChange={(e) => setPrepTime(Number(e.target.value))}
              className="rounded-lg border border-border bg-background px-2 py-1.5 text-xs"
            >
              {[5, 10, 15, 20, 25, 30, 45, 60].map((m) => (
                <option key={m} value={m}>
                  {m} min
                </option>
              ))}
            </select>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onAccept}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-2.5 text-sm font-bold text-primary-foreground"
            >
              <CheckCircle2 className="size-4" />
              Accept
            </button>
            <button
              type="button"
              onClick={onOpenReject}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-destructive px-3 py-2.5 text-sm font-bold text-destructive"
            >
              <XCircle className="size-4" />
              Reject
            </button>
          </div>
        </div>
      )}

      {isReadyable && (
        <button
          type="button"
          onClick={onMarkReady}
          className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-accent px-3 py-3 text-sm font-bold text-accent-foreground"
        >
          <Package className="size-4" />
          Mark Ready for Pickup
        </button>
      )}

      {canConfirmReady && (
        <button
          type="button"
          onClick={onConfirmReady}
          className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-3 text-sm font-bold text-primary-foreground"
        >
          <Package className="size-4" />
          Food is ready — get pickup code
        </button>
      )}
    </div>
  );
}
