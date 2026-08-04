import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Screen, PageHeader, Panel, EmptyState } from "@/components/zentra/shell";
import { statusLabel } from "@/components/zentra/status-rail";
import { useSession } from "@/hooks/use-session";
import { naira } from "@/lib/money";

export const Route = createFileRoute("/orders/")({
  head: () => ({
    meta: [
      { title: "Your orders — Zentra" },
      {
        name: "description",
        content: "Track every Zentra order from payment to the rider knocking on your gate.",
      },
      { property: "og:title", content: "Your Zentra orders" },
      { property: "og:description", content: "Live status for each order you placed in Maiduguri." },
    ],
  }),
  component: OrdersPage,
});

function OrdersPage() {
  const { user, loading } = useSession();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [loading, user, navigate]);

  const orders = useQuery({
    queryKey: ["my-orders", user?.id],
    enabled: Boolean(user),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("id,status,total_kobo,placed_at,merchants(business_name)")
        .eq("customer_id", user!.id)
        .order("placed_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  return (
    <Screen>
      <PageHeader title="Your orders" subtitle="Maiduguri deliveries" />
      <div className="space-y-3 px-4 py-6">
        {orders.isLoading ? (
          <div className="h-24 animate-pulse rounded-2xl bg-secondary" />
        ) : (orders.data ?? []).length === 0 ? (
          <EmptyState title="No orders yet" body="When you place an order it will show up here." />
        ) : (
          (orders.data ?? []).map((o) => (
            <Link key={o.id} to="/orders/$orderId" params={{ orderId: o.id }} className="block">
              <Panel className="flex items-center justify-between p-4">
                <div className="min-w-0">
                  <p className="truncate font-semibold leading-tight">
                    {o.merchants?.business_name ?? "Store"}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {statusLabel(o.status)} ·{" "}
                    {o.placed_at ? new Date(o.placed_at).toLocaleDateString("en-NG") : ""}
                  </p>
                </div>
                <span className="font-display font-extrabold">{naira(o.total_kobo)}</span>
              </Panel>
            </Link>
          ))
        )}
      </div>
    </Screen>
  );
}
