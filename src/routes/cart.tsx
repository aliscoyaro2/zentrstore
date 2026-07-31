import { createFileRoute, Link } from "@tanstack/react-router";
import { Minus, Plus } from "lucide-react";
import { Screen, PageHeader, Panel, EmptyState, PaystackNote } from "@/components/zentra/shell";
import { useCart } from "@/lib/cart";
import { DELIVERY_FEE_KOBO, naira, serviceFeeKobo } from "@/lib/money";

export const Route = createFileRoute("/cart")({
  head: () => ({
    meta: [
      { title: "Your basket — Zentra" },
      {
        name: "description",
        content: "Review your Zentra basket, adjust quantities and see delivery and service fees.",
      },
      { property: "og:title", content: "Your Zentra basket" },
      { property: "og:description", content: "One store per order, paid online before prep starts." },
    ],
  }),
  component: CartPage,
});

function CartPage() {
  const { cart, setQuantity, subtotal, count } = useCart();
  const service = serviceFeeKobo(subtotal);
  const total = subtotal + DELIVERY_FEE_KOBO + service;

  return (
    <Screen>
      <PageHeader title="Your basket" subtitle={cart.merchantName ?? undefined} back="/" />

      <div className="space-y-4 px-4 py-6">
        {count === 0 ? (
          <EmptyState
            title="Your basket is empty"
            body="Pick a store near you and add what you need."
          />
        ) : (
          <>
            <Panel className="divide-y divide-border">
              {cart.lines.map((line) => (
                <div key={line.productId} className="flex items-center gap-3 p-4">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold leading-tight">{line.name}</p>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      {naira(line.priceKobo)} each
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      aria-label={`Reduce ${line.name}`}
                      onClick={() => setQuantity(line.productId, line.quantity - 1)}
                      className="grid size-8 place-items-center rounded-lg border border-border bg-secondary"
                    >
                      <Minus className="size-3.5" />
                    </button>
                    <span className="w-5 text-center font-bold">{line.quantity}</span>
                    <button
                      type="button"
                      aria-label={`Add ${line.name}`}
                      onClick={() => setQuantity(line.productId, line.quantity + 1)}
                      className="grid size-8 place-items-center rounded-lg border border-border bg-secondary"
                    >
                      <Plus className="size-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </Panel>

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

            <Link
              to="/checkout"
              className="block rounded-xl bg-primary py-3.5 text-center font-bold text-primary-foreground"
            >
              Continue to checkout
            </Link>
            <p className="text-center text-xs text-muted-foreground">
              One store per order for now. Start a second order for another store.
            </p>
          </>
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
