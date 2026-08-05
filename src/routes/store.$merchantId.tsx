import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Screen, PageHeader, EmptyState } from "@/components/zentra/shell";
import { categoryImage, categoryLabel } from "@/lib/categories";
import { naira } from "@/lib/money";
import { useCart } from "@/lib/cart";

export const Route = createFileRoute("/store/$merchantId")({
  head: () => ({
    meta: [
      { title: "Store — Zentra Maiduguri" },
      {
        name: "description",
        content: "Browse what this Maiduguri store has in stock today and add it to your cart.",
      },
      { property: "og:title", content: "Store on Zentra" },
      {
        property: "og:description",
        content: "Products, prices and availability from a local Maiduguri merchant.",
      },
    ],
  }),
  component: StorePage,
});

function StorePage() {
  const { merchantId } = Route.useParams();
  const { cart, count, subtotal, addItem } = useCart();

  const store = useQuery({
    queryKey: ["merchant", merchantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("merchants")
        .select("id,business_name,category,address_text,is_open_override")
        .eq("id", merchantId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const products = useQuery({
    queryKey: ["products", merchantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id,name,description,price_kobo,category,prep_time_mins")
        .eq("merchant_id", merchantId)
        .eq("is_available", true)
        .order("category");
      if (error) throw error;
      return data;
    },
  });

  const groups = new Map<string, NonNullable<typeof products.data>>();
  for (const p of products.data ?? []) {
    const key = p.category ?? "Available now";
    const list = groups.get(key) ?? [];
    list.push(p);
    groups.set(key, list);
  }

  const hero = store.data ? categoryImage(store.data.category) : undefined;
  const closed = store.data?.is_open_override === false;

  return (
    <Screen>
      <PageHeader
        title={store.data?.business_name ?? "Store"}
        subtitle={
          store.data
            ? `${categoryLabel(store.data.category)} • ${store.data.address_text ?? "Maiduguri"}`
            : undefined
        }
        back="/"
      />

      {hero ? (
        <img
          src={hero}
          alt={store.data?.business_name ?? ""}
          width={910}
          height={512}
          className="aspect-[16/7] w-full object-cover"
        />
      ) : (
        <div className="bg-primary px-4 py-8">
          <p className="font-display text-2xl font-extrabold text-primary-foreground">
            {store.data?.business_name}
          </p>
          <p className="mt-1 text-sm text-primary-foreground/80">
            {store.data ? categoryLabel(store.data.category) : ""}
          </p>
        </div>
      )}

      {closed ? (
        <p className="bg-secondary px-4 py-2 text-center text-xs font-bold uppercase tracking-wide text-muted-foreground">
          Closed right now — you can still browse
        </p>
      ) : null}

      <div className="space-y-8 px-4 py-6">
        {products.isLoading ? (
          <div className="h-40 animate-pulse rounded-2xl bg-secondary" />
        ) : groups.size === 0 ? (
          <EmptyState
            title="No products listed yet"
            body="This merchant hasn't added their items. Check back shortly."
          />
        ) : (
          [...groups.entries()].map(([group, items]) => (
            <section key={group}>
              <h2 className="mb-2 text-xs font-bold uppercase tracking-[0.15em] text-muted-foreground">
                {group}
              </h2>
              <ul className="divide-y divide-border">
                {items.map((p) => (
                  <li key={p.id} className="flex items-start justify-between gap-4 py-3">
                    <div className="min-w-0">
                      <p className="font-semibold leading-tight">{p.name}</p>
                      {p.description ? (
                        <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                          {p.description}
                        </p>
                      ) : null}
                      <p className="mt-1 text-sm font-bold text-primary">{naira(p.price_kobo)}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        if (!store.data) return;
                        const res = addItem(
                          { id: store.data.id, name: store.data.business_name },
                          { id: p.id, name: p.name, priceKobo: p.price_kobo },
                        );
                        toast.success(`${p.name} added`, {
                          description: res.replacedStore
                            ? "Your cart now holds items from this store only — one store per order for now."
                            : undefined,
                        });
                      }}
                      className="flex shrink-0 items-center gap-1 rounded-lg border border-border bg-secondary px-3 py-2 text-sm font-semibold active:scale-95"
                    >
                      <Plus className="size-4 text-primary" />
                      Add
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))
        )}
      </div>

      {count > 0 && cart.merchantId === merchantId ? (
        <Link
          to="/customer/cart"
          className="fixed inset-x-0 bottom-[68px] z-40 mx-auto flex max-w-[30rem] items-center justify-between bg-primary px-6 py-4 font-semibold text-primary-foreground"
        >
          <span>
            View basket ({count} item{count > 1 ? "s" : ""})
          </span>
          <span className="font-display font-extrabold">{naira(subtotal)}</span>
        </Link>
      ) : null}
    </Screen>
  );
}
