import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Screen, PageHeader, Panel, EmptyState } from "@/components/zentra/shell";
import { statusLabel } from "@/components/zentra/status-rail";
import { useSession } from "@/hooks/use-session";
import { categoryLabel } from "@/lib/categories";
import { naira } from "@/lib/money";

export const Route = createFileRoute("/merchant/")({
  head: () => ({
    meta: [
      { title: "Merchant dashboard — Zentra" },
      {
        name: "description",
        content: "Accept incoming orders, manage your product list and keep your store details fresh.",
      },
      { property: "og:title", content: "Zentra merchant dashboard" },
      { property: "og:description", content: "Order queue and catalogue tools for Maiduguri merchants." },
    ],
  }),
  component: MerchantDashboard,
});

const ACTIVE = ["paid", "merchant_accepted", "preparing", "rider_assigned", "picked_up"];

function MerchantDashboard() {
  const { user, loading } = useSession();
  const navigate = useNavigate();
  const [tab, setTab] = useState<"orders" | "catalogue">("orders");

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [loading, user, navigate]);

  const store = useQuery({
    queryKey: ["my-store", user?.id],
    enabled: Boolean(user),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("merchants")
        .select("id,business_name,category,address_text,is_open_override,status")
        .eq("owner_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const merchantId = store.data?.id;

  const orders = useQuery({
    queryKey: ["merchant-orders", merchantId],
    enabled: Boolean(merchantId),
    refetchInterval: 20000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("id,status,total_kobo,placed_at,order_items(quantity,products(name))")
        .eq("merchant_id", merchantId!)
        .order("placed_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const products = useQuery({
    queryKey: ["merchant-products", merchantId],
    enabled: Boolean(merchantId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id,name,price_kobo,category,is_available")
        .eq("merchant_id", merchantId!)
        .order("category");
      if (error) throw error;
      return data;
    },
  });

  async function setStatus(orderId: string, status: "merchant_accepted" | "preparing" | "cancelled") {
    const patch =
      status === "cancelled"
        ? { status, cancelled_at: new Date().toISOString(), cancel_reason: "Rejected by merchant" }
        : { status };
    const { error } = await supabase.from("orders").update(patch).eq("id", orderId);
    if (error) toast.error("Update failed", { description: error.message });
    else await orders.refetch();
  }

  async function toggleOpen() {
    if (!store.data) return;
    const { error } = await supabase
      .from("merchants")
      .update({ is_open_override: store.data.is_open_override === false })
      .eq("id", store.data.id);
    if (error) toast.error("Could not update", { description: error.message });
    else await store.refetch();
  }

  if (!loading && user && store.isFetched && !store.data) {
    return (
      <Screen>
        <PageHeader title="Merchant" back="/" />
        <div className="px-4 py-8">
          <EmptyState
            title="No store on this account"
            body="Register your store or kitchen and we'll review it within a day."
          />
          <Link
            to="/merchant/apply"
            className="mt-4 block rounded-xl bg-primary py-3.5 text-center font-bold text-primary-foreground"
          >
            Register a store
          </Link>
        </div>
      </Screen>
    );
  }

  return (
    <Screen>
      <PageHeader
        title={store.data?.business_name ?? "Merchant"}
        subtitle={store.data ? categoryLabel(store.data.category) : undefined}
        back="/"
        right={
          store.data ? (
            <button
              type="button"
              onClick={toggleOpen}
              className={`rounded-full px-3 py-1.5 text-[10px] font-bold ${
                store.data.is_open_override === false
                  ? "bg-secondary text-muted-foreground"
                  : "bg-success-soft text-success"
              }`}
            >
              {store.data.is_open_override === false ? "CLOSED" : "OPEN"}
            </button>
          ) : undefined
        }
      />

      <div className="flex gap-2 px-4 pt-4">
        {(["orders", "catalogue"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`rounded-full px-4 py-2 text-sm font-bold capitalize ${
              tab === t ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "orders" ? (
        <div className="space-y-3 px-4 py-5">
          {(orders.data ?? []).filter((o) => ACTIVE.includes(o.status)).length === 0 ? (
            <EmptyState title="No active orders" body="Paid orders land here the moment they come in." />
          ) : null}
          {(orders.data ?? []).map((o) => (
            <Panel key={o.id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-bold">{statusLabel(o.status)}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {(o.order_items ?? [])
                      .map((i) => `${i.quantity}× ${i.products?.name ?? "item"}`)
                      .join(", ")}
                  </p>
                </div>
                <span className="font-display font-extrabold">{naira(o.total_kobo)}</span>
              </div>
              <div className="mt-3 flex gap-2">
                {o.status === "paid" ? (
                  <>
                    <button
                      type="button"
                      onClick={() => setStatus(o.id, "merchant_accepted")}
                      className="flex-1 rounded-lg bg-primary py-2 text-xs font-bold text-primary-foreground"
                    >
                      Accept
                    </button>
                    <button
                      type="button"
                      onClick={() => setStatus(o.id, "cancelled")}
                      className="flex-1 rounded-lg border border-destructive py-2 text-xs font-bold text-destructive"
                    >
                      Reject
                    </button>
                  </>
                ) : null}
                {o.status === "merchant_accepted" ? (
                  <button
                    type="button"
                    onClick={() => setStatus(o.id, "preparing")}
                    className="flex-1 rounded-lg bg-primary py-2 text-xs font-bold text-primary-foreground"
                  >
                    Start preparing
                  </button>
                ) : null}
                {o.status === "placed" ? (
                  <p className="text-xs text-muted-foreground">Waiting for the customer's payment.</p>
                ) : null}
              </div>
            </Panel>
          ))}
        </div>
      ) : (
        <CatalogueTab merchantId={merchantId} products={products} />
      )}
    </Screen>
  );
}

function CatalogueTab({
  merchantId,
  products,
}: {
  merchantId: string | undefined;
  products: ReturnType<typeof useQuery<Array<{ id: string; name: string; price_kobo: number; category: string | null; is_available: boolean | null }>>>;
}) {
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [group, setGroup] = useState("");

  async function addProduct() {
    if (!merchantId || !name.trim() || !price) return;
    const { error } = await supabase.from("products").insert({
      merchant_id: merchantId,
      name: name.trim(),
      price_kobo: Math.round(Number(price) * 100),
      category: group.trim() || "Available now",
    });
    if (error) {
      toast.error("Could not add product", { description: error.message });
      return;
    }
    setName("");
    setPrice("");
    await products.refetch();
  }

  async function toggle(id: string, next: boolean) {
    const { error } = await supabase.from("products").update({ is_available: next }).eq("id", id);
    if (error) toast.error("Update failed", { description: error.message });
    else await products.refetch();
  }

  async function remove(id: string) {
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) toast.error("Could not remove", { description: error.message });
    else await products.refetch();
  }

  return (
    <div className="space-y-4 px-4 py-5">
      <Panel className="space-y-2 p-4">
        <p className="text-xs font-bold uppercase tracking-[0.15em] text-muted-foreground">
          Add a product
        </p>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Product name"
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/20"
        />
        <div className="flex gap-2">
          <input
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            inputMode="decimal"
            placeholder="Price in ₦"
            className="w-1/2 rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/20"
          />
          <input
            value={group}
            onChange={(e) => setGroup(e.target.value)}
            placeholder="Section"
            className="w-1/2 rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>
        <button
          type="button"
          onClick={addProduct}
          className="w-full rounded-lg bg-primary py-2.5 text-sm font-bold text-primary-foreground"
        >
          Add to catalogue
        </button>
      </Panel>

      <Panel className="divide-y divide-border">
        {(products.data ?? []).map((p) => (
          <div key={p.id} className="flex items-center justify-between gap-3 p-4">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{p.name}</p>
              <p className="text-xs text-muted-foreground">
                {naira(p.price_kobo)} · {p.category ?? "Available now"}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={() => toggle(p.id, !(p.is_available ?? true))}
                className={`rounded-lg px-2 py-1.5 text-[10px] font-bold ${
                  p.is_available ?? true
                    ? "bg-success-soft text-success"
                    : "bg-secondary text-muted-foreground"
                }`}
              >
                {p.is_available ?? true ? "IN STOCK" : "HIDDEN"}
              </button>
              <button
                type="button"
                onClick={() => remove(p.id)}
                className="text-[10px] font-bold text-destructive"
              >
                REMOVE
              </button>
            </div>
          </div>
        ))}
      </Panel>
    </div>
  );
}
