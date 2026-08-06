import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Star, Package, TrendingUp, Clock, Mail, Phone, MapPin, LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { MerchantLayout } from "@/components/zentra/merchant-layout";
import { useMerchantPermissions } from "@/hooks/use-merchant-permissions";
import { useSession } from "@/hooks/use-session";
import { naira } from "@/lib/money";

export const Route = createFileRoute("/merchant/profile/")({
  head: () => ({
    meta: [{ title: "Merchant Profile – Zentra" }],
  }),
  component: MerchantProfilePage,
});

function MerchantProfilePage() {
  const { user } = useSession();
  const { storeId, role, permissions, isLoading: permsLoading } = useMerchantPermissions();

  // Hooks (unconditional)
  const stats = useQuery({
    queryKey: ["merchant-profile-stats", storeId],
    enabled: Boolean(storeId),
    queryFn: async () => {
      const [orders, reviews, store] = await Promise.all([
        supabase
          .from("orders")
          .select("status,total_kobo")
          .eq("merchant_id", storeId!),
        supabase
          .from("reviews")
          .select("rating")
          .eq("merchant_id", storeId!),
        supabase
          .from("merchants")
          .select("business_name, phone, address_text, created_at")
          .eq("id", storeId!)
          .single(),
      ]);
      const totalOrders = orders.data?.length ?? 0;
      const completed = (orders.data ?? []).filter(o => o.status === "delivered");
      const revenue = completed.reduce((sum, o) => sum + o.total_kobo, 0);
      const ratings = reviews.data?.map(r => r.rating) ?? [];
      const avgRating = ratings.length > 0 ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null;
      return {
        totalOrders,
        completedOrders: completed.length,
        revenue,
        avgRating,
        store: store.data,
      };
    },
    retry: 1,
  });

  // Guards
  if (permsLoading) {
    return (
      <MerchantLayout>
        <div className="flex justify-center py-10">
          <div className="animate-pulse text-muted-foreground">Loading profile...</div>
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

  if (stats.isLoading) {
    return (
      <MerchantLayout>
        <div className="animate-pulse text-muted-foreground">Loading stats...</div>
      </MerchantLayout>
    );
  }
  if (stats.error) {
    return (
      <MerchantLayout>
        <p className="text-sm text-destructive">Could not load profile data.</p>
      </MerchantLayout>
    );
  }

  const data = stats.data!;

  async function handleLogout() {
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  return (
    <MerchantLayout>
      <div className="space-y-6 max-w-md">
        {/* Store header */}
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-2xl font-bold text-primary">
            {data.store?.business_name?.charAt(0) ?? "S"}
          </div>
          <div>
            <p className="font-display text-lg font-bold">{data.store?.business_name ?? "Store"}</p>
            <p className="text-sm text-muted-foreground">Role: {role ?? "—"}</p>
          </div>
        </div>

        {/* Stats cards */}
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-xl border border-border p-3 text-center bg-card">
            <Star className="mx-auto size-5 text-accent" />
            <p className="font-display text-lg font-bold">{data.avgRating ? data.avgRating.toFixed(1) : "—"}</p>
            <p className="text-[10px] text-muted-foreground">Rating</p>
          </div>
          <div className="rounded-xl border border-border p-3 text-center bg-card">
            <Package className="mx-auto size-5 text-primary" />
            <p className="font-display text-lg font-bold">{data.totalOrders}</p>
            <p className="text-[10px] text-muted-foreground">Orders</p>
          </div>
          <div className="rounded-xl border border-border p-3 text-center bg-card">
            <TrendingUp className="mx-auto size-5 text-success" />
            <p className="font-display text-lg font-bold">{naira(data.revenue)}</p>
            <p className="text-[10px] text-muted-foreground">Revenue</p>
          </div>
        </div>

        {/* Store details */}
        <div className="rounded-xl border border-border p-4 space-y-2 bg-card">
          <h3 className="text-sm font-bold">Store details</h3>
          {data.store?.phone && (
            <div className="flex items-center gap-2 text-sm">
              <Phone className="size-4 text-muted-foreground" />
              <span>{data.store.phone}</span>
            </div>
          )}
          {data.store?.address_text && (
            <div className="flex items-center gap-2 text-sm">
              <MapPin className="size-4 text-muted-foreground" />
              <span>{data.store.address_text}</span>
            </div>
          )}
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="size-4" />
            <span>Joined {data.store?.created_at ? new Date(data.store.created_at).toLocaleDateString() : "—"}</span>
          </div>
        </div>

        {/* Account info */}
        <div className="rounded-xl border border-border p-4 bg-card">
          <h3 className="text-sm font-bold">Your account</h3>
          <div className="mt-2 flex items-center gap-2 text-sm">
            <Mail className="size-4 text-muted-foreground" />
            <span>{user?.email}</span>
          </div>
          <Link to="/customer/account/edit" className="mt-3 inline-block text-sm font-semibold text-primary">
            Edit profile
          </Link>
        </div>

        {role === "owner" && (
          <div className="rounded-xl border border-dashed border-info p-3 text-xs text-muted-foreground">
            You are the owner. You can manage staff and all store settings.
          </div>
        )}

        {/* ── LOGOUT BUTTON ── */}
        <div className="pt-4 border-t border-border">
          <button
            type="button"
            onClick={handleLogout}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-destructive/30 bg-destructive/5 py-3 text-sm font-bold text-destructive hover:bg-destructive/10 transition"
          >
            <LogOut className="size-4" />
            Sign Out
          </button>
        </div>
      </div>
    </MerchantLayout>
  );
}