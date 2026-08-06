import { createFileRoute } from "@tanstack/react-router";
import { Screen, PageHeader, Panel } from "@/components/zentra/shell";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms of Service — Zentra" },
      { name: "description", content: "The terms that govern using Zentra to order, sell or deliver in Maiduguri." },
      { property: "og:title", content: "Terms of Service — Zentra" },
      { property: "og:description", content: "The terms that govern using Zentra to order, sell or deliver." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TermsPage,
});

const sections = [
  {
    title: "Using Zentra",
    body: "You must provide accurate contact and address details. Accounts used for fraud, abuse of riders or merchants, or illegal goods will be blocked.",
  },
  {
    title: "Orders and pricing",
    body: "Prices and delivery fees are shown before you pay. Merchants set item prices; Zentra sets the delivery fee based on distance and zone.",
  },
  {
    title: "Payments",
    body: "Online payments are processed by Paystack. An order is only dispatched once payment is confirmed.",
  },
  {
    title: "Merchants",
    body: "Merchants are responsible for the accuracy of listings, food safety, and preparing orders within the stated time.",
  },
  {
    title: "Riders",
    body: "Riders are independent partners. They must deliver to the stated address and confirm delivery in the app.",
  },
  {
    title: "Liability",
    body: "Zentra facilitates orders between customers, merchants and riders. Our liability is limited to the value of the affected order.",
  },
];

function TermsPage() {
  return (
    <Screen>
      <PageHeader title="Terms of Service" subtitle="Last updated August 2026" />
      <div className="space-y-3">
        {sections.map((s) => (
          <Panel key={s.title}>
            <h2 className="text-sm font-bold">{s.title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{s.body}</p>
          </Panel>
        ))}
      </div>
    </Screen>
  );
}
