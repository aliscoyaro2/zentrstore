import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { UserPlus, X, ShieldOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "@/components/admin/admin-layout";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { useRoleGuard } from "@/hooks/use-role-guard";
import { useSession } from "@/hooks/use-session";

export const Route = createFileRoute("/admin/admins")({
  head: () => ({
    meta: [
      { title: "Admin Users — Zentra Admin" },
      { name: "description", content: "Grant, adjust and revoke Zentra admin access." },
    ],
  }),
  component: AdminUsersPage,
});

const ADMIN_ROLES = [
  { value: "super_admin", label: "Super Admin" },
  { value: "operations_manager", label: "Operations Manager" },
  { value: "support_agent", label: "Support Agent" },
  { value: "finance_officer", label: "Finance Officer" },
  { value: "merchant_manager", label: "Merchant Manager" },
  { value: "rider_manager", label: "Rider Manager" },
  { value: "marketing_manager", label: "Marketing Manager" },
] as const;

type AdminRole = (typeof ADMIN_ROLES)[number]["value"];

type AdminRow = {
  id: string;
  admin_role: AdminRole;
  created_at: string | null;
  profiles: { full_name: string | null; email: string | null } | null;
};

function roleLabel(role: string) {
  return ADMIN_ROLES.find((r) => r.value === role)?.label ?? role.replaceAll("_", " ");
}

function AdminUsersPage() {
  const { ready } = useRoleGuard("admin");
  const { user: currentUser } = useSession();
  const queryClient = useQueryClient();
  const [inviting, setInviting] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<AdminRole>("support_agent");
  const [busy, setBusy] = useState(false);

  const admins = useQuery({
    queryKey: ["admin-users-list"],
    enabled: ready,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("admin_users")
        .select("id,admin_role,created_at,profiles:id(full_name,email)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as AdminRow[];
    },
  });

  async function logAdminAction(actionType: string, targetId: string, details: object) {
    const { data } = await supabase.auth.getUser();
    if (!data.user) return;
    await supabase.from("admin_actions").insert({
      admin_id: data.user.id,
      action_type: actionType,
      target_table: "admin_users",
      target_id: targetId,
      details: details as never,
    });
  }

  async function grantAdmin() {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) return;
    setBusy(true);

    // Admin access can only be granted to an existing Zentra account —
    // this looks the person up by the email already on their profile
    // rather than inviting a brand new account from here.
    const { data: existing, error: lookupError } = await supabase
      .from("profiles")
      .select("id,role,email,full_name")
      .eq("email", trimmed)
      .maybeSingle();

    if (lookupError || !existing) {
      setBusy(false);
      toast.error(
        "No Zentra account with that email",
        { description: "They need to sign up first — then you can grant admin access." },
      );
      return;
    }

    const { error: roleError } = await supabase.from("profiles").update({ role: "admin" }).eq("id", existing.id);
    if (roleError) {
      setBusy(false);
      toast.error("Could not update role", { description: roleError.message });
      return;
    }

    const { error: adminError } = await supabase
      .from("admin_users")
      .upsert({ id: existing.id, admin_role: role }, { onConflict: "id" });
    setBusy(false);
    if (adminError) {
      toast.error("Could not grant admin access", { description: adminError.message });
      return;
    }

    await logAdminAction("grant_admin", existing.id, { role, email: trimmed });
    toast.success(`${existing.full_name ?? trimmed} is now a ${roleLabel(role)}`);
    setEmail("");
    setInviting(false);
    queryClient.invalidateQueries({ queryKey: ["admin-users-list"] });
  }

  async function changeRole(adminId: string, newRole: AdminRole) {
    const { error } = await supabase.from("admin_users").update({ admin_role: newRole }).eq("id", adminId);
    if (error) {
      toast.error("Could not update role", { description: error.message });
      return;
    }
    await logAdminAction("change_admin_role", adminId, { new_role: newRole });
    toast.success("Role updated");
    queryClient.invalidateQueries({ queryKey: ["admin-users-list"] });
  }

  async function revoke(a: AdminRow) {
    if (a.id === currentUser?.id) {
      toast.error("You can't revoke your own admin access from here.");
      return;
    }
    if (!window.confirm(`Revoke admin access for ${a.profiles?.full_name ?? a.profiles?.email}?`)) return;

    const { error: adminError } = await supabase.from("admin_users").delete().eq("id", a.id);
    if (adminError) {
      toast.error("Could not revoke", { description: adminError.message });
      return;
    }
    // Drop them back to an ordinary customer account — the safest default
    // once admin/internal-staff access is removed.
    const { error: roleError } = await supabase.from("profiles").update({ role: "customer" }).eq("id", a.id);
    if (roleError) toast.error("Revoked, but role reset failed", { description: roleError.message });

    await logAdminAction("revoke_admin", a.id, {});
    toast.success("Admin access revoked");
    queryClient.invalidateQueries({ queryKey: ["admin-users-list"] });
  }

  if (!ready) return null;

  return (
    <AdminLayout title="Admin Users" subtitle={`${admins.data?.length ?? 0} people with admin access`}>
      <div className="mb-4 flex justify-end">
        <button
          type="button"
          onClick={() => setInviting(true)}
          className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground"
        >
          <UserPlus className="size-4" />
          Grant admin access
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Admin</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Added</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {admins.isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                  Loading admin users…
                </TableCell>
              </TableRow>
            ) : (admins.data ?? []).length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                  No admin users yet.
                </TableCell>
              </TableRow>
            ) : (
              (admins.data ?? []).map((a) => (
                <TableRow key={a.id} className="hover:bg-secondary/50">
                  <TableCell className="font-medium">
                    {a.profiles?.full_name ?? "No name set"}
                    {a.id === currentUser?.id ? (
                      <span className="ml-2 rounded-full bg-secondary px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
                        You
                      </span>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{a.profiles?.email ?? "—"}</TableCell>
                  <TableCell>
                    <select
                      value={a.admin_role}
                      onChange={(e) => changeRole(a.id, e.target.value as AdminRole)}
                      className="rounded-lg border border-border bg-background px-2 py-1.5 text-xs"
                    >
                      {ADMIN_ROLES.map((r) => (
                        <option key={r.value} value={r.value}>
                          {r.label}
                        </option>
                      ))}
                    </select>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {a.created_at ? new Date(a.created_at).toLocaleDateString("en-NG") : "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <button
                      type="button"
                      onClick={() => revoke(a)}
                      disabled={a.id === currentUser?.id}
                      className="inline-flex items-center gap-1 rounded-md border border-destructive px-2.5 py-1 text-xs font-bold text-destructive disabled:opacity-40"
                    >
                      <ShieldOff className="size-3.5" />
                      Revoke
                    </button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="mt-4 rounded-lg border border-dashed border-border p-3 text-xs text-muted-foreground">
        Per-module permissions aren't enforced yet — every admin role can currently access every tab.
        The role tag here is stored for when granular permissions are built.
      </div>

      {inviting ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/20" onClick={() => setInviting(false)}>
          <div className="w-full max-w-sm rounded-xl bg-card p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-start justify-between">
              <p className="font-display text-lg font-bold">Grant admin access</p>
              <button type="button" onClick={() => setInviting(false)} className="text-muted-foreground">
                <X className="size-5" />
              </button>
            </div>

            <label className="block">
              <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                Their Zentra account email
              </span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none ring-primary/20 focus:ring-2"
              />
            </label>

            <label className="mt-3 block">
              <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Admin role</span>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as AdminRole)}
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              >
                {ADMIN_ROLES.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </label>

            <p className="mt-3 text-xs text-muted-foreground">
              They must already have a Zentra account (signed up as a customer, merchant, or rider) —
              this converts that account into an admin account.
            </p>

            <button
              type="button"
              onClick={grantAdmin}
              disabled={busy || !email.trim()}
              className="mt-4 w-full rounded-lg bg-primary py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-60"
            >
              {busy ? "Granting…" : "Grant access"}
            </button>
          </div>
        </div>
      ) : null}
    </AdminLayout>
  );
}
