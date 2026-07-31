export const ORDER_FLOW = [
  "placed",
  "paid",
  "merchant_accepted",
  "preparing",
  "rider_assigned",
  "picked_up",
  "delivered",
] as const;

export const STATUS_COPY: Record<string, { label: string; hint: string }> = {
  placed: { label: "Order placed", hint: "Waiting for your payment" },
  paid: { label: "Payment received", hint: "Sent to the merchant" },
  merchant_accepted: { label: "Merchant accepted", hint: "Your order was confirmed" },
  preparing: { label: "Being prepared", hint: "The store is packing your order" },
  rider_assigned: { label: "Rider assigned", hint: "A rider is heading to the store" },
  rider_en_route_to_merchant: { label: "Rider on the way to store", hint: "Pickup shortly" },
  picked_up: { label: "Picked up", hint: "On the way to you" },
  rider_en_route_to_customer: { label: "Rider on the way to you", hint: "Almost there" },
  delivered: { label: "Delivered", hint: "Enjoy" },
  cancelled: { label: "Cancelled", hint: "This order was cancelled" },
  refunded: { label: "Refunded", hint: "Your payment was returned" },
};

export function statusLabel(status: string) {
  return STATUS_COPY[status]?.label ?? status.replaceAll("_", " ");
}

export function StatusRail({ status }: { status: string }) {
  const normalised =
    status === "rider_en_route_to_merchant"
      ? "rider_assigned"
      : status === "rider_en_route_to_customer"
        ? "picked_up"
        : status;
  const activeIndex = ORDER_FLOW.indexOf(normalised as (typeof ORDER_FLOW)[number]);

  return (
    <ol className="relative flex flex-col gap-6 pl-8">
      <span className="absolute bottom-2 left-[7px] top-2 w-0.5 bg-border" aria-hidden />
      {ORDER_FLOW.map((step, index) => {
        const copy = STATUS_COPY[step] ?? { label: step, hint: "" };
        const done = activeIndex > index;
        const current = activeIndex === index;
        return (
          <li key={step} className="relative">
            <span
              className={`absolute -left-[29px] top-1 size-3.5 rounded-full ring-4 ring-background ${
                done ? "bg-success" : current ? "bg-primary" : "bg-border"
              }`}
              aria-hidden
            />
            <p
              className={`text-sm font-semibold leading-none ${
                current ? "text-primary" : done ? "" : "text-muted-foreground"
              }`}
            >
              {copy.label}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">{copy.hint}</p>
          </li>
        );
      })}
    </ol>
  );
}
