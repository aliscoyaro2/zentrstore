import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  Store,
  TrendingUp,
  Wallet,
  Smartphone,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Screen, PageHeader, Panel } from "@/components/zentra/shell";

export const Route = createFileRoute("/merchant/apply")({
  head: () => ({
    meta: [
      { title: "Sell on Zentra Maiduguri" },
      {
        name: "description",
        content:
          "Restaurants, home kitchens, pharmacies, supermarkets and more — bring your business online with Zentra Maiduguri.",
      },
      { property: "og:title", content: "Sell on Zentra" },
      { property: "og:description", content: "Replace your WhatsApp Status storefront with a real digital one." },
    ],
  }),
  component: MerchantLanding,
});

const BENEFITS = [
  { icon: Smartphone, title: "Digital storefront", body: "Customers browse and order from you directly — no more manual WhatsApp messages." },
  { icon: TrendingUp, title: "Reach more customers", body: "Get discovered by nearby customers searching your category." },
  { icon: Wallet, title: "Tracked settlements", body: "Every sale is recorded, with clear, scheduled payouts to your bank account." },
  { icon: Store, title: "Any size business", body: "From a home kitchen to a supermarket — every store is welcome." },
];

const FAQS: Array<{ q: string; a: string }> = [
  {
    q: "Do I need to create an account first?",
    a: "No. You apply directly — no separate signup. We'll only create your merchant account once your application is approved.",
  },
  {
    q: "What do I need to apply?",
    a: "Your business details, a bank account for settlement, your usual opening hours, and a valid means of ID for the business owner.",
  },
  {
    q: "How long does approval take?",
    a: "We review every application by hand, usually within a few days. You'll get an email once a decision is made.",
  },
  {
    q: "Can a home kitchen or WhatsApp-Status seller apply?",
    a: "Yes — home kitchens and local vendors are a distinct, welcome category on Zentra, with a lower commission tier.",
  },
  {
    q: "How much commission does Zentra take?",
    a: "Commission varies by category, and is confirmed during your application before you sign the agreement.",
  },
  {
    q: "How do I get paid?",
    a: "Sales are settled to the bank account you provide during your application, on a scheduled settlement cycle.",
  },
];

function MerchantLanding() {
  return (
    <Screen nav={false}>
      <PageHeader title="Sell on Zentra" back="/" />
      <div className="space-y-6 px-4 py-6">
        <div>
          <p className="font-display text-2xl font-extrabold leading-tight">
            Bring your business online.
          </p>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Join the restaurants, home kitchens, pharmacies and shops already selling on Zentra —
            a real storefront, online payments, and organized orders.
          </p>
        </div>

        <Panel className="p-4">
          <p className="text-xs font-bold uppercase tracking-[0.15em] text-muted-foreground">Why sell on Zentra</p>
          <div className="mt-3 grid grid-cols-2 gap-3">
            {BENEFITS.map(({ icon: Icon, title, body }) => (
              <div key={title} className="rounded-xl border border-border bg-secondary/40 p-3">
                <Icon className="size-5 text-primary" />
                <p className="mt-2 text-sm font-bold leading-tight">{title}</p>
                <p className="mt-1 text-xs leading-snug text-muted-foreground">{body}</p>
              </div>
            ))}
          </div>
        </Panel>

        <Panel className="p-4">
          <p className="text-xs font-bold uppercase tracking-[0.15em] text-muted-foreground">What you'll need</p>
          <ul className="mt-2 space-y-1.5 text-sm">
            <li>• Business name, category, and description</li>
            <li>• Business address and opening hours</li>
            <li>• A bank account for settlement</li>
            <li>• A valid means of ID for the business owner</li>
            <li>• A photo of your store or products (optional but recommended)</li>
          </ul>
        </Panel>

        <FaqSection />

        <Link
          to="/merchant/apply/form"
          className="block w-full rounded-xl bg-primary py-3.5 text-center font-bold text-primary-foreground"
        >
          Start your application
        </Link>
        <p className="text-center text-xs text-muted-foreground">
          Takes about 10 minutes. No account needed — you'll verify your email as you go.
        </p>
      </div>
    </Screen>
  );
}

function FaqSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  return (
    <Panel className="divide-y divide-border">
      <div className="p-4 pb-2">
        <p className="text-xs font-bold uppercase tracking-[0.15em] text-muted-foreground">
          <Store className="mr-1.5 inline size-3.5 -translate-y-px" />
          Frequently asked questions
        </p>
      </div>
      {FAQS.map((item, idx) => {
        const open = openIndex === idx;
        return (
          <div key={item.q} className="px-4">
            <button
              type="button"
              onClick={() => setOpenIndex(open ? null : idx)}
              className="flex w-full items-center justify-between gap-3 py-3 text-left"
            >
              <span className="text-sm font-semibold">{item.q}</span>
              {open ? (
                <ChevronUp className="size-4 shrink-0 text-muted-foreground" />
              ) : (
                <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
              )}
            </button>
            {open ? <p className="pb-3 text-sm leading-relaxed text-muted-foreground">{item.a}</p> : null}
          </div>
        );
      })}
    </Panel>
  );
}
