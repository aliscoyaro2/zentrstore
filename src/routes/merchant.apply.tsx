import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Screen, PageHeader, Panel } from "@/components/zentra/shell";
import { useSession } from "@/hooks/use-session";
import { CATEGORIES, type MerchantCategory } from "@/lib/categories";

export const Route = createFileRoute("/merchant/apply")({
  head: () => ({
    meta: [
      { title: "Register your store on Zentra" },
      {
        name: "description",
        content:
          "Restaurants, home kitchens, pharmacies, water and gas sellers — join Zentra Maiduguri and take orders online.",
      },
      { property: "og:title", content: "Sell on Zentra Maiduguri" },
      {
        property: "og:description",
        content: "Tell us about your store and we'll review your application within a day.",
      },
    ],
  }),
  component: MerchantApply,
});

function MerchantApply() {
  const { user, loading } = useSession();
  const navigate = useNavigate();
  const [businessName, setBusinessName] = useState("");
  const [category, setCategory] = useState<MerchantCategory>("home_kitchen");
  const [address, setAddress] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [loading, user, navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setBusy(true);
    const { error } = await supabase.from("merchants").insert({
      owner_id: user.id,
      business_name: businessName.trim(),
      category,
      address_text: address.trim() || null,
      lat: 11.8311,
      lng: 13.151,
      commission_pct: 10,
    });
    setBusy(false);
    if (error) {
      toast.error("Could not submit", { description: error.message });
      return;
    }
    toast.success("Application received", {
      description: "We'll review your store and get in touch.",
    });
    navigate({ to: "/merchant" });
  }

  return (
    <Screen>
      <PageHeader title="Sell on Zentra" subtitle="Store application" back="/" />

      <div className="space-y-5 px-4 py-6">
        <div>
          <p className="font-display text-2xl font-extrabold leading-tight">
            Bring your store to your neighbourhood.
          </p>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Whether you cook from home for WhatsApp customers or run a shop at Monday Market, you sell
            the same way on Zentra. No professional photos needed.
          </p>
        </div>

        <Panel className="p-4">
          <ol className="space-y-3 text-sm">
            <Step n={1} text="Tell us about your business" />
            <Step n={2} text="We verify and approve — usually within a day" />
            <Step n={3} text="Add your products and start taking paid orders" />
          </ol>
        </Panel>

        <form onSubmit={submit} className="space-y-4">
          <label className="block">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Business name
            </span>
            <input
              required
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              placeholder="e.g. Aisha Home Bakes"
              className="mt-2 w-full rounded-xl border border-border bg-card px-4 py-3 text-base outline-none focus:ring-2 focus:ring-primary/20"
            />
          </label>

          <label className="block">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Category
            </span>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as MerchantCategory)}
              className="mt-2 w-full rounded-xl border border-border bg-card px-4 py-3 text-base outline-none focus:ring-2 focus:ring-primary/20"
            >
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Where you trade from
            </span>
            <textarea
              rows={2}
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="e.g. Polo Area, GRA Phase 1"
              className="mt-2 w-full rounded-xl border border-border bg-card px-4 py-3 text-base outline-none focus:ring-2 focus:ring-primary/20"
            />
          </label>

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-xl bg-primary py-3.5 font-bold text-primary-foreground disabled:opacity-60"
          >
            {busy ? "Submitting..." : "Submit application"}
          </button>
        </form>
      </div>
    </Screen>
  );
}

function Step({ n, text }: { n: number; text: string }) {
  return (
    <li className="flex items-center gap-3">
      <span className="grid size-6 shrink-0 place-items-center rounded-full bg-primary/10 font-display text-xs font-extrabold text-primary">
        {n}
      </span>
      <span>{text}</span>
    </li>
  );
}
