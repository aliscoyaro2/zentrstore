import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { MerchantBottomNav } from "@/components/zentra/merchant-bottom-nav";
import { useMerchantPermissions } from "@/hooks/use-merchant-permissions";

export function MerchantLayout({ children }: { children: ReactNode }) {
  const { storeId } = useMerchantPermissions();
  const queryClient = useQueryClient();

  const store = useQuery({
    queryKey: ["merchant-store-header", storeId],
    enabled: Boolean(storeId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("merchants")
        .select("id,business_name,is_open_override")
        .eq("id", storeId!)
        .single();
      if (error) throw error;
      return data;
    },
    retry: 1,
  });

  const isOpen = store.data?.is_open_override ?? false;

  async function toggleOpen() {
    if (!storeId) return;
    const { error } = await supabase
      .from("merchants")
      .update({ is_open_override: !isOpen })
      .eq("id", storeId);
    if (error) {
      toast.error("Could not update store status", { description: error.message });
      return;
    }
    toast.success(!isOpen ? "Store is now open" : "Store is now closed");
    queryClient.invalidateQueries({ queryKey: ["merchant-store-header", storeId] });
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-[30rem] flex-col bg-background">
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
              to="/merchant/profile"
              className="grid size-8 place-items-center rounded-full border border-border bg-secondary"
            >
              <span className="size-4 rounded-full bg-accent/30" />
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1 px-4 pb-24 pt-4">{children}</main>

      <MerchantBottomNav />
    </div>
  );
}
