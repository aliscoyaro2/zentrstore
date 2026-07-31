import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Search, ChevronDown, Store, Bike } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { CATEGORIES, categoryLabel } from "@/lib/categories";
import { Screen, PaystackNote, EmptyState } from "@/components/zentra/shell";
import { MerchantCard, type MerchantSummary } from "@/components/zentra/merchant-card";
import { LandingPage } from "@/components/zentra/landing";
import { useCart } from "@/lib/cart";
import { naira } from "@/lib/money";
import { useSession } from "@/hooks/use-session";
import { distanceKm } from "@/lib/geo";
import { roleHome } from "@/lib/roles";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Zentra — order from Maiduguri stores, delivered" },
      {
        name: "description",
        content:
          "Browse GRA and Monday Market merchants: restaurants, home kitchens, pharmacies, water and gas. Pay online, a local rider brings it.",
      },
      { property: "og:title", content: "Zentra — order from Maiduguri stores, delivered" },
      {
        property: "og:description",
        content:
          "Browse GRA and Monday Market merchants: restaurants, home kitchens, pharmacies, water and gas. Pay online, a local rider brings it.",
      },
    ],
  }),
  component: Home,
});

function Home() {
  const { user, loading, role, roleLoading } = useSession();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user && !roleLoading && role && role !== "customer") {
      navigate({ to: roleHome(role) });
    }
  }, [loading, user, roleLoading, role, navigate]);

  if (loading || (user && roleLoading)) {
    return (
      <div className="app-shell flex min-h-screen items-center justify-center">
        <span className="rounded-lg bg-primary px-3 py-1 font-display text-lg font-extrabold tracking-tight text-primary-foreground">
          Zentra
        </span>
      </div>
    );
  }

  if (!user) {
    return <LandingPage />;
  }

  if (role && role !== "customer") return null;

  return <CustomerBrowse />;
}

function CustomerBrowse() {
  const [zoneId, setZoneId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const { cart, count, subtotal } = useCart();

  const zones = useQuery({
    queryKey: ["zones"],
    queryFn: async () => {
      const { data, error } = await supabase.from("zones").select("id,name,lat,lng").order("name");
      if (error) throw error;
      return data;
    },
  });

  // Default to the first zone once zones have loaded.
  useEffect(() => {
    if (!zoneId && zones.data && zones.data.length > 0) {
      setZoneId(zones.data[0].id);
    }
  }, [zoneId, zones.data]);

  const selectedZone = zones.data?.find((z) => z.id === zoneId) ?? null;

  const merchants = useQuery({
    queryKey: ["merchants"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("merchants")
        .select(
          "id,business_name,category,address_text,is_open_override,opening_time,closing_time,lat,lng,delivery_radius_km",
        )
        .eq("status", "approved")
        .order("business_name");
      if (error) throw error;
      return data;
    },
  });

  const prices = useQuery({
    queryKey: ["merchant-min-prices"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("merchant_id,price_kobo")
        .eq("is_available", true);
      if (error) throw error;
      const min = new Map<string, number>();
      for (const row of data ?? []) {
        if (!row.merchant_id) continue;
        const seen = min.get(row.merchant_id);
        if (seen === undefined || row.price_kobo < seen) min.set(row.merchant_id, row.price_kobo);
      }
      return min;
    },
  });

  const list = useMemo<(MerchantSummary & { distanceKm?: number | null })[]>(() => {
    const q = query.trim().toLowerCase();

    const withDistance = (merchants.data ?? []).map((m) => {
      const km =
        selectedZone && selectedZone.lat != null && selectedZone.lng != null
          ? distanceKm({ lat: selectedZone.lat, lng: selectedZone.lng }, { lat: m.lat, lng: m.lng })
          : null;
      return { ...m, distanceKm: km };
    });

    return withDistance
      .filter((m) => (category ? m.category === category : true))
      .filter((m) =>
        q
          ? m.business_name.toLowerCase().includes(q) ||
            categoryLabel(m.category).toLowerCase().includes(q)
          : true,
      )
      // Only show merchants that can actually deliver to this zone.
      .filter((m) => (m.distanceKm == null ? true : m.distanceKm <= m.delivery_radius_km))
      .sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity))
      .map((m) => ({ ...m, fromKobo: prices.data?.get(m.id) ?? null }));
  }, [merchants.data, prices.data, category, query, selectedZone]);

  return (
    <Screen>
      <header className="sticky top-0 z-30 border-b border-border bg-card/90 px-4 py-3 backdrop-blur-md">
        <div className="mb-3 flex items-center justify-between">
          <div className="min-w-0">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Your zone
            </span>
            <div className="relative flex items-center gap-1">
              <select
                value={zoneId ?? ""}
                onChange={(e) => setZoneId(e.target.value)}
                aria-label="Delivery zone"
                className="appearance-none bg-transparent pr-5 font-display text-lg font-extrabold tracking-tight focus:outline-none"
              >
                {(zones.data ?? []).map((z) => (
                  <option key={z.id} value={z.id}>
                    {z.name}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-0 size-4 text-muted-foreground" />
            </div>
          </div>
          <Link
            to="/account"
            className="grid size-10 place-items-center rounded-full border border-border bg-secondary"
            aria-label="Your profile"
          >
            <span className="size-5 rounded-full border border-accent bg-accent/20" />
          </Link>
        </div>
        <div className="relative">
          <Search className="pointer-events-none absolute inset-y-0 left-3 my-auto size-4 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            type="search"
            placeholder="Find water, gas, or lunch..."
            className="w-full rounded-xl bg-secondary py-2.5 pl-10 pr-4 text-sm outline-none ring-primary/20 focus:ring-2"
          />
        </div>
      </header>

      <div className="px-4 py-6">
        <div className="no-scrollbar flex gap-3 overflow-x-auto pb-2">
          {CATEGORIES.map((c) => {
            const active = category === c.value;
            return (
              <button
                key={c.value}
                type="button"
                onClick={() => setCategory(active ? null : c.value)}
                className="flex w-16 shrink-0 flex-col items-center gap-2"
              >
                <span
                  className={`grid size-14 place-items-center rounded-2xl border shadow-card ${
                    active
                      ? "border-primary bg-primary/10"
                      : "border-border bg-card"
                  }`}
                >
                  {c.image ? (
                    <img
                      src={c.image}
                      alt=""
                      loading="lazy"
                      width={910}
                      height={512}
                      className="size-14 rounded-2xl object-cover"
                    />
                  ) : (
                    <span className="font-display text-sm font-extrabold text-primary">
                      {c.short.slice(0, 2)}
                    </span>
                  )}
                </span>
                <span
                  className={`text-center text-[11px] font-medium leading-tight ${active ? "text-primary" : "text-muted-foreground"}`}
                >
                  {c.short}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <section className="px-4">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl">Open near {selectedZone?.name ?? "you"}</h2>
          {category ? (
            <button
              type="button"
              onClick={() => setCategory(null)}
              className="text-xs font-semibold text-primary"
            >
              Clear filter
            </button>
          ) : (
            <span className="text-xs text-muted-foreground">{list.length} stores</span>
          )}
        </div>

        <div className="space-y-4">
          {merchants.isLoading ? (
            <>
              <div className="h-56 animate-pulse rounded-2xl bg-secondary" />
              <div className="h-56 animate-pulse rounded-2xl bg-secondary" />
            </>
          ) : list.length === 0 ? (
            <EmptyState
              title="Nothing here yet"
              body="No store matches that search in this zone. Try another category."
            />
          ) : (
            list.map((m) => <MerchantCard key={m.id} merchant={m} />)
          )}

          <PaystackNote />

          <div className="grid grid-cols-2 gap-3 pb-2">
            <Link
              to="/merchant/apply"
              className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-4 shadow-card"
            >
              <Store className="size-5 text-primary" />
              <span className="text-sm font-bold leading-tight">Sell on Zentra</span>
              <span className="text-xs text-muted-foreground">Register your store or kitchen</span>
            </Link>
            <Link
              to="/rider/apply"
              className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-4 shadow-card"
            >
              <Bike className="size-5 text-primary" />
              <span className="text-sm font-bold leading-tight">Ride with Zentra</span>
              <span className="text-xs text-muted-foreground">Deliver around Maiduguri</span>
            </Link>
          </div>
        </div>
      </section>

      {count > 0 ? (
        <Link
          to="/cart"
          className="fixed inset-x-0 bottom-[68px] z-40 mx-auto flex max-w-[30rem] items-center justify-between bg-primary px-4 py-3 text-primary-foreground"
        >
          <span className="text-xs font-bold uppercase tracking-wide">
            {count} item{count > 1 ? "s" : ""} · {cart.merchantName}
          </span>
          <span className="font-display text-base font-extrabold">
            {naira(subtotal)} · View cart
          </span>
        </Link>
      ) : null}
    </Screen>
  );
}