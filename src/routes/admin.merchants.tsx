import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Search, X, Star, Package, Wallet } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "@/components/admin/admin-layout";
import { AdminStatusBadge } from "@/components/admin/admin-status-badge";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { useRoleGuard } from "@/hooks/use-role-guard";
import { categoryLabel, CATEGORIES, type MerchantCategory } from "@/lib/categories";
import { naira } from "@/lib/money";

export const Route = createFileRoute("/admin/merchants")({
  head: () => ({
    meta: [
      { title: "Merchants — Zentra Admin" },
      { name: "description", content: "Review, approve and manage every merchant on Zentra." },
    ],
  }),
  component: MerchantsPage,
});

const STATUS_FILTERS = ["all", "pending", "approved", "suspended"] as const;

type MerchantRow = {
  id: string;
  owner_id: string;
  business_name: string;
  category: MerchantCategory;
  status: "pending" | "approved" | "suspended";
  address_text: string | null;
  phone: string | null;
  delivery_radius_km: number;
  commission_pct: number;
  opening_time: string | null;
  closing_time: string | null;
  is_open_override: boolean | null;
  cover_photo_url: string | null;
  cac_doc_url: string | null;
  bank_name: string | null;
  bank_account_number: string | null;
  bank_account_name: string | null;
  rejection_reason: string | null;
  created_at: string | null;
  profiles: { full_name: string | null; email: string | null } | null;
};

function MerchantsPage() {
  const { ready } = useRoleGuard("admin");
  const queryClient = useQueryClient();
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<(typeof STATUS_FILTERS)[number]>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);

  const merchants = useQuery({
    queryKey: ["admin-merchants-list"],
    enabled: ready,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("merchants")
        .select(
          "id,owner_id,business_name,category,status,address_text,phone,delivery_radius_km,commission_pct,opening_time,closing_time,is_open_override,cover_photo_url,cac_doc_url,bank_name,bank_account_number,bank_account_name,rejection_reason,created_at,profiles:owner_id(full_name,email)",
        )
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as MerchantRow[];
    },
  });

  const selected = (merchants.data ?? []).find((m) => m.id === selectedId) ?? null;

  const stats = useQuery({
    queryKey: ["admin-merchant-stats", selectedId],
    enabled: Boolean(selectedId),
    queryFn: async () => {
      const [orders, products, balance] = await Promise.all([
        supabase
          .from("orders")
          .select("total_kobo,status", { count: "exact" })
          .eq("merchant_id", selectedId!),
        supabase.from("products").select("id", { count: "exact", head: true }).eq("merchant_id", selectedId!),
        supabase
          .from("merchant_balances")
          .select("balance_kobo,last_settled_at")
          .eq("merchant_id", selectedId!)
          .maybeSingle(),
      ]);
      const revenue = (orders.data ?? [])
        .filter((o) => o.status !== "cancelled" && o.status !== "refunded")
        .reduce((sum, o) => sum + o.total_kobo, 0);
      return {
        orderCount: orders.count ?? 0,
        revenue,
        productCount: products.count ?? 0,
        balance: balance.data?.balance_kobo ?? 0,
        lastSettled: balance.data?.last_settled_at ?? null,
      };
    },
  });

  const settlementHistory = useQuery({
    queryKey: ["admin-merchant-settlements", selectedId],
    enabled: Boolean(selectedId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("settlements")
        .select("id,amount_kobo,status,created_at,paid_at")
        .eq("merchant_id", selectedId!)
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data;
    },
  });

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (merchants.data ?? []).filter((m) => {
      if (statusFilter !== "all" && m.status !== statusFilter) return false;
      if (!q) return true;
      return (
        m.business_name.toLowerCase().includes(q) ||
        (m.profiles?.email ?? "").toLowerCase().includes(q) ||
        (m.address_text ?? "").toLowerCase().includes(q)
      );
    });
  }, [merchants.data, query, statusFilter]);

  async function logAdminAction(actionType: string, targetId: string, details: object) {
    const { data } = await supabase.auth.getUser();
    if (!data.user) return;
    await supabase.from("admin_actions").insert({
      admin_id: data.user.id,
      action_type: actionType,
      target_table: "merchants",
      target_id: targetId,
      details,
    });
  }

  async function approve(m: MerchantRow) {
    const { error } = await supabase
      .from("merchants")
      .update({ status: "approved", rejection_reason: null })
      .eq("id", m.id);
    if (error) {
      toast.error("Could not approve", { description: error.message });
      return;
    }
    // Accounts are strictly single-purpose on Zentra — approving a store
    // flips the owner's account into a merchant account.
    const { error: roleError } = await supabase
      .from("profiles")
      .update({ role: "merchant" })
      .eq("id", m.owner_id);
    if (roleError) toast.error("Approved, but role update failed", { description: roleError.message });
    await logAdminAction("approve_merchant", m.id, {});
    toast.success(`${m.business_name} approved`);
    queryClient.invalidateQueries({ queryKey: ["admin-merchants-list"] });
  }

  async function reject(m: MerchantRow) {
    const reason = window.prompt("Reason for rejecting this application?");
    if (reason === null) return;
    const { error } = await supabase
      .from("merchants")
      .update({ status: "suspended", rejection_reason: reason || "Application rejected" })
      .eq("id", m.id);
    if (error) {
      toast.error("Could not reject", { description: error.message });
      return;
    }
    await logAdminAction("reject_merchant", m.id, { reason });
    toast.success(`${m.business_name} rejected`);
    queryClient.invalidateQueries({ queryKey: ["admin-merchants-list"] });
  }

  async function suspend(m: MerchantRow) {
    const reason = window.prompt("Reason for suspending this store?");
    if (reason === null) return;
    const { error } = await supabase
      .from("merchants")
      .update({ status: "suspended", rejection_reason: reason || "Suspended by admin" })
      .eq("id", m.id);
    if (error) {
      toast.error("Could not suspend", { description: error.message });
      return;
    }
    await logAdminAction("suspend_merchant", m.id, { reason });
    toast.success(`${m.business_name} suspended`);
    queryClient.invalidateQueries({ queryKey: ["admin-merchants-list"] });
  }

  async function deleteMerchant(m: MerchantRow) {
    if (!window.confirm(`Permanently delete ${m.business_name}? This cannot be undone.`)) return;
    const { error } = await supabase.from("merchants").delete().eq("id", m.id);
    if (error) {
      toast.error("Could not delete", { description: error.message });
      return;
    }
    await logAdminAction("delete_merchant", m.id, {});
    toast.success(`${m.business_name} deleted`);
    setSelectedId(null);
    queryClient.invalidateQueries({ queryKey: ["admin-merchants-list"] });
  }

  async function saveEdits(patch: Partial<MerchantRow>) {
    if (!selected) return;
    const { error } = await supabase.from("merchants").update(patch).eq("id", selected.id);
    if (error) {
      toast.error("Could not save", { description: error.message });
      return;
    }
    await logAdminAction("edit_merchant", selected.id, patch);
    toast.success("Saved");
    setEditing(false);
    queryClient.invalidateQueries({ queryKey: ["admin-merchants-list"] });
  }

  if (!ready) return null;

  return (
    <AdminLayout title="Merchants" subtitle={`${filtered.length} of ${merchants.data?.length ?? 0} merchants`}>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative">
          <Search className="pointer-events-none absolute inset-y-0 left-3 my-auto size-4 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search business name, owner email, address…"
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
              <TableHead>Business</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Owner</TableHead>
              <TableHead>Commission</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {merchants.isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                  Loading merchants…
                </TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                  No merchants match this search.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((m) => (
                <TableRow key={m.id} className="hover:bg-secondary/50">
                  <TableCell onClick={() => setSelectedId(m.id)} className="cursor-pointer font-medium">
                    {m.business_name}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{categoryLabel(m.category)}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {m.profiles?.full_name ?? m.profiles?.email ?? "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{m.commission_pct}%</TableCell>
                  <TableCell>
                    <AdminStatusBadge status={m.status} />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1.5">
                      {m.status === "pending" ? (
                        <>
                          <button
                            type="button"
                            onClick={() => approve(m)}
                            className="rounded-md bg-primary px-2.5 py-1 text-xs font-bold text-primary-foreground"
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            onClick={() => reject(m)}
                            className="rounded-md border border-destructive px-2.5 py-1 text-xs font-bold text-destructive"
                          >
                            Reject
                          </button>
                        </>
                      ) : m.status === "approved" ? (
                        <button
                          type="button"
                          onClick={() => suspend(m)}
                          className="rounded-md border border-destructive px-2.5 py-1 text-xs font-bold text-destructive"
                        >
                          Suspend
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => approve(m)}
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
        <div
          className="fixed inset-0 z-50 flex justify-end bg-foreground/20"
          onClick={() => {
            setSelectedId(null);
            setEditing(false);
          }}
        >
          <div
            className="flex h-full w-full max-w-lg flex-col overflow-y-auto bg-card p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-start justify-between">
              <div className="min-w-0">
                <p className="font-display text-lg font-bold">{selected.business_name}</p>
                <p className="text-sm text-muted-foreground">{categoryLabel(selected.category)}</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedId(null);
                  setEditing(false);
                }}
                className="text-muted-foreground"
              >
                <X className="size-5" />
              </button>
            </div>

            <AdminStatusBadge status={selected.status} />
            {selected.rejection_reason ? (
              <p className="mt-2 text-xs text-destructive">Note: {selected.rejection_reason}</p>
            ) : null}

            <div className="mt-4 grid grid-cols-3 gap-2">
              <MiniStat icon={Package} label="Orders" value={String(stats.data?.orderCount ?? "—")} />
              <MiniStat icon={Wallet} label="Revenue" value={stats.data ? naira(stats.data.revenue) : "—"} />
              <MiniStat icon={Star} label="Products" value={String(stats.data?.productCount ?? "—")} />
            </div>

            {selected.cover_photo_url ? (
              <img src={selected.cover_photo_url} alt="" className="mt-4 h-32 w-full rounded-lg object-cover" />
            ) : (
              <div className="mt-4 flex h-24 items-center justify-center rounded-lg border border-dashed border-border text-xs text-muted-foreground">
                No store photo submitted
              </div>
            )}

            {editing ? (
              <MerchantEditForm merchant={selected} onCancel={() => setEditing(false)} onSave={saveEdits} />
            ) : (
              <>
                <Section title="Business details">
                  <Field label="Owner" value={selected.profiles?.full_name ?? selected.profiles?.email ?? "—"} />
                  <Field label="Phone" value={selected.phone ?? "Not provided"} />
                  <Field label="Address" value={selected.address_text ?? "Not provided"} />
                  <Field
                    label="Opening hours"
                    value={
                      selected.opening_time && selected.closing_time
                        ? `${selected.opening_time} – ${selected.closing_time}`
                        : "Not set"
                    }
                  />
                  <Field label="Delivery radius" value={`${selected.delivery_radius_km} km`} />
                  <Field label="Commission" value={`${selected.commission_pct}%`} />
                </Section>

                <Section title="Verification">
                  <Field
                    label="CAC document"
                    value={selected.cac_doc_url ? "Submitted" : "Not submitted"}
                    href={selected.cac_doc_url ?? undefined}
                  />
                </Section>

                <Section title="Bank details">
                  <Field label="Bank" value={selected.bank_name ?? "Not provided"} />
                  <Field label="Account number" value={selected.bank_account_number ?? "Not provided"} />
                  <Field label="Account name" value={selected.bank_account_name ?? "Not provided"} />
                </Section>

                <Section title="Settlement history">
                  {(settlementHistory.data ?? []).length === 0 ? (
                    <p className="text-xs text-muted-foreground">No settlements recorded yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {(settlementHistory.data ?? []).map((s) => (
                        <div key={s.id} className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">
                            {s.created_at ? new Date(s.created_at).toLocaleDateString("en-NG") : "-"}
                          </span>
                          <AdminStatusBadge status={s.status} />
                          <span className="font-display font-semibold">{naira(s.amount_kobo)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </Section>

                <div className="mt-6 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setEditing(true)}
                    className="rounded-lg border border-border py-2.5 text-xs font-bold"
                  >
                    Edit details
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteMerchant(selected)}
                    className="rounded-lg border border-destructive py-2.5 text-xs font-bold text-destructive"
                  >
                    Delete merchant
                  </button>
                </div>
              </>
            )}
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

function Field({ label, value, href }: { label: string; value: string; href?: string }) {
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

