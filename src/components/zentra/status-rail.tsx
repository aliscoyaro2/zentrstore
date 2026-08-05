export const ORDER_FLOW = [
  "created",
  "payment_pending",
  "paid",
  "merchant_pending",
  "merchant_accepted",
  "preparing",
  "rider_offered",
  "rider_assigned",
  "rider_en_route_to_merchant",
  "ready_for_pickup",
  "picked_up",
  "en_route_to_customer",
  "delivered",
  "completed",
] as const;

export const STATUS_COPY: Record<string, { label: string; hint: string }> = {
  // Existing statuses
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
  
  // NEW STATUSES
  created: { label: "Order created", hint: "Processing your order" },
  payment_pending: { label: "Awaiting payment", hint: "Waiting for payment confirmation" },
  merchant_pending: { label: "Awaiting merchant", hint: "Waiting for merchant to accept" },
  merchant_rejected: { label: "Rejected by merchant", hint: "Merchant couldn't fulfill this order" },
  dispatch_scheduled: { label: "Dispatch scheduled", hint: "Finding the best rider" },
  dispatching: { label: "Looking for rider", hint: "Riders are being notified" },
  rider_offered: { label: "Offered to rider", hint: "Waiting for rider to accept" },
  ready_for_pickup: { label: "Ready for pickup", hint: "Food is ready for collection" },
  en_route_to_customer: { label: "On the way to you", hint: "Rider is delivering" },
  completed: { label: "Completed", hint: "Order is complete" },
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

  // If status not found in flow, just show it as text
  if (activeIndex === -1) {
    return (
      <ol className="relative flex flex-col gap-6 pl-8">
        <li className="relative">
          <span className="absolute -left-[29px] top-1 size-3.5 rounded-full ring-4 ring-background bg-primary" />
          <p className="text-sm font-semibold leading-none text-primary">
            {STATUS_COPY[status]?.label ?? status.replaceAll("_", " ")}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {STATUS_COPY[status]?.hint ?? ""}
          </p>
        </li>
      </ol>
    );
  }

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