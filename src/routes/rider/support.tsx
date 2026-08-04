import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import {
  Phone,
  MessageCircle,
  AlertTriangle,
  Wrench,
  ShieldAlert,
  UserX,
  Clock3,
  Loader2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Screen, PageHeader, Panel, EmptyState } from "@/components/zentra/shell";
import { RiderBottomNav } from "@/components/zentra/rider-bottom-nav";
import { useRoleGuard } from "@/hooks/use-role-guard";

export const Route = createFileRoute("/rider/support")({
  head: () => ({
    meta: [
      { title: "Support — Zentra Rider" },
      {
        name: "description",
        content: "Get help fast, or report an emergency during a Zentra delivery.",
      },
    ],
  }),
  component: RiderSupport,
});

// Support phone/WhatsApp are stored centrally rather than hard-coded here,
// so ops can update the number without a redeploy.
function usePlatformContact() {
  return useQuery({
    queryKey: ["platform-support-contact"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("platform_settings")
        .select("support_phone,support_email")
        .eq("id", true)
        .single();
      if (error) throw error;
      return data;
    },
  });
}

const INCIDENT_TYPES: { type: string; label: string; icon: typeof Wrench; description: string }[] = [
  { type: "breakdown", label: "Motorcycle breakdown", icon: Wrench, description: "Can't continue on this bike" },
  { type: "accident", label: "Accident", icon: AlertTriangle, description: "You've been in a road accident" },
  { type: "customer_unreachable", label: "Customer unreachable", icon: UserX, description: "Can't reach the customer for drop-off" },
  { type: "merchant_not_ready", label: "Merchant delay", icon: Clock3, description: "Store isn't ready with the order" },
  { type: "security", label: "Safety concern", icon: ShieldAlert, description: "You feel unsafe right now" },
];

type ActiveJob = { id: string; merchants: { business_name: string | null } | null };

function RiderSupport() {
  const { user, ready } = useRoleGuard("rider");
  const queryClient = useQueryClient();
  const contact = usePlatformContact();
  const [reportingType, setReportingType] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  // Only offer to link a report to a job that's actually in progress right
  // now — this mirrors the "linked to the current order" rule from the
  // workflow spec, and keeps the picker from listing finished deliveries.
  const activeJob = useQuery({
    queryKey: ["rider-active-job", user?.id],
    enabled: ready,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("id,merchants(business_name)")
        .eq("rider_id", user!.id)
        .in("status", [
          "rider_assigned",
          "rider_en_route_to_merchant",
          "picked_up",
          "rider_en_route_to_customer",
        ] as never)
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as ActiveJob | null;
    },
  });

  const myTickets = useQuery({
    queryKey: ["rider-support-tickets", user?.id],
    enabled: ready,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("support_tickets")
        .select("id,subject,category,status,created_at")
        .eq("requester_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data;
    },
  });

  async function submitIncident() {
    if (!reportingType || !user) return;
    setBusy(true);

    const incidentLabel = INCIDENT_TYPES.find((i) => i.type === reportingType)?.label ?? reportingType;

    const { data: incident, error: incidentError } = await supabase
      .from("incidents")
      .insert({
        type: reportingType as never,
        rider_id: user.id,
        order_id: activeJob.data?.id ?? null,
        notes: notes.trim() || null,
      })
      .select("id")
      .single();

    if (incidentError) {
      setBusy(false);
      toast.error("Could not send report", { description: incidentError.message });
      return;
    }

    // Every incident also opens a support ticket so it shows up in the
    // ops queue alongside ordinary support requests, not just the
    // incidents list — matches how admin.support.tsx already reads both.
    const { data: ticket, error: ticketError } = await supabase
      .from("support_tickets")
      .insert({
        subject: incidentLabel,
        category: "rider",
        requester_id: user.id,
        order_id: activeJob.data?.id ?? null,
      })
      .select("id")
      .single();

    if (!ticketError && ticket) {
      await supabase.from("ticket_messages").insert({
        ticket_id: ticket.id,
        sender_id: user.id,
        body: notes.trim() || `Reported: ${incidentLabel}`,
      });
    }

    setBusy(false);
    setReportingType(null);
    setNotes("");
    toast.success("Report sent", { description: "Support has been notified and will reach out." });
    queryClient.invalidateQueries({ queryKey: ["rider-support-tickets", user.id] });
    void incident;
  }

  if (!ready) return null;

  return (
    <Screen navSlot={<RiderBottomNav />}>
      <PageHeader title="Support" subtitle="Help & emergency reporting" back="/rider" />

      <div className="space-y-4 px-4 py-5">
        {/* Contact — always available, always the top block. */}
        <div className="grid grid-cols-2 gap-3">
          <a
            href={contact.data?.support_phone ? `tel:${contact.data.support_phone}` : undefined}
            className="flex flex-col items-center gap-2 rounded-2xl border border-border bg-card p-4 text-center shadow-card"
          >
            <span className="grid size-11 place-items-center rounded-full bg-primary/10 text-primary">
              <Phone className="size-5" strokeWidth={2.2} />
            </span>
            <span className="text-sm font-bold">Call support</span>
            <span className="text-xs text-muted-foreground">{contact.data?.support_phone ?? "Loading…"}</span>
          </a>
          <a
            href={
              contact.data?.support_phone
                ? `https://wa.me/${contact.data.support_phone.replace(/[^\d]/g, "")}`
                : undefined
            }
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-col items-center gap-2 rounded-2xl border border-border bg-card p-4 text-center shadow-card"
          >
            <span className="grid size-11 place-items-center rounded-full bg-success-soft text-success">
              <MessageCircle className="size-5" strokeWidth={2.2} />
            </span>
            <span className="text-sm font-bold">WhatsApp support</span>
            <span className="text-xs text-muted-foreground">Usually replies fast</span>
          </a>
        </div>

        {activeJob.data ? (
          <p className="rounded-xl border border-primary/20 bg-primary/5 px-3 py-2 text-xs text-primary">
            Reports below will be linked to your current delivery
            {activeJob.data.merchants?.business_name ? ` from ${activeJob.data.merchants.business_name}` : ""}.
          </p>
        ) : null}

        {/* Report an issue — the emergency-reporting core of this screen. */}
        <div>
          <h2 className="pb-2 text-xs font-bold uppercase tracking-[0.15em] text-muted-foreground">
            Report an issue
          </h2>
          <div className="space-y-2">
            {INCIDENT_TYPES.map(({ type, label, icon: Icon, description }) => (
              <button
                key={type}
                type="button"
                onClick={() => setReportingType(type)}
                className={`flex w-full items-center gap-3 rounded-2xl border p-3.5 text-left transition ${
                  type === "accident" || type === "security"
                    ? "border-destructive/30 bg-destructive/5"
                    : "border-border bg-card"
                }`}
              >
                <span
                  className={`grid size-10 shrink-0 place-items-center rounded-full ${
                    type === "accident" || type === "security"
                      ? "bg-destructive/10 text-destructive"
                      : "bg-secondary text-muted-foreground"
                  }`}
                >
                  <Icon className="size-5" strokeWidth={2.2} />
                </span>
                <span>
                  <span className="block text-sm font-bold">{label}</span>
                  <span className="block text-xs text-muted-foreground">{description}</span>
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Recent reports */}
        <div>
          <h2 className="pb-2 text-xs font-bold uppercase tracking-[0.15em] text-muted-foreground">
            Your reports
          </h2>
          {myTickets.isLoading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : (myTickets.data ?? []).length === 0 ? (
            <EmptyState title="No reports yet" body="Anything you report will be tracked here." />
          ) : (
            <div className="space-y-2">
              {(myTickets.data ?? []).map((t) => (
                <Panel key={t.id} className="flex items-center justify-between gap-3 p-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold">{t.subject}</p>
                    <p className="text-xs text-muted-foreground">
                      {t.created_at ? new Date(t.created_at).toLocaleDateString("en-NG", { day: "numeric", month: "short" }) : ""}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold ${
                      t.status === "resolved" || t.status === "closed"
                        ? "bg-success-soft text-success"
                        : "bg-accent-soft text-accent-foreground"
                    }`}
                  >
                    {t.status.replaceAll("_", " ")}
                  </span>
                </Panel>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Report confirmation sheet */}
      {reportingType ? (
        <div className="fixed inset-0 z-50 flex items-end bg-black/40" onClick={() => !busy && setReportingType(null)}>
          <div
            className="w-full rounded-t-3xl bg-card p-5 pb-8"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="font-display text-lg font-extrabold">
              {INCIDENT_TYPES.find((i) => i.type === reportingType)?.label}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Add any details that will help support respond quickly. This is optional.
            </p>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="What's happening?"
              rows={3}
              className="mt-3 w-full rounded-xl border border-border bg-secondary/40 p-3 text-sm outline-none focus:border-primary"
            />
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => setReportingType(null)}
                disabled={busy}
                className="flex-1 rounded-xl border border-border py-3 text-sm font-bold text-muted-foreground"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submitIncident}
                disabled={busy}
                className="flex-1 rounded-xl bg-destructive py-3 text-sm font-bold text-destructive-foreground disabled:opacity-60"
              >
                {busy ? "Sending…" : "Send report"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </Screen>
  );
}
