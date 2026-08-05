import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { X, UserPlus, Trash2, Edit2, Check, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { MerchantLayout } from "@/components/zentra/merchant-layout";
import { useMerchantPermissions } from "@/hooks/use-merchant-permissions";
import { useSession } from "@/hooks/use-session";
import { 
  inviteStaffMember, 
  getStaffList, 
  removeStaffMember, 
  updateStaffRole 
} from "@/lib/staff.functions";

export const Route = createFileRoute("/merchant/staff/")({
  head: () => ({
    meta: [{ title: "Staff – Merchant" }],
  }),
  component: MerchantStaffPage,
});

const ROLES = ["manager", "cashier", "kitchen", "rider_coordinator"] as const;
const ROLE_LABELS: Record<string, string> = {
  manager: "Manager",
  cashier: "Cashier",
  kitchen: "Kitchen Staff",
  rider_coordinator: "Rider Coordinator",
};

type StaffMember = {
  id: string;
  role: typeof ROLES[number];
  permissions: Record<string, string>;
  invited_at: string | null;
  accepted_at: string | null;
  profiles: {
    id: string;
    full_name: string | null;
    email: string | null;
    phone: string | null;
  } | null;
};

function MerchantStaffPage() {
  const { user } = useSession();
  const { storeId, permissions, isLoading: permsLoading, isOwner } = useMerchantPermissions();
  const queryClient = useQueryClient();
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<typeof ROLES[number]>("manager");
  const [busy, setBusy] = useState(false);
  const [editingRole, setEditingRole] = useState<string | null>(null);

  // Hooks
  const staffQuery = useQuery({
    queryKey: ["merchant-staff-list", storeId],
    enabled: Boolean(storeId),
    queryFn: async () => {
      if (!storeId) return [];
      const result = await getStaffList({ data: { storeId } });
      return result as StaffMember[];
    },
    retry: 1,
  });

  // Get owner info
  const ownerQuery = useQuery({
    queryKey: ["merchant-owner", storeId],
    enabled: Boolean(storeId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("merchants")
        .select("owner_id, profiles:owner_id(full_name, email)")
        .eq("id", storeId!)
        .single();
      if (error) throw error;
      return data;
    },
    retry: 1,
  });

  // Guards
  if (permsLoading) {
    return (
      <MerchantLayout>
        <div className="flex justify-center py-10">
          <div className="animate-pulse text-muted-foreground">Loading staff...</div>
        </div>
      </MerchantLayout>
    );
  }
  if (!storeId) {
    return (
      <MerchantLayout>
        <div className="text-center py-10">
          <p className="text-sm text-muted-foreground">No store found.</p>
        </div>
      </MerchantLayout>
    );
  }
  const canViewStaff = permissions?.staff === "full" || permissions?.staff === "view";
  if (!canViewStaff) {
    return (
      <MerchantLayout>
        <p className="text-sm text-muted-foreground">You don't have permission to view staff.</p>
      </MerchantLayout>
    );
  }

  if (staffQuery.isLoading || ownerQuery.isLoading) {
    return (
      <MerchantLayout>
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </MerchantLayout>
    );
  }

  const canManageStaff = permissions?.staff === "full";
  const owner = ownerQuery.data;
  const staff = staffQuery.data ?? [];

  const allStaff = [
    ...(owner ? [{
      id: owner.owner_id ?? "owner",
      role: "owner" as const,
      full_name: owner.profiles?.full_name ?? "Owner",
      email: owner.profiles?.email ?? "",
      phone: null,
      invited_at: null,
      accepted_at: new Date().toISOString(),
      isOwner: true,
    }] : []),
    ...staff.map(s => ({
      id: s.id,
      role: s.role,
      full_name: s.profiles?.full_name ?? s.profiles?.email ?? "Unknown",
      email: s.profiles?.email ?? "",
      phone: s.profiles?.phone ?? null,
      invited_at: s.invited_at,
      accepted_at: s.accepted_at,
      isOwner: false,
      userId: s.profiles?.id,
    })),
  ];

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!inviteEmail.trim() || !storeId) return;
    setBusy(true);
    try {
      const result = await inviteStaffMember({
        data: {
          storeId: storeId,
          email: inviteEmail.trim().toLowerCase(),
          role: inviteRole,
        },
      });
      toast.success(result.message);
      setInviteEmail("");
      setShowInvite(false);
      queryClient.invalidateQueries({ queryKey: ["merchant-staff-list", storeId] });
    } catch (err) {
      toast.error("Could not invite", { description: err instanceof Error ? err.message : undefined });
    } finally {
      setBusy(false);
    }
  }

  async function handleRemove(staffId: string, name: string) {
    if (!window.confirm(`Remove ${name} from staff?`)) return;
    try {
      await removeStaffMember({ data: { staffId } });
      toast.success("Staff member removed");
      queryClient.invalidateQueries({ queryKey: ["merchant-staff-list", storeId] });
    } catch (err) {
      toast.error("Could not remove", { description: err instanceof Error ? err.message : undefined });
    }
  }

  async function handleUpdateRole(staffId: string, role: typeof ROLES[number]) {
    try {
      await updateStaffRole({ data: { staffId, role } });
      toast.success("Role updated");
      setEditingRole(null);
      queryClient.invalidateQueries({ queryKey: ["merchant-staff-list", storeId] });
    } catch (err) {
      toast.error("Could not update", { description: err instanceof Error ? err.message : undefined });
    }
  }

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
            <p className="text-sm text-muted-foreground text-center py-8">No staff members yet.</p>
          ) : (
            allStaff.map(s => (
              <div key={s.id} className="flex items-center justify-between rounded-xl border border-border p-3 bg-card">
                <div className="min-w-0">
                  <p className="font-medium">{s.full_name}</p>
                  <p className="text-xs text-muted-foreground">{s.email}</p>
                  <div className="flex items-center gap-2 mt-1">
                    {s.isOwner ? (
                      <span className="text-xs font-bold text-primary">Owner</span>
                    ) : editingRole === s.id ? (
                      <select
                        value={s.role}
                        onChange={(e) => handleUpdateRole(s.id, e.target.value as typeof ROLES[number])}
                        className="text-xs rounded border border-border bg-background px-2 py-0.5"
                        autoFocus
                      >
                        {ROLES.map(r => (
                          <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                        ))}
                      </select>
                    ) : (
                      <span className="text-xs text-muted-foreground capitalize">{ROLE_LABELS[s.role]}</span>
                    )}
                    {!s.isOwner && s.accepted_at ? (
                      <span className="text-xs text-success">● Active</span>
                    ) : !s.isOwner && s.invited_at ? (
                      <span className="text-xs text-warning">● Invitation pending</span>
                    ) : null}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {!s.isOwner && canManageStaff && (
                    <>
                      {editingRole === s.id ? (
                        <button
                          type="button"
                          onClick={() => setEditingRole(null)}
                          className="p-1.5 text-muted-foreground hover:text-foreground"
                        >
                          <XCircle className="size-4" />
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setEditingRole(s.id)}
                          className="p-1.5 text-muted-foreground hover:text-foreground"
                        >
                          <Edit2 className="size-4" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleRemove(s.id, s.full_name)}
                        className="p-1.5 text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </>
                  )}
                </div>
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
            <form onSubmit={handleInvite} className="space-y-4">
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
                <p className="mt-1 text-xs text-muted-foreground">
                  If they don't have a Zentra account, they'll receive an invite email to create one.
                </p>
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Role</label>
                <select
                  value={inviteRole}
                  onChange={e => setInviteRole(e.target.value as typeof ROLES[number])}
                  className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm"
                >
                  {ROLES.map(r => (
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