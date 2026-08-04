import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Search, X, Star, Package, Wallet, MapPin } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "@/components/admin/admin-layout";
import { AdminStatusBadge } from "@/components/admin/admin-status-badge";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { useRoleGuard } from "@/hooks/use-role-guard";
import { naira } from "@/lib/money";

export const Route = createFileRoute("/admin/riders")({
  head: () => ({
    meta: [
      { title: "Riders — Zentra Admin" },
      { name: "description", content: "Review, approve and manage every rider on Zentra." },
    ],
  }),
  component: RidersPage,
});

const STATUS_FILTERS = ["all", "pending", "approved", "suspended"] as const;

type RiderRow = {
  id: string;
  status: "pending" | "approved" | "suspended";
  vehicle_make: string | null;
  vehicle_model: string | null;
  plate_number: string | null;
  photo_url: string | null;
  national_id_doc_url: string | null;
  is_online: boolean | null;
  current_lat: number | null;
  current_lng: number | null;
  last_location_at: string | null;
  rating_avg: number | null;
  total_deliveries: number | null;
  acceptance_rate: number | null;
  created_at: string | null;
  profiles: { full_name: string | null; email: string | null } | null;
};

function RidersPage() {
  const { ready } = useRoleGuard("admin");
  const queryClient = useQueryClient();
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<(typeof STATUS_FILTERS)[number]>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const riders = useQuery({
    queryKey: ["admin-riders-list"],
    enabled: ready,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("riders")
        .select(
          "id,status,vehicle_make,vehicle_model,plate_number,photo_url,national_id_doc_url,is_online,current_lat,current_lng,last_location_at,rating_avg,total_deliveries,acceptance_rate,created_at,profiles:id(full_name,email)",
        )
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as RiderRow[];
    },
  });

  const selected = (riders.data ?? []).find((r) => r.id === selectedId) ?? null;

  const stats = useQuery({
    queryKey: ["admin-rider-stats", selectedId],
    enabled: Boolean(selectedId),
    queryFn: async () => {
      const [orders, balance] = await Promise.all([
        supabase
          .from("orders")
          .select("delivery_fee_kobo,status", { count: "exact" })
          .eq("rider_id", selectedId!),
        supabase
          .from("rider_balances")
          .select("balance_kobo,last_settled_at")
          .eq("rider_id", selectedId!)
          .maybeSingle(),
      ]);
      const delivered = (orders.data ?? []).filter((o) => o.status === "delivered");
      const cancelled = (orders.data ?? []).filter((o) => o.status === "cancelled");
      const earnings = delivered.reduce((sum, o) => sum + o.delivery_fee_kobo, 0);
      const total = orders.count ?? 0;
      return {
        totalOrders: total,
        deliveredCount: delivered.length,
        cancellationRate: total > 0 ? Math.round((cancelled.length / total) * 100) : 0,
        earnings,
        balance: balance.data?.balance_kobo ?? 0,
      };
    },
  });

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (riders.data ?? []).filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (!q) return true;
      return (
        (r.profiles?.full_name ?? "").toLowerCase().includes(q) ||
        (r.profiles?.email ?? "").toLowerCase().includes(q) ||
        (r.plate_number ?? "").toLowerCase().includes(q) ||
        (r.vehicle_make ?? "").toLowerCase().includes(q)
      );
    });
  }, [riders.data, query, statusFilter]);

  async function logAdminAction(actionType: string, targetId: string, details: Record<string, unknown>) {
    const { data } = await supabase.auth.getUser();
    if (!data.user) return;
    await supabase.from("admin_actions").insert({
      admin_id: data.user.id,
      action_type: actionType,
      target_table: "riders",
      target_id: targetId,
      details: details as never,
    });
  }

  async function approve(r: RiderRow) {
    const { error } = await supabase.from("riders").update({ status: "approved" }).eq("id", r.id);
    if (error) {
      toast.error("Could not approve", { description: error.message });
      return;
    }
    const { error: roleError } = await supabase.from("profiles").update({ role: "rider" }).eq("id", r.id);
    if (roleError) toast.error("Approved, but role update failed", { description: roleError.message });
    await logAdminAction("approve_rider", r.id, {});
    toast.success("Rider approved");
    queryClient.invalidateQueries({ queryKey: ["admin-riders-list"] });
  }

  async function reject(r: RiderRow) {
    const reason = window.prompt("Reason for rejecting this application?");
    if (reason === null) return;
    const { error } = await supabase.from("riders").update({ status: "suspended" }).eq("id", r.id);
    if (error) {
      toast.error("Could not reject", { description: error.message });
      return;
    }
    await logAdminAction("reject_rider", r.id, { reason });
    toast.success("Rider rejected");
    queryClient.invalidateQueries({ queryKey: ["admin-riders-list"] });
  }

  async function suspend(r: RiderRow) {
    const reason = window.prompt("Reason for suspending this rider?");
    if (reason === null) return;
    const { error } = await supabase.from("riders").update({ status: "suspended", is_online: false }).eq("id", r.id);
    if (error) {
      toast.error("Could not suspend", { description: error.message });
      return;
    }
    await logAdminAction("suspend_rider", r.id, { reason });
    toast.success("Rider suspended");
    queryClient.invalidateQueries({ queryKey: ["admin-riders-list"] });
  }

  async function deactivate(r: RiderRow) {
    if (!window.confirm("Force this rider offline right now?")) return;
    const { error } = await supabase.from("riders").update({ is_online: false }).eq("id", r.id);
    if (error) {
      toast.error("Could not deactivate", { description: error.message });
      return;
    }
    await logAdminAction("deactivate_rider", r.id, {});
    toast.success("Rider taken offline");
    queryClient.invalidateQueries({ queryKey: ["admin-riders-list"] });
  }

  if (!ready) return null;

  return (
    <AdminLayout title="Riders" subtitle={`${filtered.length} of ${riders.data?.length ?? 0} riders`}>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative">
          <Search className="pointer-events-none absolute inset-y-0 left-3 my-auto size-4 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, email, plate number, bike…"
            className="w-80 rounded-lg border border-border bg-card py-2 pl-9 pr-3 text-sm outline-none ring-primary/20 focus:ring-2"
          />
        </div>
        <div className="flex gap-1.5">
          {STATUS_FILTERS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatusFilter(s)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold capitalize transition-colors ${
                statusFilter === s
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-muted-foreground hover:bg-secondary/70"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Rider</TableHead>
              <TableHead>Bike</TableHead>
              <TableHead>Online</TableHead>
              <TableHead>Deliveries</TableHead>
              <TableHead>Rating</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {riders.isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                  Loading riders…
                </TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                  No riders match this search.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((r) => (
                <TableRow key={r.id} className="hover:bg-secondary/50">
                  <TableCell onClick={() => setSelectedId(r.id)} className="cursor-pointer">
                    <div className="flex items-center gap-2">
                      {r.photo_url ? (
                        <img src={r.photo_url} alt="" className="size-7 shrink-0 rounded-full object-cover" />
                      ) : (
                        <span className="grid size-7 shrink-0 place-items-center rounded-full bg-secondary text-[10px] font-bold text-muted-foreground">
                          {(r.profiles?.full_name ?? r.profiles?.email ?? "R").charAt(0).toUpperCase()}
                        </span>
                      )}
                      <span className="font-medium">{r.profiles?.full_name ?? r.profiles?.email ?? "Rider"}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {`${r.vehicle_make ?? ""} ${r.vehicle_model ?? ""}`.trim() || "—"}
                  </TableCell>
                  <TableCell>
                    <span
                      className={`inline-flex items-center gap-1 text-xs font-semibold ${r.is_online ? "text-success" : "text-muted-foreground"}`}
                    >
                      <span className={`size-1.5 rounded-full ${r.is_online ? "bg-success" : "bg-muted-foreground"}`} />
                      {r.is_online ? "Online" : "Offline"}
                    </span>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{r.total_deliveries ?? 0}</TableCell>
                  <TableCell className="text-muted-foreground">{Number(r.rating_avg ?? 5).toFixed(1)}</TableCell>
                  <TableCell>
                    <AdminStatusBadge status={r.status} />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1.5">
                      {r.status === "pending" ? (
                        <>
                          <button
                            type="button"
                            onClick={() => approve(r)}
                            className="rounded-md bg-primary px-2.5 py-1 text-xs font-bold text-primary-foreground"
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            onClick={() => reject(r)}
                            className="rounded-md border border-destructive px-2.5 py-1 text-xs font-bold text-destructive"
                          >
                            Reject
                          </button>
                        </>
                      ) : r.status === "approved" ? (
                        <button
                          type="button"
                          onClick={() => suspend(r)}
                          className="rounded-md border border-destructive px-2.5 py-1 text-xs font-bold text-destructive"
                        >
                          Suspend
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => approve(r)}
                          className="rounded-md bg-primary px-2.5 py-1 text-xs font-bold text-primary-foreground"
                        >
                          Reinstate
                        </button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {selected ? (
        <div className="fixed inset-0 z-50 flex justify-end bg-foreground/20" onClick={() => setSelectedId(null)}>
          <div
            className="flex h-full w-full max-w-lg flex-col overflow-y-auto bg-card p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-start justify-between">
              <div className="flex items-center gap-3">
                {selected.photo_url ? (
                  <img src={selected.photo_url} alt="" className="size-12 rounded-full object-cover" />
                ) : (
                  <span className="grid size-12 place-items-center rounded-full bg-secondary font-display font-bold text-muted-foreground">
                    {(selected.profiles?.full_name ?? "R").charAt(0).toUpperCase()}
                  </span>
                )}
                <div className="min-w-0">
                  <p className="font-display text-lg font-bold">
                    {selected.profiles?.full_name ?? selected.profiles?.email ?? "Rider"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {`${selected.vehicle_make ?? ""} ${selected.vehicle_model ?? ""}`.trim() || "No vehicle info"}
                  </p>
                </div>
              </div>
              <button type="button" onClick={() => setSelectedId(null)} className="text-muted-foreground">
                <X className="size-5" />
              </button>
            </div>

            <AdminStatusBadge status={selected.status} />

            <div className="mt-4 grid grid-cols-3 gap-2">
              <MiniStat icon={Package} label="Deliveries" value={String(stats.data?.deliveredCount ?? "—")} />
              <MiniStat icon={Star} label="Rating" value={Number(selected.rating_avg ?? 5).toFixed(1)} />
              <MiniStat icon={Wallet} label="Earnings" value={stats.data ? naira(stats.data.earnings) : "—"} />
            </div>

            <Section title="Performance">
              <Field label="Total orders" value={String(stats.data?.totalOrders ?? "—")} />
              <Field label="Acceptance rate" value={`${selected.acceptance_rate ?? 100}%`} />
              <Field
                label="Cancellation rate"
                value={stats.data ? `${stats.data.cancellationRate}%` : "—"}
              />
              <Field label="Distance covered" value="Not tracked yet" />
            </Section>

            <Section title="Vehicle & documents">
              <Field label="Plate number" value={selected.plate_number ?? "Not provided"} />
              <Field
                label="ID document"
                value={selected.national_id_doc_url ? "Submitted" : "Not submitted"}
                {...(selected.national_id_doc_url ? { href: selected.national_id_doc_url } : {})}
              />
            </Section>

            <Section title="Live location">
              {selected.current_lat && selected.current_lng ? (
                <Field
                  label="Last seen"
                  value={
                    selected.last_location_at
                      ? new Date(selected.last_location_at).toLocaleString("en-NG")
                      : "Unknown time"
                  }
                />
              ) : (
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <MapPin className="size-3.5" />
                  No location reported yet.
                </p>
              )}
            </Section>

            <div className="mt-6 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => deactivate(selected)}
                disabled={!selected.is_online}
                className="rounded-lg border border-border py-2.5 text-xs font-bold disabled:opacity-40"
              >
                Force offline
              </button>
              {selected.status === "approved" ? (
                <button
                  type="button"
                  onClick={() => suspend(selected)}
                  className="rounded-lg border border-destructive py-2.5 text-xs font-bold text-destructive"
                >
                  Suspend rider
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => approve(selected)}
                  className="rounded-lg bg-primary py-2.5 text-xs font-bold text-primary-foreground"
                >
                  Approve rider
                </button>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </AdminLayout>
  );
}

function MiniStat({ icon: Icon, label, value }: { icon: typeof Package; label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border p-2.5 text-center">
      <Icon className="mx-auto size-3.5 text-muted-foreground" />
      <p className="mt-1 font-display text-sm font-bold">{value}</p>
      <p className="text-[10px] text-muted-foreground">{label}</p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-5">
      <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{title}</p>
      <div className="mt-2 space-y-1.5 rounded-lg border border-border p-3">{children}</div>
    </div>
  );
}

function Field({ label, value, href }: { label: string; value: string; href?: string | undefined }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      {href ? (
        <a href={href} target="_blank" rel="noreferrer" className="font-medium text-primary underline">
          {value}
        </a>
      ) : (
        <span className="font-medium">{value}</span>
      )}
    </div>
  );
}
