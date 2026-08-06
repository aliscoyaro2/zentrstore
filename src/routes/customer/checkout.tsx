import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState, useRef } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Screen, PageHeader, Panel, PaystackNote } from "@/components/zentra/shell";
import { useRoleGuard } from "@/hooks/use-role-guard";
import { useCart } from "@/lib/cart";
import { DELIVERY_FEE_KOBO, naira, serviceFeeKobo } from "@/lib/money";
import { initPaystackPayment } from "@/lib/orders.functions";
import { logOrderEvent } from "@/lib/order-events.functions";
import { CustomerAddressPicker } from "@/components/zentra/map/customer-address-picker";
import type { PickedLocation } from "@/components/zentra/map/location-picker";

export const Route = createFileRoute("/customer/checkout")({
  head: () => ({
    meta: [
      { title: "Checkout — Zentra" },
      {
        name: "description",
        content: "Confirm your delivery address, review the price breakdown and pay online.",
      },
      { property: "og:title", content: "Zentra checkout" },
      { property: "og:description", content: "Pay online with Paystack before your order is prepared." },
    ],
  }),
  component: CheckoutPage,
});

// Generate a unique cart session ID that persists across page loads
function getCartSessionId(): string {
  if (typeof window === "undefined") return "";
  let sessionId = sessionStorage.getItem("zentra_cart_session");
  if (!sessionId) {
    sessionId = `cart_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    sessionStorage.setItem("zentra_cart_session", sessionId);
  }
  return sessionId;
}

function CheckoutPage() {
  const { user, ready } = useRoleGuard("customer");
  const { cart, subtotal, count, clear } = useCart();
  const [addressId, setAddressId] = useState<string | null>(null);
  const [newLabel, setNewLabel] = useState("");
  const [pickedLocation, setPickedLocation] = useState<PickedLocation | null>(null);
  const [busy, setBusy] = useState(false);
  const [existingOrderId, setExistingOrderId] = useState<string | null>(null);
  const [isResumingPayment, setIsResumingPayment] = useState(false);
  const isSubmitting = useRef(false);
  const paymentInitiated = useRef(false);

  const cartSessionId = getCartSessionId();

  const service = serviceFeeKobo(subtotal);
  const total = subtotal + DELIVERY_FEE_KOBO + service;

  const addresses = useQuery({
    queryKey: ["addresses", user?.id],
    enabled: ready,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("addresses")
        .select("id,label,formatted,is_default")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Check if an order already exists for this cart session
  const existingOrder = useQuery({
    queryKey: ["checkout-existing-order", user?.id, cartSessionId],
    enabled: Boolean(user) && count > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("id, status, payment_reference")
        .eq("customer_id", user!.id)
        .eq("cart_session_id", cartSessionId)
        .in("status", ["created", "payment_pending", "paid", "merchant_pending"])
        .maybeSingle();

      if (error) throw error;
      return data;
    },
  });

  // If there's an existing order, handle it
  useEffect(() => {
    if (!existingOrder.data || existingOrder.isLoading) return;

    const order = existingOrder.data;

    // If order is already paid or merchant_pending, redirect to tracking
    if (order.status === "paid" || order.status === "merchant_pending") {
      toast.info("You already have an order in progress", {
        description: "Redirecting to order tracking...",
      });
      window.location.href = `/customer/orders/${order.id}`;
      return;
    }

    // If order is created or payment_pending, resume payment
    if (order.status === "created" || order.status === "payment_pending") {
      setExistingOrderId(order.id);
      setIsResumingPayment(true);
      toast.info("Resuming your pending order...", {
        description: "Click continue to complete payment.",
      });
    }
  }, [existingOrder.data, existingOrder.isLoading]);

  useEffect(() => {
    const first = addresses.data?.[0];
    if (!addressId && first) setAddressId(first.id);
  }, [addresses.data, addressId]);

  async function saveAddress() {
    if (!user || !pickedLocation) return;
    setBusy(true);
    const { data, error } = await supabase
      .from("addresses")
      .insert({
        user_id: user.id,
        label: newLabel.trim() || "Home",
        formatted: pickedLocation.formatted,
        lat: pickedLocation.lat,
        lng: pickedLocation.lng,
        is_default: (addresses.data?.length ?? 0) === 0,
      })
      .select("id")
      .single();
    setBusy(false);
    if (error) {
      toast.error("Could not save address", { description: error.message });
      return;
    }
    setNewLabel("");
    setPickedLocation(null);
    await addresses.refetch();
    setAddressId(data.id);
  }

  async function placeOrder() {
    // Prevent multiple submissions
    if (isSubmitting.current || paymentInitiated.current) return;
    if (!user || !cart.merchantId || !addressId) return;

    isSubmitting.current = true;
    setBusy(true);

    try {
      let orderId: string;
      let orderStatus: string;

      // If we have an existing order in created/payment_pending state, use it
      if (existingOrderId && (existingOrder.data?.status === "created" || existingOrder.data?.status === "payment_pending")) {
        orderId = existingOrderId;
        orderStatus = existingOrder.data.status;

        // If order is still "created", update to payment_pending
        if (orderStatus === "created") {
          await supabase
            .from("orders")
            .update({ status: "payment_pending" })
            .eq("id", orderId);
        }

        toast.info("Resuming existing order...");
      } else {
        // Create new order
        const reference = `ZEN-${Date.now().toString(36).toUpperCase()}`;

        const { data: order, error } = await supabase
          .from("orders")
          .insert({
            customer_id: user.id,
            merchant_id: cart.merchantId,
            delivery_address_id: addressId,
            subtotal_kobo: subtotal,
            delivery_fee_kobo: DELIVERY_FEE_KOBO,
            service_fee_kobo: service,
            total_kobo: total,
            payment_reference: reference,
            cart_session_id: cartSessionId,
            status: "created",
            financial_status: "payment_authorized",
            merchant_response_deadline: new Date(Date.now() + 60 * 1000).toISOString(),
          })
          .select("id")
          .single();

        if (error || !order) {
          toast.error("Could not place order", { description: error?.message });
          isSubmitting.current = false;
          setBusy(false);
          return;
        }

        orderId = order.id;
        setExistingOrderId(orderId);

        // Log OrderCreated event
        try {
          await logOrderEvent({
            data: {
              orderId: order.id,
              eventType: "OrderCreated",
              eventData: {
                customer_id: user.id,
                merchant_id: cart.merchantId,
                total_kobo: total,
                item_count: cart.lines.length,
                cart_session_id: cartSessionId,
              },
              actorType: "customer",
              actorId: user.id,
            },
          });
        } catch (eventErr) {
          console.warn("Failed to log OrderCreated event:", eventErr);
        }

        // Save order items
        const { error: itemsError } = await supabase.from("order_items").insert(
          cart.lines.map((l) => ({
            order_id: order.id,
            product_id: l.productId,
            quantity: l.quantity,
            unit_price_kobo: l.priceKobo,
          }))
        );

        if (itemsError) {
          toast.error("Could not save your items", { description: itemsError.message });
          isSubmitting.current = false;
          setBusy(false);
          return;
        }

        // Update order status to payment_pending
        await supabase
          .from("orders")
          .update({ status: "payment_pending" })
          .eq("id", order.id);

        setIsResumingPayment(false);
      }

      // --- PAYMENT FLOW ---
      paymentInitiated.current = true;

      try {
        const { authorizationUrl } = await initPaystackPayment({ data: { orderId } });

        // Clear cart only after successful payment initiation
        clear();
        sessionStorage.removeItem("zentra_cart_session");

        // Redirect to Paystack
        window.location.href = authorizationUrl;
      } catch (payErr) {
        paymentInitiated.current = false;
        toast.error("Could not start payment", {
          description: payErr instanceof Error ? payErr.message : "Please try again.",
        });
        isSubmitting.current = false;
        setBusy(false);
      }
    } catch (err) {
      toast.error("An error occurred", {
        description: err instanceof Error ? err.message : "Please try again.",
      });
      isSubmitting.current = false;
      setBusy(false);
    }
  }

  if (count === 0) {
    return (
      <Screen>
        <PageHeader title="Checkout" back="/cart" />
        <div className="px-4 py-10 text-center">
          <p className="text-sm text-muted-foreground">Your basket is empty.</p>
          <Link to="/" className="mt-4 inline-block font-semibold text-primary">
            Find a store
          </Link>
        </div>
      </Screen>
    );
  }

  if (!ready) return null;

  const isOrderAlreadyPaid = existingOrder.data?.status === "paid" || existingOrder.data?.status === "merchant_pending";

  return (
    <Screen>
      <PageHeader title="Checkout" subtitle={cart.merchantName ?? undefined} back="/cart" />

      <div className="space-y-4 px-4 py-6">
        <section>
          <h2 className="mb-2 text-xs font-bold uppercase tracking-[0.15em] text-muted-foreground">
            Delivery address
          </h2>
          <Panel className="divide-y divide-border">
            {(addresses.data ?? []).map((a) => (
              <label key={a.id} className="flex items-start gap-3 p-4">
                <input
                  type="radio"
                  name="address"
                  checked={addressId === a.id}
                  onChange={() => setAddressId(a.id)}
                  className="mt-1 accent-[oklch(0.6_0.1_183)]"
                />
                <span className="min-w-0">
                  <span className="block text-sm font-semibold">{a.label ?? "Address"}</span>
                  <span className="block text-xs text-muted-foreground">{a.formatted}</span>
                </span>
              </label>
            ))}
            <div className="space-y-2 p-4">
              <input
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                placeholder="Label (Home, Shop, Office)"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/20"
              />
              <CustomerAddressPicker value={pickedLocation} onChange={setPickedLocation} />
              <button
                type="button"
                onClick={saveAddress}
                disabled={busy || !pickedLocation}
                className="w-full rounded-lg border border-primary py-2 text-sm font-bold text-primary disabled:opacity-50"
              >
                Save this address
              </button>
            </div>
          </Panel>
        </section>

        <Panel className="p-4">
          <Row label="Subtotal" value={naira(subtotal)} />
          <Row label="Delivery fee" value={naira(DELIVERY_FEE_KOBO)} />
          <Row label="Service fee" value={naira(service)} />
          <div className="mt-3 flex justify-between border-t border-border pt-3 font-display text-base font-extrabold">
            <span>Total</span>
            <span>{naira(total)}</span>
          </div>
        </Panel>

        <PaystackNote />

        {isOrderAlreadyPaid ? (
          <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-700">
            <p className="font-bold">✅ Order already paid</p>
            <p className="mt-1">This order has already been paid for.</p>
            <Link
              to="/customer/orders/$orderId"
              params={{ orderId: existingOrder.data!.id }}
              className="mt-2 inline-block font-semibold text-green-700 underline"
            >
              View your order
            </Link>
          </div>
        ) : existingOrderId && (existingOrder.data?.status === "created" || existingOrder.data?.status === "payment_pending") ? (
          <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-700">
            <p className="font-bold">🔄 Resuming existing order</p>
            <p className="mt-1">You have a pending order from this cart. Complete payment to finalize.</p>
            <button
              type="button"
              onClick={placeOrder}
              disabled={busy}
              className="mt-3 w-full rounded-xl bg-primary py-3 font-bold text-primary-foreground disabled:opacity-50"
            >
              {busy ? "Processing..." : `Resume payment · ${naira(total)}`}
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={placeOrder}
            disabled={busy || !addressId}
            className="w-full rounded-xl bg-primary py-3.5 font-bold text-primary-foreground disabled:opacity-50"
          >
            {busy ? "Processing..." : `Continue to payment · ${naira(total)}`}
          </button>
        )}
        {!addressId && !existingOrderId && !isOrderAlreadyPaid && (
          <p className="text-center text-xs text-muted-foreground">
            Add a delivery address to continue.
          </p>
        )}
      </div>
    </Screen>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between py-1 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}