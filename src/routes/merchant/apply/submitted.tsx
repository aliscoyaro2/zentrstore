import { createFileRoute, Link } from "@tanstack/react-router";
import { CheckCircle2, Mail, Clock } from "lucide-react";
import { Screen, Panel } from "@/components/zentra/shell";

export const Route = createFileRoute("/merchant/apply/submitted")({
  head: () => ({
    meta: [{ title: "Application submitted — Zentra" }],
  }),
  component: MerchantApplicationSubmitted,
});

function MerchantApplicationSubmitted() {
  return (
    <Screen nav={false}>
      <div className="flex min-h-screen flex-col items-center justify-center px-6 py-10 text-center">
        <div className="grid size-16 place-items-center rounded-full bg-primary/10">
          <CheckCircle2 className="size-8 text-primary" />
        </div>
        <p className="mt-6 font-display text-2xl font-extrabold">Application submitted</p>
        <p className="mt-2 max-w-xs text-sm leading-relaxed text-muted-foreground">
          Thanks for applying to sell on Zentra. We'll review your store and get back to you soon.
        </p>

        <Panel className="mt-8 w-full max-w-sm p-4 text-left">
          <div className="flex items-start gap-3">
            <Clock className="mt-0.5 size-4 shrink-0 text-primary" />
            <div>
              <p className="text-sm font-bold">Pending review</p>
              <p className="text-xs leading-relaxed text-muted-foreground">
                Our team reviews every application by hand, usually within a few days.
              </p>
            </div>
          </div>
          <div className="mt-3 flex items-start gap-3">
            <Mail className="mt-0.5 size-4 shrink-0 text-primary" />
            <div>
              <p className="text-sm font-bold">We'll email you</p>
              <p className="text-xs leading-relaxed text-muted-foreground">
                You'll get an email with the decision. If approved, it'll include a link to set up your account.
              </p>
            </div>
          </div>
        </Panel>

        <Link to="/" className="mt-8 text-sm font-semibold text-primary">
          Back to Zentra
        </Link>
      </div>
    </Screen>
  );
}
