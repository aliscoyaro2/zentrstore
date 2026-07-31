import { Link } from "@tanstack/react-router";
import { Store, Bike, ShieldCheck, Search, CreditCard, Bell } from "lucide-react";
import { CATEGORIES } from "@/lib/categories";
import catFood from "@/assets/cat-food.jpg";

const STEPS = [
  {
    icon: Search,
    title: "Find your spot",
    body: "Browse restaurants, home kitchens, pharmacies, and shops open right now in GRA and Monday Market.",
  },
  {
    icon: CreditCard,
    title: "Pay online",
    body: "Checkout with Paystack. Your order is paid before the merchant starts, no cash at the door.",
  },
  {
    icon: Bell,
    title: "Track it live",
    body: "Watch it move from accepted to preparing to a rider on the way, right in the app.",
  },
] as const;

export function LandingPage() {
  return (
    <div className="app-shell">
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-card/90 px-4 py-3 backdrop-blur-md">
        <span className="rounded-lg bg-primary px-3 py-1 font-display text-lg font-extrabold tracking-tight text-primary-foreground">
          Zentra
        </span>
        <Link
          to="/login"
          className="rounded-xl border border-border bg-secondary px-4 py-2 text-sm font-bold"
        >
          Sign in
        </Link>
      </header>

      <main className="pb-14">
        {/* Hero */}
        <section className="px-4 pb-8 pt-8">
          <span className="inline-block rounded-full bg-accent-soft px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-accent-foreground">
            Now live in GRA &amp; Monday Market
          </span>
          <h1 className="mt-4 text-3xl leading-tight">
            Maiduguri's shops, kitchens &amp; riders — one app, no wahala
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            Order lunch, groceries, drugs, water, or gas from real vendors near you and pay
            online. A local rider brings it straight to your door.
          </p>
          <div className="mt-6 flex flex-col gap-3">
            <Link
              to="/login"
              className="w-full rounded-xl bg-primary py-3.5 text-center font-bold text-primary-foreground"
            >
              Start ordering
            </Link>
            <p className="text-center text-xs text-muted-foreground">
              Quick signup with email and password.
            </p>
          </div>
        </section>

        <section className="px-4">
          <img
            src={catFood}
            alt="Food ready for delivery from a Maiduguri kitchen"
            loading="lazy"
            width={910}
            height={512}
            className="aspect-[16/10] w-full rounded-2xl object-cover shadow-card"
          />
        </section>

        {/* Categories */}
        <section className="px-4 py-8">
          <h2 className="text-xl">Everything your side of town sells</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Real vendors already trading in Maiduguri — restaurants, home bakers, pharmacies, and
            more.
          </p>
          <div className="no-scrollbar mt-4 flex gap-3 overflow-x-auto pb-2">
            {CATEGORIES.map((c) => (
              <div key={c.value} className="flex w-16 shrink-0 flex-col items-center gap-2">
                <span className="grid size-14 place-items-center overflow-hidden rounded-2xl border border-border bg-card shadow-card">
                  {c.image ? (
                    <img
                      src={c.image}
                      alt=""
                      loading="lazy"
                      width={910}
                      height={512}
                      className="size-14 object-cover"
                    />
                  ) : (
                    <span className="font-display text-sm font-extrabold text-primary">
                      {c.short.slice(0, 2)}
                    </span>
                  )}
                </span>
                <span className="text-center text-[11px] font-medium leading-tight text-muted-foreground">
                  {c.short}
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* How it works */}
        <section className="px-4 py-8">
          <h2 className="text-xl">How it works</h2>
          <div className="mt-4 space-y-3">
            {STEPS.map((step, i) => (
              <div
                key={step.title}
                className="flex gap-4 rounded-2xl border border-border bg-card p-4 shadow-card"
              >
                <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary/10">
                  <step.icon className="size-5 text-primary" />
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Step {i + 1}
                  </p>
                  <p className="mt-0.5 font-display text-base font-extrabold leading-tight">
                    {step.title}
                  </p>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{step.body}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Trust / Paystack note */}
        <section className="px-4 pb-8">
          <div className="rounded-2xl border border-accent/30 bg-accent-soft p-4">
            <p className="text-sm font-bold text-accent-foreground">Secure payments via Paystack</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              Every order is paid online before the merchant starts preparing. No cash is handled
              at your door — for your safety and the rider's.
            </p>
          </div>
        </section>

        {/* Sell / Ride CTAs */}
        <section className="px-4 pb-10">
          <h2 className="text-xl">Selling or riding instead?</h2>
          <div className="mt-4 grid grid-cols-1 gap-3">
            <Link
              to="/merchant/apply"
              className="flex items-center gap-4 rounded-2xl border border-border bg-card p-4 shadow-card"
            >
              <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary/10">
                <Store className="size-5 text-primary" />
              </span>
              <span className="min-w-0">
                <span className="block font-display text-base font-extrabold leading-tight">
                  Sell on Zentra
                </span>
                <span className="block text-xs text-muted-foreground">
                  Restaurants, home kitchens, pharmacies, shops — register your store
                </span>
              </span>
            </Link>
            <Link
              to="/rider/apply"
              className="flex items-center gap-4 rounded-2xl border border-border bg-card p-4 shadow-card"
            >
              <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary/10">
                <Bike className="size-5 text-primary" />
              </span>
              <span className="min-w-0">
                <span className="block font-display text-base font-extrabold leading-tight">
                  Ride with Zentra
                </span>
                <span className="block text-xs text-muted-foreground">
                  Deliver around Maiduguri on your own motorcycle
                </span>
              </span>
            </Link>
          </div>
        </section>

        <footer className="border-t border-border px-4 py-6">
          <div className="flex items-center gap-2 text-muted-foreground">
            <ShieldCheck className="size-4" />
            <span className="text-xs">Zentra — built for Maiduguri, GRA &amp; Monday Market.</span>
          </div>
          <Link to="/login" className="mt-4 block text-center text-xs font-semibold text-primary">
            Already have an account? Sign in
          </Link>
        </footer>
      </main>
    </div>
  );
}
