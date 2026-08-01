import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { X, Send, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "@/components/admin/admin-layout";
import { AdminStatusBadge } from "@/components/admin/admin-status-badge";
import { useRoleGuard } from "@/hooks/use-role-guard";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/support")({
  head: () => ({
    meta: [
      { title: "Support — Zentra Admin" },
      { name: "description", content: "Customer, merchant and rider support tickets, plus rider safety incidents." },
    ],
  }),
  component: SupportPage,
});

const TICKET_TABS = ["open", "in_progress", "resolved", "closed", "all"] as const;
type TicketTab = (typeof TICKET_TABS)[number];

const CATEGORY_LABEL: Record<string, string> = {
  order_issue: "Order issue",
  payment: "Payment",
  account: "Account",
  merchant_complaint: "Merchant complaint",
  rider_complaint: "Rider complaint",
  other: "Other",
};

function SupportPage() {
  const { ready } = useRoleGuard("admin");
  const queryClient = useQueryClient();
  const [section, setSection] = useState<"tickets" | "incidents">("tickets");
  const [tab, setTab] = useState<TicketTab>("open");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [reply, setReply] = useState("");

  const tickets = useQuery({
    queryKey: ["admin-support-tickets"],
    enabled: ready,
    refetchInterval: 20000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("support_tickets")
        .select("id,subject,message,category,status,created_at,resolved_at,created_by,order_id,profiles:created_by(full_name,email)")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data;
    },
  });

  const incidents = useQuery({
    queryKey: ["admin-support-incidents"],
    enabled: ready && section === "incidents",
    queryFn: async () => {
      const { data, error } = await supabase
        .from("incidents")
        .select("id,type,status,notes,created_at,resolved_at,order_id,rider_id,riders(vehicle_make,plate_number)")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data;
    },
  });

  const replies = useQuery({
    queryKey: ["admin-support-ticket-replies", selectedId],
    enabled: Boolean(selectedId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("support_ticket_replies")
        .select("id,message,author_id,created_at")
        .eq("ticket_id", selectedId!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const filtered = (tickets.data ?? []).filter((t) => tab === "all" || t.status === tab);
  const selected = (tickets.data ?? []).find((t) => t.id === selectedId) ?? null;

  async function setStatus(ticketId: string, status: string) {
    const patch: Record<string, unknown> = { status };
    if (status === "resolved" || status === "closed") patch.resolved_at = new Date().toISOString();
    const { error } = await supabase.from("support_tickets").update(patch).eq("id", ticketId);
    if (error) {
      toast.error("Could not update ticket", { description: error.message });
      return;
    }
    toast.success("Ticket updated");
    queryClient.invalidateQueries({ queryKey: ["admin-support-tickets"] });
  }

  async function sendReply() {
    if (!selectedId || !reply.trim()) return;
    const { data: userData } = await supabase.auth.getUser();
    const { error } = await supabase.from("support_ticket_replies").insert({
      ticket_id: selectedId,
      author_id: userData.user?.id,
      message: reply.trim(),
    });
    if (error) {
      toast.error("Could not send reply", { description: error.message });
      return;
    }
    if (selected?.status === "open") await setStatus(selectedId, "in_progress");
    setReply("");
    queryClient.invalidateQueries({ queryKey: ["admin-support-ticket-replies", selectedId] });
  }

  async function setIncidentStatus(id: string, status: string) {
    const patch: Record<string, unknown> = { status };
    if (status === "resolved") patch.resolved_at = new Date().toISOString();
    const { error } = await supabase.from("incidents").update(patch).eq("id", id);
    if (error) {
      toast.error("Could not update incident", { description: error.message });
      return;
    }
    toast.success("Incident updated");
    queryClient.invalidateQueries({ queryKey: ["admin-support-incidents"] });
  }

  if (!ready) return null;

  return (
    <AdminLayout title="Support" subtitle={`${(tickets.data ?? []).filter((t) => t.status === "open").length} open tickets`}>
      <div className="mb-4 flex gap-2">
        <button
          type="button"
          onClick={() => setSection("tickets")}
          className={cn(
            "rounded-lg px-3 py-2 text-sm font-semibold",
            section === "tickets" ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground",
          )}
        >
          Support tickets
        </button>
        <button
          type="button"
          onClick={() => setSection("incidents")}
          className={cn(
            "rounded-lg px-3 py-2 text-sm font-semibold",
            section === "incidents" ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground",
          )}
        >
          Rider incidents
        </button>
      </div>

      {section === "tickets" ? (
        <>
          <div className="mb-4 flex flex-wrap gap-1.5">
            {TICKET_TABS.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={cn(
                  "rounded-full px-3 py-1.5 text-xs font-semibold capitalize transition-colors",
                  tab === t ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:bg-secondary/70",
                )}
              >
                {t === "all" ? "All" : t.replaceAll("_", " ")}
              </button>
            ))}
          </div>

          <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
            {tickets.isLoading ? (
              <p className="py-10 text-center text-sm text-muted-foreground">Loading tickets…</p>
            ) : filtered.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">No tickets here.</p>
            ) : (
              <div className="divide-y divide-border">
                {filtered.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setSelectedId(t.id)}
                    className="flex w-full items-center justify-between gap-3 px-5 py-3.5 text-left hover:bg-secondary/50"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="truncate font-medium text-foreground">{t.subject}</p>
                        <span className="shrink-0 rounded-full bg-secondary px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                          {CATEGORY_LABEL[t.category] ?? t.category}
                        </span>
                      </div>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {t.profiles?.full_name ?? t.profiles?.email ?? "User"} ·{" "}
                        {t.created_at ? new Date(t.created_at).toLocaleString("en-NG") : ""}
                      </p>
                    </div>
                    <AdminStatusBadge status={t.status} label={t.status.replaceAll("_", " ")} />
                  </button>
                ))}
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          {incidents.isLoading ? (
            <p className="py-10 text-center text-sm text-muted-foreground">Loading incidents…</p>
          ) : (incidents.data ?? []).length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">No incidents reported.</p>
          ) : (
            <div className="divide-y divide-border">
              {(incidents.data ?? []).map((inc) => (
                <div key={inc.id} className="flex items-center justify-between gap-3 px-5 py-3.5">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-destructive/10 text-destructive">
                      <AlertTriangle className="size-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="font-medium capitalize text-foreground">{inc.type.replaceAll("_", " ")}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {inc.riders?.vehicle_make ?? "Rider"} {inc.riders?.plate_number ?? ""} ·{" "}
                        {inc.created_at ? new Date(inc.created_at).toLocaleString("en-NG") : ""}
                      </p>
                      {inc.notes ? <p className="mt-1 text-xs text-muted-foreground">{inc.notes}</p> : null}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <AdminStatusBadge status={inc.status} />
                    {inc.status !== "resolved" ? (
                      <select
                        defaultValue=""
                        onChange={(e) => e.target.value && setIncidentStatus(inc.id, e.target.value)}
                        className="rounded-lg border border-border bg-background px-2 py-1.5 text-xs"
                      >
                        <option value="">Update…</option>
                        <option value="in_progress">In progress</option>
                        <option value="resolved">Resolved</option>
                      </select>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {selected ? (
        <div className="fixed inset-0 z-50 flex justify-end bg-foreground/20" onClick={() => setSelectedId(null)}>
          <div
            className="flex h-full w-full max-w-md flex-col overflow-y-auto bg-card p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-start justify-between">
              <div>
                <p className="text-xs text-muted-foreground">{CATEGORY_LABEL[selected.category] ?? selected.category}</p>
                <p className="mt-1 font-display text-lg font-bold">{selected.subject}</p>
              </div>
              <button type="button" onClick={() => setSelectedId(null)} className="text-muted-foreground">
                <X className="size-5" />
              </button>
            </div>

            <AdminStatusBadge status={selected.status} label={selected.status.replaceAll("_", " ")} />

            <div className="mt-4 rounded-lg border border-border bg-secondary/40 p-3 text-sm">
              <p className="text-xs font-semibold text-muted-foreground">
                {selected.profiles?.full_name ?? selected.profiles?.email ?? "User"}
              </p>
              <p className="mt-1 text-foreground">{selected.message}</p>
            </div>

            <div className="mt-4 space-y-3">
              {(replies.data ?? []).map((r) => (
                <div key={r.id} className="rounded-lg border border-border p-3 text-sm">
                  <p className="text-foreground">{r.message}</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {r.created_at ? new Date(r.created_at).toLocaleString("en-NG") : ""}
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-4 flex items-center gap-2">
              <input
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && sendReply()}
                placeholder="Reply to this ticket…"
                className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none ring-primary/20 focus:ring-2"
              />
              <button
                type="button"
                onClick={sendReply}
                className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground"
              >
                <Send className="size-4" />
              </button>
            </div>

            <div className="mt-6 grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setStatus(selected.id, "in_progress")}
                className="rounded-lg border border-info py-2 text-xs font-bold text-info"
              >
                In progress
              </button>
              <button
                type="button"
                onClick={() => setStatus(selected.id, "resolved")}
                className="rounded-lg border border-success py-2 text-xs font-bold text-success"
              >
                Resolve
              </button>
              <button
                type="button"
                onClick={() => setStatus(selected.id, "closed")}
                className="rounded-lg border border-border py-2 text-xs font-bold text-muted-foreground"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </AdminLayout>
  );
}
