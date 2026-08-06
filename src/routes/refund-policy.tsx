import { createFileRoute } from "@tanstack/react-router";
import { Screen, PageHeader, Panel } from "@/components/zentra/shell";

export const Route = createFileRoute("/refund-policy")({
  head: () => ({
    meta: [
      { title: "Refund Policy — Zentra" },
      { name: "description", content: "When Zentra refunds an order, how long it takes, and how to raise a refund request." },
      { property: "og:title", content: "Refund Policy — Zentra" },
      { property: "og:description", content: "When Zentra refunds an order and how to request one." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RefundPolicyPage,
});

const sections = [
  {
    title: "Cancellations",
    body: "You can cancel free of charge until the merchant starts preparing your order. After that, the item cost may not be refundable.",
  },
  {
    title: "Missing or wrong items",
    body: "Report it from your order details page within 24 hours. Once verified, we refund the affected items or arrange a replacement.",
  },
  {
    title: "Undelivered orders",
    body: "If an order is never delivered, you get a full refund including the delivery fee.",
  },
  {
    title: "How refunds are paid",
    body: "Refunds go back to the original payment method through Paystack, typically within 3-7 business days.",
  },
];

function RefundPolicyPage() {
  return (
    <Screen>
      <PageHeader title="Refund Policy" subtitle="Last updated August 2026" />
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
