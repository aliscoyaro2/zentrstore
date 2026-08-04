import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Screen, PageHeader, Panel, PaystackNote } from "@/components/zentra/shell";
import { useRoleGuard } from "@/hooks/use-role-guard";
import { useCart } from "@/lib/cart";
import { DELIVERY_FEE_KOBO, naira, serviceFeeKobo } from "@/lib/money";

export const Route = createFileRoute("/checkout")({
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

const ZONE_POINT = { lat: 11.8311, lng: 13.151 };

function CheckoutPage() {
  const navigate = useNavigate();
  const { user, ready } = useRoleGuard("customer");
  const { cart, subtotal, count, clear } = useCart();
  const [addressId, setAddressId] = useState<string | null>(null);
  const [newLabel, setNewLabel] = useState("");
  const [newText, setNewText] = useState("");
  const [busy, setBusy] = useState(false);

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

  useEffect(() => {
    const first = addresses.data?.[0];
    if (!addressId && first) setAddressId(first.id);
  }, [addresses.data, addressId]);

  async function saveAddress() {
    if (!user || !newText.trim()) return;
    setBusy(true);
    const { data, error } = await supabase
      .from("addresses")
      .insert({
        user_id: user.id,
        label: newLabel.trim() || "Home",
        formatted: newText.trim(),
        lat: ZONE_POINT.lat,
        lng: ZONE_POINT.lng,
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
    setNewText("");
    await addresses.refetch();
    setAddressId(data.id);
  }

  async function placeOrder() {
    if (!user || !cart.merchantId || !addressId) return;
    setBusy(true);
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
      })
      .select("id")
      .single();

    if (error || !order) {
      setBusy(false);
      toast.error("Could not place order", { description: error?.message });
      return;
    }

    const { error: itemsError } = await supabase.from("order_items").insert(
      cart.lines.map((l) => ({
        order_id: order.id,
        product_id: l.productId,
        quantity: l.quantity,
        unit_price_kobo: l.priceKobo,
      })),
    );
    setBusy(false);
    if (itemsError) {
      toast.error("Could not save your items", { description: itemsError.message });
      return;
    }

    clear();
    navigate({ to: "/orders/$orderId", params: { orderId: order.id } });
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
              <textarea
                value={newText}
                onChange={(e) => setNewText(e.target.value)}
                rows={2}
                placeholder="e.g. No 14 Lagos Street, off Damboa Road, GRA Phase 1 — call at the black gate"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/20"
              />
              <button
                type="button"
                onClick={saveAddress}
                disabled={busy || !newText.trim()}
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

        <button
          type="button"
          onClick={placeOrder}
          disabled={busy || !addressId}
          className="w-full rounded-xl bg-primary py-3.5 font-bold text-primary-foreground disabled:opacity-50"
        >
          {busy ? "Working..." : `Continue to payment · ${naira(total)}`}
        </button>
        {!addressId ? (
          <p className="text-center text-xs text-muted-foreground">
            Add a delivery address to continue.
          </p>
        ) : null}
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
