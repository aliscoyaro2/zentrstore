import { ReactNode } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { MerchantBottomNav } from "./merchant-bottom-nav";
import { useSession } from "@/hooks/use-session";
import { useRoleGuard } from "@/hooks/use-role-guard";
import { cn } from "@/lib/utils";

export function MerchantLayout({ children }: { children: ReactNode }) {
  // ✅ ALL HOOKS CALLED FIRST, UNCONDITIONALLY
  const { user, loading } = useSession();
  const navigate = useNavigate();
  const { ready } = useRoleGuard("merchant");

  // ✅ Store query – always called, but gated with `enabled`
  const store = useQuery({
    queryKey: ["merchant-store", user?.id],
    enabled: Boolean(user) && ready,
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from("merchants")
        .select("id, business_name, is_open_override")
        .eq("owner_id", user.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    retry: 1,
  });

  // ✅ EARLY RETURNS AFTER ALL HOOKS
  if (loading || !ready) {
    return (
      <div className="app-shell flex min-h-screen items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!user) {
    navigate({ to: "/login" });
    return null;
  }

  if (store.isLoading) {
    return (
      <div className="app-shell flex min-h-screen items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading store...</div>
      </div>
    );
  }

  if (store.error) {
    return (
      <div className="app-shell flex min-h-screen items-center justify-center px-4">
        <div className="text-center">
          <p className="text-destructive font-semibold">Could not load your store</p>
          <p className="text-sm text-muted-foreground mt-2">
            Please make sure you have a registered store.
          </p>
          <Link
            to="/merchant/apply"
            className="mt-4 inline-block rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground"
          >
            Register a store
          </Link>
        </div>
      </div>
    );
  }

  if (!store.data) {
    return (
      <div className="app-shell flex min-h-screen items-center justify-center px-4">
        <div className="text-center">
          <p className="text-lg font-bold">No store found</p>
          <p className="text-sm text-muted-foreground mt-2">
            You are registered as a merchant but haven't created a store yet.
          </p>
          <Link
            to="/merchant/apply"
            className="mt-4 inline-block rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground"
          >
            Register your store
          </Link>
        </div>
      </div>
    );
  }

  const isOpen = store.data.is_open_override ?? false;

  async function toggleOpen() {
    if (!store.data) return;
    const { error } = await supabase
      .from("merchants")
      .update({ is_open_override: !store.data.is_open_override })
      .eq("id", store.data.id);
    if (error) {
      toast.error("Could not update status", { description: error.message });
      return;
    }
    await store.refetch();
    toast.success(store.data.is_open_override ? "Store closed" : "Store opened");
  }

  return (
    <div className="app-shell pb-20">
      <header className="sticky top-0 z-30 border-b border-border bg-card/90 px-4 py-3 backdrop-blur-md">
        <div className="flex items-center justify-between">
          <div className="min-w-0">
            <h1 className="truncate font-display text-lg font-extrabold">
              {store.data.business_name}
            </h1>
            <p className="text-xs text-muted-foreground">Merchant dashboard</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={toggleOpen}
              className={cn(
                "rounded-full px-3 py-1 text-xs font-bold transition-colors",
                isOpen
                  ? "bg-success-soft text-success"
                  : "bg-secondary text-muted-foreground"
              )}
            >
              {isOpen ? "Open" : "Closed"}
            </button>
            <Link
              to="/customer/account"
              className="grid size-8 place-items-center rounded-full border border-border bg-secondary"
            >
              <span className="size-4 rounded-full bg-accent/30" />
            </Link>
          </div>
        </div>
      </header>

      <main className="px-4 py-5">{children}</main>
      <MerchantBottomNav />
    </div>
  );
}