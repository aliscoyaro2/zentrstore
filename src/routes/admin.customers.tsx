import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Search, X, Package, MapPin, Star, ShieldOff, KeyRound } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "@/components/admin/admin-layout";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { useRoleGuard } from "@/hooks/use-role-guard";
import { statusLabel } from "@/components/zentra/status-rail";
import { naira } from "@/lib/money";

export const Route = createFileRoute("/admin/customers")({
  head: () => ({
    meta: [
      { title: "Customers — Zentra Admin" },
      { name: "description", content: "Look up customer orders, addresses, reviews and account status." },
    ],
  }),
  component: CustomersPage,
});

type CustomerRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  is_blocked: boolean;
  blocked_reason: string | null;
  created_at: string | null;
};

function CustomersPage() {
  const { ready } = useRoleGuard("admin");
  const queryClient = useQueryClient();
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const customers = useQuery({
    queryKey: ["admin-customers-list"],
    enabled: ready,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id,full_name,email,phone,is_blocked,blocked_reason,created_at")
        .eq("role", "customer")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as CustomerRow[];
    },
  });

  const selected = (customers.data ?? []).find((c) => c.id === selectedId) ?? null;

  const orderCounts = useQuery({
    queryKey: ["admin-customer-order-counts"],
    enabled: ready,
    queryFn: async () => {
      const { data, error } = await supabase.from("orders").select("customer_id,total_kobo,status");
      if (error) throw error;
      const map = new Map<string, { count: number; spend: number }>();
      for (const row of data ?? []) {
        if (!row.customer_id) continue;
        const entry = map.get(row.customer_id) ?? { count: 0, spend: 0 };
        entry.count += 1;
        if (row.status !== "cancelled" && row.status !== "refunded") entry.spend += row.total_kobo;
        map.set(row.customer_id, entry);
      }
      return map;
    },
  });

  const detail = useQuery({
    queryKey: ["admin-customer-detail", selectedId],
    enabled: Boolean(selectedId),
    queryFn: async () => {
      const [orders, addresses, reviews] = await Promise.all([
        supabase
          .from("orders")
          .select("id,status,total_kobo,placed_at,merchants(business_name)")
          .eq("customer_id", selectedId!)
          .order("placed_at", { ascending: false })
          .limit(10),
        supabase.from("addresses").select("id,label,formatted").eq("user_id", selectedId!),
        supabase.from("reviews").select("id,rating,comment,created_at").eq("customer_id", selectedId!).limit(10),
      ]);
      return {
        orders: orders.data ?? [],
        addresses: addresses.data ?? [],
        reviews: reviews.data ?? [],
      };
    },
  });

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return customers.data ?? [];
    return (customers.data ?? []).filter(
      (c) =>
        (c.full_name ?? "").toLowerCase().includes(q) ||
        (c.email ?? "").toLowerCase().includes(q) ||
        (c.phone ?? "").toLowerCase().includes(q),
    );
  }, [customers.data, query]);

  async function logAdminAction(actionType: string, targetId: string, details: object) {
    const { data } = await supabase.auth.getUser();
    if (!data.user) return;
    await supabase.from("admin_actions").insert({
      admin_id: data.user.id,
      action_type: actionType,
      target_table: "profiles",
      target_id: targetId,
      details,
    });
  }

  async function toggleBlock(c: CustomerRow) {
    if (!c.is_blocked) {
      const reason = window.prompt("Reason for blocking this customer?");
      if (reason === null) return;
      const { error } = await supabase
        .from("profiles")
        .update({ is_blocked: true, blocked_reason: reason || "Blocked by admin" })
        .eq("id", c.id);
      if (error) {
        toast.error("Could not block", { description: error.message });
        return;
      }
      await logAdminAction("block_customer", c.id, { reason });
      toast.success("Customer blocked — they'll be signed out on next request");
    } else {
      const { error } = await supabase
        .from("profiles")
        .update({ is_blocked: false, blocked_reason: null })
        .eq("id", c.id);
      if (error) {
        toast.error("Could not unblock", { description: error.message });
        return;
      }
      await logAdminAction("unblock_customer", c.id, {});
      toast.success("Customer unblocked");
    }
    queryClient.invalidateQueries({ queryKey: ["admin-customers-list"] });
  }

  async function sendPasswordReset(c: CustomerRow) {
    if (!c.email) {
      toast.error("No email on file for this account");
      return;
    }
    const { error } = await supabase.auth.resetPasswordForEmail(c.email);
    if (error) {
      toast.error("Could not send reset email", { description: error.message });
      return;
    }
    await logAdminAction("send_password_reset", c.id, {});
    toast.success(`Password reset email sent to ${c.email}`);
  }

  async function deleteCustomer(c: CustomerRow) {
    if (
      !window.confirm(
        `Permanently delete ${c.full_name ?? c.email}? Their orders will remain but stop showing a name.`,
      )
    )
      return;
    const { error } = await supabase.from("profiles").delete().eq("id", c.id);
    if (error) {
      toast.error("Could not delete", { description: error.message });
      return;
    }
    await logAdminAction("delete_customer", c.id, {});
    toast.success("Customer deleted");
    setSelectedId(null);
    queryClient.invalidateQueries({ queryKey: ["admin-customers-list"] });
  }

  if (!ready) return null;

  return (
    <AdminLayout title="Customers" subtitle={`${filtered.length} of ${customers.data?.length ?? 0} customers`}>
      <div className="relative mb-4 w-80">
        <Search className="pointer-events-none absolute inset-y-0 left-3 my-auto size-4 text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search name, email, phone…"
          className="w-full rounded-lg border border-border bg-card py-2 pl-9 pr-3 text-sm outline-none ring-primary/20 focus:ring-2"
        />
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Customer</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Orders</TableHead>
              <TableHead>Total spend</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {customers.isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                  Loading customers…
                </TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                  No customers match this search.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((c) => {
                const stat = orderCounts.data?.get(c.id);
                return (
                  <TableRow key={c.id} className="hover:bg-secondary/50">
                    <TableCell onClick={() => setSelectedId(c.id)} className="cursor-pointer font-medium">
                      {c.full_name ?? "No name set"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{c.email ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{stat?.count ?? 0}</TableCell>
                    <TableCell className="text-muted-foreground">{naira(stat?.spend ?? 0)}</TableCell>
                    <TableCell>
                      {c.is_blocked ? (
                        <span className="inline-flex items-center rounded-full bg-destructive/10 px-2.5 py-1 text-[11px] font-semibold text-destructive">
                          Blocked
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-success-soft px-2.5 py-1 text-[11px] font-semibold text-success">
                          Active
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <button
                        type="button"
                        onClick={() => toggleBlock(c)}
                        className={`rounded-md px-2.5 py-1 text-xs font-bold ${
                          c.is_blocked
                            ? "bg-primary text-primary-foreground"
                            : "border border-destructive text-destructive"
                        }`}
                      >
                        {c.is_blocked ? "Unblock" : "Block"}
                      </button>
                    </TableCell>
                  </TableRow>
                );
              })
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
              <div className="min-w-0">
                <p className="font-display text-lg font-bold">{selected.full_name ?? "No name set"}</p>
                <p className="text-sm text-muted-foreground">{selected.email}</p>
              </div>
              <button type="button" onClick={() => setSelectedId(null)} className="text-muted-foreground">
                <X className="size-5" />
              </button>
            </div>

            {selected.is_blocked ? (
              <div className="rounded-lg bg-destructive/10 p-3 text-xs text-destructive">
                Blocked{selected.blocked_reason ? `: ${selected.blocked_reason}` : ""}
              </div>
            ) : null}

            <Section title="Contact">
              <Field label="Phone" value={selected.phone ?? "Not provided"} />
              <Field
                label="Joined"
                value={selected.created_at ? new Date(selected.created_at).toLocaleDateString("en-NG") : "—"}
              />
            </Section>

            <Section title={`Recent orders (${detail.data?.orders.length ?? 0})`}>
              {(detail.data?.orders ?? []).length === 0 ? (
                <p className="text-xs text-muted-foreground">No orders yet.</p>
              ) : (
                <div className="space-y-2">
                  {(detail.data?.orders ?? []).map((o) => (
                    <div key={o.id} className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-1.5 text-muted-foreground">
                        <Package className="size-3.5" />
                        {o.merchants?.business_name ?? "Store"}
                      </span>
                      <span className="text-xs text-muted-foreground">{statusLabel(o.status)}</span>
                      <span className="font-display font-semibold">{naira(o.total_kobo)}</span>
                    </div>
                  ))}
                </div>
              )}
            </Section>

            <Section title="Addresses">
              {(detail.data?.addresses ?? []).length === 0 ? (
                <p className="text-xs text-muted-foreground">No saved addresses.</p>
              ) : (
                <div className="space-y-2">
                  {(detail.data?.addresses ?? []).map((a) => (
                    <div key={a.id} className="flex items-start gap-1.5 text-sm">
                      <MapPin className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                      <span>
                        <span className="font-medium">{a.label}</span> — {a.formatted}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </Section>

            <Section title="Reviews left">
              {(detail.data?.reviews ?? []).length === 0 ? (
                <p className="text-xs text-muted-foreground">No reviews left yet.</p>
              ) : (
                <div className="space-y-2">
                  {(detail.data?.reviews ?? []).map((r) => (
                    <div key={r.id} className="flex items-start gap-1.5 text-sm">
                      <Star className="mt-0.5 size-3.5 shrink-0 text-accent" />
                      <span>
                        {r.rating}/5 {r.comment ? `— ${r.comment}` : ""}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </Section>

            <div className="mt-5 rounded-lg border border-dashed border-border p-3 text-xs text-muted-foreground">
              Wallet balance isn't tracked for customers yet — Zentra only supports online payment per
              order, no stored credit.
            </div>

            <div className="mt-6 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => sendPasswordReset(selected)}
                className="flex items-center justify-center gap-1.5 rounded-lg border border-border py-2.5 text-xs font-bold"
              >
                <KeyRound className="size-3.5" />
                Reset password
              </button>
              <button
                type="button"
                onClick={() => toggleBlock(selected)}
                className={`flex items-center justify-center gap-1.5 rounded-lg py-2.5 text-xs font-bold ${
                  selected.is_blocked
                    ? "bg-primary text-primary-foreground"
                    : "border border-destructive text-destructive"
                }`}
              >
                <ShieldOff className="size-3.5" />
                {selected.is_blocked ? "Unblock" : "Block"}
              </button>
              <button
                type="button"
                onClick={() => deleteCustomer(selected)}
                className="col-span-2 rounded-lg border border-destructive py-2.5 text-xs font-bold text-destructive"
              >
                Delete account
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </AdminLayout>
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

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
