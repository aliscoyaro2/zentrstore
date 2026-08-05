import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Screen, PageHeader, Panel } from "@/components/zentra/shell";
import { useSession } from "@/hooks/use-session";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";

export const Route = createFileRoute("/customer/payment-status/$orderId")({
  head: () => ({
    meta: [{ title: "Confirming payment — Zentra" }],
  }),
  component: PaymentStatusPage,
});

// Paystack's webhook usually lands within a few seconds, but we give it a
// reasonable window before telling the customer something may be wrong —
// their money may still be fine even if the webhook is briefly delayed.
const POLL_INTERVAL_MS = 2500;
const TIMEOUT_MS = 45000;

function PaymentStatusPage() {
  const { orderId } = Route.useParams();
  const { user, loading } = useSession();
  const navigate = useNavigate();
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [loading, user, navigate]);

  useEffect(() => {
    const timer = setTimeout(() => setTimedOut(true), TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, []);

  const order = useQuery({
    queryKey: ["payment-status", orderId, user?.id],
    enabled: Boolean(user),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (status === "paid" || status === "cancelled" || status === "refunded") return false;
      return POLL_INTERVAL_MS;
    },
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("id,status")
        .eq("id", orderId)
        .eq("customer_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const status = order.data?.status;
  const isPaid = status === "paid" || (status && status !== "placed" && status !== "cancelled");
  const isFailed = status === "cancelled";

  return (
    <Screen nav={false}>
      <PageHeader title="Confirming payment" />
      <div className="flex flex-col items-center gap-4 px-4 py-16 text-center">
        {isPaid ? (
          <>
            <CheckCircle2 className="size-14 text-primary" />
            <div>
              <p className="font-display text-lg font-extrabold">Payment confirmed</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Your order has been sent to the merchant.
              </p>
            </div>
            <Link
              to="/customer/orders/$orderId"
              params={{ orderId }}
              className="mt-4 w-full max-w-xs rounded-xl bg-primary py-3.5 text-center font-bold text-primary-foreground"
            >
              Track your order
            </Link>
          </>
        ) : isFailed ? (
          <>
            <XCircle className="size-14 text-destructive" />
            <div>
              <p className="font-display text-lg font-extrabold">Payment didn't go through</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Your order wasn't charged. You can try again from your cart.
              </p>
            </div>
            <Link
              to="/customer/cart"
              className="mt-4 w-full max-w-xs rounded-xl bg-primary py-3.5 text-center font-bold text-primary-foreground"
            >
              Back to cart
            </Link>
          </>
        ) : timedOut ? (
          <>
            <Loader2 className="size-14 animate-spin text-muted-foreground" />
            <Panel className="p-4 text-left">
              <p className="text-sm font-semibold">Still confirming your payment</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                This is taking longer than usual. If money left your account, your order will
                update automatically once we hear from Paystack — no need to pay again. You can
                check back here or view your order below.
              </p>
            </Panel>
            <Link
              to="/customer/orders/$orderId"
              params={{ orderId }}
              className="mt-2 w-full max-w-xs rounded-xl border border-primary py-3.5 text-center font-bold text-primary"
            >
              View order status
            </Link>
          </>
        ) : (
          <>
            <Loader2 className="size-14 animate-spin text-primary" />
            <div>
              <p className="font-display text-lg font-extrabold">Confirming your payment…</p>
              <p className="mt-1 text-sm text-muted-foreground">This only takes a moment.</p>
            </div>
          </>
        )}
      </div>
    </Screen>
  );
}
