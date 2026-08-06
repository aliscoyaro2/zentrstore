import { createFileRoute } from "@tanstack/react-router";
import { Screen, PageHeader, Panel } from "@/components/zentra/shell";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy — Zentra" },
      { name: "description", content: "How Zentra collects, uses and protects your personal data across ordering, delivery and payments." },
      { property: "og:title", content: "Privacy Policy — Zentra" },
      { property: "og:description", content: "How Zentra collects, uses and protects your personal data." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PrivacyPage,
});

const sections = [
  {
    title: "What we collect",
    body: "Your name, phone number, email, delivery addresses and order history. Riders' location is collected only while they are on an active delivery.",
  },
  {
    title: "How we use it",
    body: "To process orders, route riders, handle payments through Paystack, provide support, and improve the service. We never sell your data.",
  },
  {
    title: "Who can see it",
    body: "Merchants see only what they need to fulfil your order. Riders see your delivery address and phone number for the active delivery only.",
  },
  {
    title: "Payments",
    body: "Card details are handled entirely by Paystack. Zentra never stores your card number or CVV.",
  },
  {
    title: "Your rights",
    body: "You can request a copy of your data or ask us to delete your account at any time by contacting support.",
  },
];

function PrivacyPage() {
  return (
    <Screen>
      <PageHeader title="Privacy Policy" subtitle="Last updated August 2026" />
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
