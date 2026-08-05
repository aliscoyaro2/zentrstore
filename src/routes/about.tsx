import { createFileRoute, Link } from "@tanstack/react-router";
import {
  MapPin,
  Store,
  Bike,
  ShieldCheck,
  Clock,
  Smartphone,
  Heart,
  Users,
  Mail,
  Instagram,
  Facebook,
  Twitter,
  Globe,
} from "lucide-react";
import { Screen, PageHeader, Panel } from "@/components/zentra/shell";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About Zentra" },
      {
        name: "description",
        content: "Learn about Zentra — Maiduguri's local commerce and delivery platform.",
      },
    ],
  }),
  component: AboutPage,
});

function AboutPage() {
  const features = [
    { icon: Store, label: "Local Merchants", desc: "Shop from restaurants, supermarkets, pharmacies and more" },
    { icon: Bike, label: "Fast Delivery", desc: "Get your order delivered in under 35 minutes" },
    { icon: ShieldCheck, label: "Secure Payments", desc: "Pay online safely via Paystack" },
    { icon: MapPin, label: "Live Tracking", desc: "Track your rider in real-time on the map" },
    { icon: Clock, label: "Scheduled Orders", desc: "Order now, deliver later at your convenience" },
    { icon: Smartphone, label: "All in One App", desc: "Shop, track, and manage everything in one place" },
  ];

  return (
    <Screen>
      <PageHeader title="About Zentra" subtitle="Fast. Trusted. Local." />

      <div className="space-y-6 px-4 py-6 pb-24">
        {/* ── Hero ── */}
        <Panel className="p-6 text-center">
          <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Store className="size-10" />
          </div>
          <h1 className="text-2xl font-extrabold">Zentra</h1>
          <p className="text-sm text-muted-foreground">Version 1.0.0</p>
          <p className="mt-2 text-sm font-medium">Maiduguri's local commerce & delivery platform</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Connecting customers, merchants, and riders in one intelligent ecosystem.
          </p>
        </Panel>

        {/* ── Mission ── */}
        <Panel className="p-5">
          <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-2">Our Mission</h2>
          <p className="text-sm text-muted-foreground">
            To empower local businesses — from restaurants and supermarkets to home-based vendors —
            by providing a modern platform that enables online sales, efficient delivery, secure payments,
            and business growth, while giving customers access to everything they need in one app.
          </p>
        </Panel>

        {/* ── Features ── */}
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-3">Why Zentra</h2>
          <div className="grid grid-cols-2 gap-3">
            {features.map((feature) => (
              <div
                key={feature.label}
                className="rounded-xl border border-border bg-card p-4 text-center hover:shadow-sm transition"
              >
                <feature.icon className="mx-auto size-6 text-primary mb-2" />
                <p className="text-xs font-bold">{feature.label}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight">
                  {feature.desc}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* ── Team / Founder ── */}
        <Panel className="p-5">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-primary/10 text-2xl font-bold text-primary">
              A
            </div>
            <div>
              <p className="font-bold">Ali Baba Ali</p>
              <p className="text-xs text-muted-foreground">Founder & CEO</p>
              <p className="text-xs text-muted-foreground/70">Built for Maiduguri, by a local.</p>
            </div>
          </div>
        </Panel>

        {/* ── Social Links ── */}
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-3">Connect With Us</h2>
          <div className="flex gap-3">
            <a
              href="#"
              className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 py-3 text-sm font-medium hover:bg-muted/50 transition"
            >
              <Instagram className="size-5 text-pink-600" />
              Instagram
            </a>
            <a
              href="#"
              className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 py-3 text-sm font-medium hover:bg-muted/50 transition"
            >
              <Facebook className="size-5 text-blue-600" />
              Facebook
            </a>
            <a
              href="#"
              className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 py-3 text-sm font-medium hover:bg-muted/50 transition"
            >
              <Twitter className="size-5 text-sky-500" />
              Twitter
            </a>
          </div>
          <div className="mt-3">
            <a
              href="mailto:support@zentra.com"
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 py-3 text-sm font-medium hover:bg-muted/50 transition"
            >
              <Mail className="size-5 text-muted-foreground" />
              support@zentra.com
            </a>
          </div>
        </div>

        {/* ── App Info ── */}
        <div className="text-center text-xs text-muted-foreground/70 space-y-1">
          <p>Made with ❤️ in Maiduguri, Borno State, Nigeria</p>
          <p>© {new Date().getFullYear()} Zentra. All rights reserved.</p>
        </div>
      </div>

      {/* ── Bottom Navigation ── */}
      <div className="fixed bottom-0 left-0 right-0 border-t border-border bg-card py-2 px-4 flex justify-around max-w-md mx-auto">
        <Link
          to="/"
          className="text-center text-sm text-muted-foreground hover:text-primary transition"
        >
          Explore
        </Link>
        <Link
          to="/customer/orders"
          className="text-center text-sm text-muted-foreground hover:text-primary transition"
        >
          Orders
        </Link>
        <Link
          to="/customer/cart"
          className="text-center text-sm text-muted-foreground hover:text-primary transition"
        >
          Cart
        </Link>
        <Link
          to="/customer/account"
          className="text-center text-sm text-primary font-medium"
        >
          Profile
        </Link>
      </div>
    </Screen>
  );
}