import { createFileRoute, Link } from "@tanstack/react-router";
import { Store, Bike, ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/partners")({
  head: () => ({
    meta: [
      { title: "Partner with Zentra" },
      {
        name: "description",
        content:
          "Sell on Zentra or ride and deliver for Zentra Maiduguri — apply as a merchant or a rider.",
      },
      { property: "og:title", content: "Partner with Zentra" },
      {
        property: "og:description",
        content: "Two ways to work with Zentra: run a store, or ride and deliver.",
      },
    ],
  }),
  component: PartnersLanding,
});

function PartnersLanding() {
  return (
    <div className="app-shell">
      <main className="min-h-screen px-4 pb-10 pt-8">
        <Link to="/" className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground">
          <ArrowLeft className="size-4" />
          Back to Zentra
        </Link>

        <div className="mt-6">
          <span className="inline-block rounded-lg bg-primary px-3 py-1 font-display text-lg font-extrabold tracking-tight text-primary-foreground">
            Zentra Partners
          </span>
          <h1 className="mt-6 font-display text-3xl font-extrabold leading-tight">
            Work with Zentra
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Two ways to be part of Zentra Maiduguri — run your own store, or deliver on your own
            motorcycle. Pick one below to get started.
          </p>
        </div>

        <div className="mt-8 grid grid-cols-1 gap-4">
          <Link
            to="/merchant/apply"
            className="flex items-center gap-4 rounded-2xl border border-border bg-card p-5 shadow-card active:scale-[0.99]"
          >
            <span className="grid size-14 shrink-0 place-items-center rounded-xl bg-primary/10">
              <Store className="size-6 text-primary" />
            </span>
            <span className="min-w-0">
              <span className="block font-display text-lg font-extrabold leading-tight">
                Sell on Zentra
              </span>
              <span className="mt-1 block text-sm leading-snug text-muted-foreground">
                Restaurants, home kitchens, pharmacies, shops — bring your business online and
                start taking orders.
              </span>
            </span>
          </Link>

          <Link
            to="/rider/apply"
            className="flex items-center gap-4 rounded-2xl border border-border bg-card p-5 shadow-card active:scale-[0.99]"
          >
            <span className="grid size-14 shrink-0 place-items-center rounded-xl bg-primary/10">
              <Bike className="size-6 text-primary" />
            </span>
            <span className="min-w-0">
              <span className="block font-display text-lg font-extrabold leading-tight">
                Ride & deliver
              </span>
              <span className="mt-1 block text-sm leading-snug text-muted-foreground">
                Deliver orders around Maiduguri on your own motorcycle and earn per delivery.
              </span>
            </span>
          </Link>
        </div>

        <p className="mt-8 text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link to="/login" className="font-semibold text-primary">
            Sign in
          </Link>
        </p>
      </main>
    </div>
  );
}
