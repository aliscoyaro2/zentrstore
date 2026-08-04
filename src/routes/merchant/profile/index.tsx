import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Star, Package, TrendingUp, Clock, User, Mail, Phone, MapPin } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { MerchantLayout } from "@/components/zentra/merchant-layout";
import { useMerchantPermissions } from "@/hooks/use-merchant-permissions";
import { useSession } from "@/hooks/use-session";
import { naira } from "@/lib/money";

export const Route = createFileRoute("/merchant/profile/")({
  head: () => ({
    meta: [
      { title: "Profile – Merchant" },
      { name: "description", content: "Your merchant performance and account info." },
    ],
  }),
  component: MerchantProfilePage,
});

function MerchantProfilePage() {
  const { user } = useSession();
  const { storeId, role, permissions, isLoading: permsLoading } = useMerchantPermissions();

  if (permsLoading) return <MerchantLayout>Loading...</MerchantLayout>;
  if (!storeId) return <MerchantLayout>No store found.</MerchantLayout>;

  // Fetch merchant stats
  const stats = useQuery({
    queryKey: ["merchant-profile-stats", storeId],
    queryFn: async () => {
      const [orders, reviews, store] = await Promise.all([
        supabase
          .from("orders")
          .select("status,total_kobo")
          .eq("merchant_id", storeId),
        supabase
          .from("reviews")
          .select("rating")
          .eq("merchant_id", storeId),
        supabase
          .from("merchants")
          .select("business_name, phone, address_text, created_at")
          .eq("id", storeId)
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
  });

  const data = stats.data;

  return (
    <MerchantLayout>
      <div className="space-y-6 max-w-md">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-2xl font-bold text-primary">
            {data?.store?.business_name?.charAt(0) ?? "S"}
          </div>
          <div>
            <p className="font-display text-lg font-bold">{data?.store?.business_name ?? "Store"}</p>
            <p className="text-sm text-muted-foreground">Role: {role ?? "—"}</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-xl border border-border p-3 text-center bg-card">
            <Star className="mx-auto size-5 text-accent" />
            <p className="font-display text-lg font-bold">{data?.avgRating ? data.avgRating.toFixed(1) : "—"}</p>
            <p className="text-[10px] text-muted-foreground">Rating</p>
          </div>
          <div className="rounded-xl border border-border p-3 text-center bg-card">
            <Package className="mx-auto size-5 text-primary" />
            <p className="font-display text-lg font-bold">{data?.totalOrders ?? 0}</p>
            <p className="text-[10px] text-muted-foreground">Orders</p>
          </div>
          <div className="rounded-xl border border-border p-3 text-center bg-card">
            <TrendingUp className="mx-auto size-5 text-success" />
            <p className="font-display text-lg font-bold">{naira(data?.revenue ?? 0)}</p>
            <p className="text-[10px] text-muted-foreground">Revenue</p>
          </div>
        </div>

        <div className="rounded-xl border border-border p-4 space-y-2 bg-card">
          <h3 className="text-sm font-bold">Store details</h3>
          {data?.store?.phone && (
            <div className="flex items-center gap-2 text-sm">
              <Phone className="size-4 text-muted-foreground" />
              <span>{data.store.phone}</span>
            </div>
          )}
          {data?.store?.address_text && (
            <div className="flex items-center gap-2 text-sm">
              <MapPin className="size-4 text-muted-foreground" />
              <span>{data.store.address_text}</span>
            </div>
          )}
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="size-4" />
            <span>Joined {data?.store?.created_at ? new Date(data.store.created_at).toLocaleDateString() : "—"}</span>
          </div>
        </div>

        <div className="rounded-xl border border-border p-4 bg-card">
          <h3 className="text-sm font-bold">Your account</h3>
          <div className="mt-2 flex items-center gap-2 text-sm">
            <Mail className="size-4 text-muted-foreground" />
            <span>{user?.email}</span>
          </div>
          <Link to="/account/edit" className="mt-3 inline-block text-sm font-semibold text-primary">
            Edit profile
          </Link>
        </div>

        {role === "owner" && (
          <div className="rounded-xl border border-dashed border-info p-3 text-xs text-muted-foreground">
            You are the owner. You can manage staff and all store settings.
          </div>
        )}
      </div>
    </MerchantLayout>
  );
}
