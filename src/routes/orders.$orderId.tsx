import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Screen, PageHeader, Panel } from "@/components/zentra/shell";
import { StatusRail, statusLabel } from "@/components/zentra/status-rail";
import { confirmOrderPayment } from "@/lib/orders.functions";
import { naira } from "@/lib/money";

export const Route = createFileRoute("/orders/$orderId")({
  head: () => ({
    meta: [
      { title: "Order tracking — Zentra" },
      {
        name: "description",
        content: "Follow your Zentra order: payment, merchant prep, rider pickup and delivery.",
      },
      { property: "og:title", content: "Track your Zentra order" },
      { property: "og:description", content: "Step-by-step progress from payment to your gate." },
    ],
  }),
  component: OrderPage,
});

function OrderPage() {
  const { orderId } = Route.useParams();
  const pay = useServerFn(confirmOrderPayment);

  const order = useQuery({
    queryKey: ["order", orderId],
    refetchInterval: 15000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select(
          "id,status,subtotal_kobo,delivery_fee_kobo,service_fee_kobo,total_kobo,payment_reference,placed_at,merchants(business_name),order_items(quantity,unit_price_kobo,products(name))",
        )
        .eq("id", orderId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const payMutation = useMutation({
    mutationFn: () => pay({ data: { orderId } }),
    onSuccess: async () => {
      toast.success("Payment confirmed", { description: "The merchant has been notified." });
      await order.refetch();
    },
    onError: (e: Error) => toast.error("Payment failed", { description: e.message }),
  });

  const data = order.data;

  return (
    <Screen>
      <PageHeader
        title={data?.merchants?.business_name ?? "Your order"}
        subtitle={data ? `Ref ${data.payment_reference}` : undefined}
        back="/orders"
      />

      <div className="space-y-4 px-4 py-6">
        {order.isLoading || !data ? (
          <div className="h-64 animate-pulse rounded-2xl bg-secondary" />
        ) : (
          <>
            <Panel className="p-4">
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Current status
              </p>
              <p className="mt-1 font-display text-xl font-extrabold text-primary">
                {statusLabel(data.status)}
              </p>
            </Panel>

            {data.status === "placed" ? (
              <div className="rounded-2xl border border-accent/30 bg-accent-soft p-4">
                <p className="text-sm font-bold text-accent-foreground">Payment pending</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  The merchant only starts preparing after payment. Pay {naira(data.total_kobo)}{" "}
                  online now.
                </p>
                <button
                  type="button"
                  onClick={() => payMutation.mutate()}
                  disabled={payMutation.isPending}
                  className="mt-3 w-full rounded-xl bg-primary py-3 font-bold text-primary-foreground disabled:opacity-50"
                >
                  {payMutation.isPending ? "Confirming..." : "Pay with Paystack"}
                </button>
              </div>
            ) : null}

            <Panel className="p-4">
              <StatusRail status={data.status} />
            </Panel>

            <Panel className="p-4">
              <p className="mb-2 text-xs font-bold uppercase tracking-[0.15em] text-muted-foreground">
                Items
              </p>
              <ul className="divide-y divide-border">
                {(data.order_items ?? []).map((item, index) => (
                  <li key={index} className="flex justify-between py-2 text-sm">
                    <span>
                      {item.quantity} × {item.products?.name ?? "Item"}
                    </span>
                    <span className="font-medium">
                      {naira(item.unit_price_kobo * item.quantity)}
                    </span>
                  </li>
                ))}
              </ul>
              <div className="mt-3 space-y-1 border-t border-border pt-3 text-sm">
                <Row label="Subtotal" value={naira(data.subtotal_kobo)} />
                <Row label="Delivery fee" value={naira(data.delivery_fee_kobo)} />
                <Row label="Service fee" value={naira(data.service_fee_kobo)} />
                <div className="flex justify-between pt-2 font-display text-base font-extrabold">
                  <span>Total</span>
                  <span>{naira(data.total_kobo)}</span>
                </div>
              </div>
            </Panel>
          </>
        )}
      </div>
    </Screen>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
