import { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { MerchantBottomNav } from "./merchant-bottom-nav";
import { useSession } from "@/hooks/use-session";
import { cn } from "@/lib/utils";

export function MerchantLayout({ children }: { children: ReactNode }) {
  const { user } = useSession();

  // Fetch the merchant/store for this owner
  const store = useQuery({
    queryKey: ["merchant-store", user?.id],
    enabled: Boolean(user),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("merchants")
        .select("id, business_name, is_open_override")
        .eq("owner_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  // Toggle open/closed
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

  const isOpen = store.data?.is_open_override ?? false;

  return (
    <div className="app-shell pb-20">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-border bg-card/90 px-4 py-3 backdrop-blur-md">
        <div className="flex items-center justify-between">
          <div className="min-w-0">
            <h1 className="truncate font-display text-lg font-extrabold">
              {store.data?.business_name ?? "My Store"}
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
              to="/account"
              className="grid size-8 place-items-center rounded-full border border-border bg-secondary"
            >
              <span className="size-4 rounded-full bg-accent/30" />
            </Link>
          </div>
        </div>
      </header>

      {/* Page content */}
      <main className="px-4 py-5">{children}</main>

      {/* Bottom navigation */}
      <MerchantBottomNav />
    </div>
  );
}
