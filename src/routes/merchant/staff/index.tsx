import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Users, UserPlus, Mail, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { MerchantLayout } from "@/components/zentra/merchant-layout";
import { useMerchantPermissions } from "@/hooks/use-merchant-permissions";
import { useSession } from "@/hooks/use-session";

export const Route = createFileRoute("/merchant/staff/")({
  head: () => ({
    meta: [
      { title: "Staff – Merchant" },
      { name: "description", content: "Manage your store staff." },
    ],
  }),
  component: MerchantStaffPage,
});

const ROLES = ["owner", "manager", "cashier", "kitchen", "rider_coordinator"] as const;
const ROLE_LABELS: Record<string, string> = {
  owner: "Owner",
  manager: "Manager",
  cashier: "Cashier",
  kitchen: "Kitchen Staff",
  rider_coordinator: "Rider Coordinator",
};

function MerchantStaffPage() {
  const { user } = useSession();
  const { storeId, permissions, isOwner, isLoading: permsLoading } = useMerchantPermissions();
  const queryClient = useQueryClient();
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<typeof ROLES[number]>("manager");
  const [busy, setBusy] = useState(false);

  // All hooks must run unconditionally, on every render, in the same
  // order — never place a hook call after an early `return`. We gate
  // each query itself with `enabled` and gate what we *render* below.
  const staffQuery = useQuery({
    queryKey: ["merchant-staff-list", storeId],
    enabled: Boolean(storeId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("store_staff")
        .select("id, role, permissions, invited_at, accepted_at, profiles:user_id(full_name, email)")
        .eq("store_id", storeId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  // Also get the owner (from merchants table) to display them
  const ownerQuery = useQuery({
    queryKey: ["merchant-owner", storeId],
    enabled: Boolean(storeId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("merchants")
        .select("owner_id, profiles:owner_id(full_name, email)")
        .eq("id", storeId)
        .single();
      if (error) throw error;
      return data;
    },
  });

  if (permsLoading) return <MerchantLayout>Loading...</MerchantLayout>;
  if (!storeId) return <MerchantLayout>No store found.</MerchantLayout>;

  const canViewStaff = permissions?.staff === "full" || permissions?.staff === "view";
  const canManageStaff = permissions?.staff === "full";

  if (!canViewStaff) {
    return <MerchantLayout><p>You don't have permission to view staff.</p></MerchantLayout>;
  }

  async function inviteStaff(e: React.FormEvent) {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    setBusy(true);
    // First, check if user exists in profiles by email
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id")
      .eq("email", inviteEmail.trim().toLowerCase())
      .maybeSingle();

    if (profileError || !profile) {
      setBusy(false);
      toast.error("No Zentra account with that email", { description: "They need to sign up first." });
      return;
    }

    // Check if already staff
    const { data: existing } = await supabase
      .from("store_staff")
      .select("id")
      .eq("store_id", storeId)
      .eq("user_id", profile.id)
      .maybeSingle();

    if (existing) {
      setBusy(false);
      toast.error("This user is already staff.");
      return;
    }

    // Insert staff record
    const { error: insertError } = await supabase.from("store_staff").insert({
      store_id: storeId,
      user_id: profile.id,
      role: inviteRole,
      invited_by: user!.id,
      permissions: getDefaultPermissions(inviteRole),
    });

    setBusy(false);
    if (insertError) {
      toast.error("Could not invite", { description: insertError.message });
      return;
    }
    toast.success(`Invited ${inviteEmail} as ${ROLE_LABELS[inviteRole]}`);
    setInviteEmail("");
    setShowInvite(false);
    queryClient.invalidateQueries({ queryKey: ["merchant-staff-list", storeId] });
  }

  function getDefaultPermissions(role: typeof ROLES[number]) {
    switch (role) {
      case "owner":
        return { dashboard: "full", orders: "full", products: "full", staff: "full", settings: "full", financials: "full" };
      case "manager":
        return { dashboard: "full", orders: "full", products: "full", staff: "view", settings: "view", financials: "view" };
      case "cashier":
        return { dashboard: "view", orders: "full", products: "none", staff: "none", settings: "none", financials: "none" };
      case "kitchen":
        return { dashboard: "view", orders: "full", products: "none", staff: "none", settings: "none", financials: "none" };
      case "rider_coordinator":
        return { dashboard: "full", orders: "full", products: "none", staff: "none", settings: "none", financials: "none" };
      default:
        return { dashboard: "view", orders: "view", products: "none", staff: "none", settings: "none", financials: "none" };
    }
  }

  const owner = ownerQuery.data;
  const staff = staffQuery.data ?? [];

  // Build full list: owner + staff
  const allStaff = [
    ...(owner ? [{
      id: owner.owner_id,
      role: "owner" as const,
      full_name: owner.profiles?.full_name ?? "Owner",
      email: owner.profiles?.email ?? "",
      invited_at: null,
      accepted_at: null,
    }] : []),
    ...staff.map(s => ({
      id: s.id,
      role: s.role as typeof ROLES[number],
      full_name: s.profiles?.full_name ?? s.profiles?.email ?? "Unknown",
      email: s.profiles?.email ?? "",
      invited_at: s.invited_at,
      accepted_at: s.accepted_at,
    })),
  ];

  return (
    <MerchantLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">Staff</h2>
          {canManageStaff && (
            <button
              type="button"
              onClick={() => setShowInvite(true)}
              className="flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground"
            >
              <UserPlus className="size-4" />
              Invite
            </button>
          )}
        </div>

        <div className="space-y-2">
          {allStaff.length === 0 ? (
            <p className="text-sm text-muted-foreground">No staff members yet.</p>
          ) : (
            allStaff.map(s => (
              <div key={s.id} className="flex items-center justify-between rounded-xl border border-border p-3 bg-card">
                <div>
                  <p className="font-medium">{s.full_name}</p>
                  <p className="text-xs text-muted-foreground">{s.email} · {ROLE_LABELS[s.role]}</p>
                  {s.accepted_at ? (
                    <span className="text-xs text-success">Active</span>
                  ) : s.invited_at ? (
                    <span className="text-xs text-warning">Invitation pending</span>
                  ) : null}
                </div>
                {s.role === "owner" && (
                  <span className="text-xs font-bold text-primary">Owner</span>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Invite Modal */}
      {showInvite && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowInvite(false)}>
          <div className="w-full max-w-sm rounded-xl bg-card p-6 shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display text-lg font-bold">Invite Staff</h3>
              <button type="button" onClick={() => setShowInvite(false)}>
                <X className="size-5 text-muted-foreground" />
              </button>
            </div>
            <form onSubmit={inviteStaff} className="space-y-4">
              <div>
                <label className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Email</label>
                <input
                  type="email"
                  required
                  value={inviteEmail}
                  onChange={e => setInviteEmail(e.target.value)}
                  placeholder="staff@example.com"
                  className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Role</label>
                <select
                  value={inviteRole}
                  onChange={e => setInviteRole(e.target.value as typeof ROLES[number])}
                  className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm"
                >
                  {ROLES.filter(r => r !== "owner").map(r => (
                    <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                  ))}
                </select>
              </div>
              <button
                type="submit"
                disabled={busy}
                className="w-full rounded-lg bg-primary py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-60"
              >
                {busy ? "Sending..." : "Send Invite"}
              </button>
            </form>
          </div>
        </div>
      )}
    </MerchantLayout>
  );
}
