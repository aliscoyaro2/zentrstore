import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  MessageCircle,
  Mail,
  Phone,
  HelpCircle,
} from "lucide-react";
import { Screen, PageHeader, Panel } from "@/components/zentra/shell";

export const Route = createFileRoute("/help")({
  head: () => ({
    meta: [
      { title: "Help Center | Zentra" },
      {
        name: "description",
        content: "Get help with orders, payments, and more.",
      },
    ],
  }),
  component: HelpPage,
});

function HelpPage() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const faqs = [
    {
      q: "How do I place an order?",
      a: "Browse merchants near you, add items to your cart, choose your delivery address, and pay online via Paystack. Your order will be confirmed immediately.",
    },
    {
      q: "How do I track my order?",
      a: "After placing an order, you can track the rider's location live on the map in the 'Orders' section. You'll also receive updates via WhatsApp or SMS.",
    },
    {
      q: "What payment methods are accepted?",
      a: "We accept all major debit/credit cards, bank transfers, and USSD payments through Paystack. We do not accept cash on delivery.",
    },
    {
      q: "Can I cancel my order?",
      a: "Orders can only be cancelled before the merchant has started preparing. Once confirmed, cancellations are subject to our refund policy.",
    },
    {
      q: "What if my order is damaged or wrong?",
      a: "Please report the issue immediately through the 'Report Issue' button on your order details page. We'll review and process a refund or replacement.",
    },
    {
      q: "How do I become a merchant?",
      a: "Go to your Profile → Register a Store, fill in your business details, and our team will verify and approve your account.",
    },
    {
      q: "How do I become a rider?",
      a: "Go to your Profile → Become a Rider, submit your documents and motorcycle details. After verification, you can start delivering.",
    },
    {
      q: "What are the delivery fees?",
      a: "Delivery fees are calculated based on distance, order size, and zone. You'll see the fee clearly in your cart before checkout.",
    },
  ];

  const toggleFaq = (index: number) => {
    setOpenFaq(openFaq === index ? null : index);
  };

  return (
    <Screen>
      <PageHeader
        title="Help Center"
        subtitle="Find answers or get in touch with us"
      />

      <div className="space-y-6 px-4 py-6 pb-24">
        {/* ── Contact Support Options ── */}
        <div className="grid grid-cols-3 gap-3">
          <a
            href="https://wa.me/2348000000000?text=Hello%20Zentra%20Support!"
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-col items-center gap-2 rounded-xl border border-border bg-card p-4 text-center hover:bg-muted/50 transition"
          >
            <MessageCircle className="size-6 text-green-600" />
            <span className="text-xs font-medium">WhatsApp</span>
          </a>
          <a
            href="mailto:support@zentra.com"
            className="flex flex-col items-center gap-2 rounded-xl border border-border bg-card p-4 text-center hover:bg-muted/50 transition"
          >
            <Mail className="size-6 text-blue-600" />
            <span className="text-xs font-medium">Email</span>
          </a>
          <a
            href="tel:+2348000000000"
            className="flex flex-col items-center gap-2 rounded-xl border border-border bg-card p-4 text-center hover:bg-muted/50 transition"
          >
            <Phone className="size-6 text-primary" />
            <span className="text-xs font-medium">Call</span>
          </a>
        </div>

        {/* ── FAQ Section ── */}
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-3">
            Frequently Asked Questions
          </h2>
          <div className="space-y-2">
            {faqs.map((faq, index) => (
              <Panel key={index} className="p-0 overflow-hidden">
                <button
                  onClick={() => toggleFaq(index)}
                  className="flex w-full items-center justify-between p-4 text-left hover:bg-muted/30 transition"
                >
                  <span className="text-sm font-medium">{faq.q}</span>
                  {openFaq === index ? (
                    <ChevronUp className="size-5 text-muted-foreground shrink-0" />
                  ) : (
                    <ChevronDown className="size-5 text-muted-foreground shrink-0" />
                  )}
                </button>
                {openFaq === index && (
                  <div className="border-t border-border px-4 py-3 text-sm text-muted-foreground">
                    {faq.a}
                  </div>
                )}
              </Panel>
            ))}
          </div>
        </div>

        {/* ── Quick Links ── */}
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-3">
            Policies & Information
          </h2>
          <div className="space-y-2">
            <Link
              to="/privacy"
              className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3 text-sm font-medium hover:bg-muted/50 transition"
            >
              <span>Privacy Policy</span>
              <ChevronDown className="size-5 text-muted-foreground rotate-[-90deg]" />
            </Link>
            <Link
              to="/terms"
              className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3 text-sm font-medium hover:bg-muted/50 transition"
            >
              <span>Terms of Service</span>
              <ChevronDown className="size-5 text-muted-foreground rotate-[-90deg]" />
            </Link>
            <Link
              to="/refund-policy"
              className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3 text-sm font-medium hover:bg-muted/50 transition"
            >
              <span>Refund Policy</span>
              <ChevronDown className="size-5 text-muted-foreground rotate-[-90deg]" />
            </Link>
          </div>
        </div>

        {/* ── Still need help? ── */}
        <Panel className="p-5 text-center">
          <HelpCircle className="size-8 text-muted-foreground/50 mx-auto mb-2" />
          <p className="text-sm font-medium">Still need help?</p>
          <p className="text-xs text-muted-foreground">
            Our support team is available 24/7 via WhatsApp or email.
          </p>
          <a
            href="https://wa.me/2348000000000"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-block w-full rounded-xl bg-primary py-3 font-bold text-primary-foreground hover:bg-primary/90 transition"
          >
            Contact Support
          </a>
        </Panel>
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
          to="/orders"
          className="text-center text-sm text-muted-foreground hover:text-primary transition"
        >
          Orders
        </Link>
        <Link
          to="/cart"
          className="text-center text-sm text-muted-foreground hover:text-primary transition"
        >
          Cart
        </Link>
        <Link
          to="/account"
          className="text-center text-sm text-primary font-medium"
        >
          Profile
        </Link>
      </div>
    </Screen>
  );
}