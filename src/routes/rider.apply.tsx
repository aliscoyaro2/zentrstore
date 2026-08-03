import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  Bike,
  Wallet,
  MapPin,
  Clock,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Screen, PageHeader, Panel } from "@/components/zentra/shell";

export const Route = createFileRoute("/rider/apply")({
  head: () => ({
    meta: [
      { title: "Ride with Zentra Maiduguri" },
      {
        name: "description",
        content: "Apply to deliver Zentra orders around Maiduguri on your own motorcycle. No account needed to apply.",
      },
      { property: "og:title", content: "Ride with Zentra" },
      { property: "og:description", content: "Steady delivery jobs across GRA and Monday Market." },
    ],
  }),
  component: RiderLanding,
});

const BENEFITS = [
  { icon: Wallet, title: "Paid per delivery", body: "Payouts are tracked per job — no guessing what you earned." },
  { icon: MapPin, title: "Stay close to home", body: "Jobs come zone by zone, so you ride around your own streets." },
  { icon: Clock, title: "Work on your schedule", body: "Go online and offline whenever suits you." },
  { icon: ShieldCheck, title: "Verified, respected", body: "Every rider is checked and verified before going live." },
];

const FAQS: Array<{ q: string; a: string }> = [
  {
    q: "Do I need to create an account first?",
    a: "No. You apply directly — no separate signup. We'll only create your rider account once your application is approved.",
  },
  {
    q: "What do I need to apply?",
    a: "Your own working motorcycle, a valid plate number, a driver's license, vehicle insurance, and a bank account for payouts. You'll also need a clear passport photograph.",
  },
  {
    q: "How long does approval take?",
    a: "We review every application by hand, usually within a few days. You'll get an email once a decision is made.",
  },
  {
    q: "Is there a minimum age?",
    a: "Yes, you must be 18 or older to ride with Zentra.",
  },
  {
    q: "How do I get paid?",
    a: "Earnings are tracked per delivery and settled to the bank account you provide during your application.",
  },
];

function RiderLanding() {
  return (
    <Screen nav={false}>
      <PageHeader title="Ride with Zentra" back="/" />
      <div className="space-y-6 px-4 py-6">
        <div>
          <p className="font-display text-2xl font-extrabold leading-tight">
            Deliver around your own streets.
          </p>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Join the riders keeping Maiduguri moving — steady jobs, tracked payouts, and zones close to home.
          </p>
        </div>

        <Panel className="p-4">
          <p className="text-xs font-bold uppercase tracking-[0.15em] text-muted-foreground">Why ride with Zentra</p>
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
            <li>• A working motorcycle you own or control</li>
            <li>• A valid plate number and driver's license</li>
            <li>• Vehicle insurance</li>
            <li>• A bank account for payouts</li>
            <li>• A clear passport photograph</li>
          </ul>
        </Panel>

        <FaqSection />

        <Link
          to="/rider/apply/form"
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
          <Bike className="mr-1.5 inline size-3.5 -translate-y-px" />
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
