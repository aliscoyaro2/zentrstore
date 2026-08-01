import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Send, Bell, Smartphone, MessageCircle, Mail } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "@/components/admin/admin-layout";
import { useRoleGuard } from "@/hooks/use-role-guard";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/notifications")({
  head: () => ({
    meta: [
      { title: "Notifications — Zentra Admin" },
      { name: "description", content: "Send and review platform notifications to customers, merchants and riders." },
    ],
  }),
  component: NotificationsPage,
});

const CHANNELS = [
  { value: "push", label: "Push", icon: Bell },
  { value: "sms", label: "SMS", icon: Smartphone },
  { value: "whatsapp", label: "WhatsApp", icon: MessageCircle },
  { value: "email", label: "Email", icon: Mail },
] as const;

const TARGETS = [
  { value: "customers", label: "Customers" },
  { value: "merchants", label: "Merchants" },
  { value: "riders", label: "Riders" },
  { value: "everyone", label: "Everyone" },
] as const;

function NotificationsPage() {
  const { ready } = useRoleGuard("admin");
  const queryClient = useQueryClient();
  const [channel, setChannel] = useState<(typeof CHANNELS)[number]["value"]>("push");
  const [target, setTarget] = useState<(typeof TARGETS)[number]["value"]>("customers");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);

  const log = useQuery({
    queryKey: ["admin-notifications-log"],
    enabled: ready,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notifications_log")
        .select("id,channel,target,title,body,recipient_count,created_at")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
  });

  const audienceCount = useQuery({
    queryKey: ["admin-notifications-audience", target],
    enabled: ready,
    queryFn: async () => {
      if (target === "everyone") {
        const { count } = await supabase.from("profiles").select("id", { count: "exact", head: true });
        return count ?? 0;
      }
      const role = target === "customers" ? "customer" : target === "merchants" ? "merchant" : "rider";
      const { count } = await supabase
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("role", role);
      return count ?? 0;
    },
  });

  async function send() {
    if (!title.trim() || !body.trim()) {
      toast.error("Add a title and message first");
      return;
    }
    setSending(true);
    const { data: userData } = await supabase.auth.getUser();
    const { error } = await supabase.from("notifications_log").insert({
      sent_by: userData.user?.id ?? null,
      channel,
      target,
      title: title.trim(),
      body: body.trim(),
      recipient_count: audienceCount.data ?? 0,
    });
    setSending(false);
    if (error) {
      toast.error("Could not record notification", { description: error.message });
      return;
    }
    toast.success("Notification logged", {
      description: "No SMS/push/WhatsApp provider is connected yet — this records what would be sent.",
    });
    setTitle("");
    setBody("");
    queryClient.invalidateQueries({ queryKey: ["admin-notifications-log"] });
  }

  if (!ready) return null;

  return (
    <AdminLayout title="Notifications" subtitle="Compose and review platform notifications">
      <div className="mb-4 rounded-lg border border-dashed border-border bg-secondary/50 p-3 text-xs text-muted-foreground">
        No SMS, push, WhatsApp or email provider is wired in yet. Sending here records the notification in a log for
        the record — it does not actually reach users until a provider (e.g. Termii, Firebase, WhatsApp Business
        API) is connected.
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_1.2fr]">
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <p className="text-sm font-semibold text-foreground">Compose</p>

          <p className="mt-4 text-xs font-bold uppercase tracking-wide text-muted-foreground">Channel</p>
          <div className="mt-2 grid grid-cols-4 gap-2">
            {CHANNELS.map((c) => (
              <button
                key={c.value}
                type="button"
                onClick={() => setChannel(c.value)}
                className={cn(
                  "flex flex-col items-center gap-1 rounded-lg border py-2.5 text-xs font-semibold",
                  channel === c.value
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted-foreground",
                )}
              >
                <c.icon className="size-4" />
                {c.label}
              </button>
            ))}
          </div>

          <p className="mt-4 text-xs font-bold uppercase tracking-wide text-muted-foreground">Audience</p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {TARGETS.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => setTarget(t.value)}
                className={cn(
                  "rounded-lg border py-2 text-xs font-semibold",
                  target === t.value ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground",
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
          <p className="mt-1.5 text-[11px] text-muted-foreground">
            {audienceCount.data ?? 0} {target === "everyone" ? "users" : target} will be logged as recipients
          </p>

          <p className="mt-4 text-xs font-bold uppercase tracking-wide text-muted-foreground">Title</p>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Zentra is now live in Monday Market"
            className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none ring-primary/20 focus:ring-2"
          />

          <p className="mt-4 text-xs font-bold uppercase tracking-wide text-muted-foreground">Message</p>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={4}
            placeholder="Write the notification body…"
            className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none ring-primary/20 focus:ring-2"
          />

          <button
            type="button"
            onClick={send}
            disabled={sending}
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-50"
          >
            <Send className="size-4" />
            {sending ? "Sending…" : "Send notification"}
          </button>
        </div>

        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <p className="text-sm font-semibold text-foreground">Recent notifications</p>
          <div className="mt-3 divide-y divide-border">
            {log.isLoading ? (
              <p className="py-6 text-center text-xs text-muted-foreground">Loading…</p>
            ) : (log.data ?? []).length === 0 ? (
              <p className="py-6 text-center text-xs text-muted-foreground">Nothing sent yet.</p>
            ) : (
              (log.data ?? []).map((n) => (
                <div key={n.id} className="py-3">
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-foreground">{n.title}</p>
                    <span className="shrink-0 rounded-full bg-secondary px-2 py-0.5 text-[10px] font-semibold uppercase text-muted-foreground">
                      {n.channel}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{n.body}</p>
                  <p className="mt-1.5 text-[11px] text-muted-foreground">
                    {n.target} · {n.recipient_count} recipients ·{" "}
                    {n.created_at ? new Date(n.created_at).toLocaleString("en-NG") : ""}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
