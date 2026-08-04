import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "./use-session";

type StaffRole = "owner" | "manager" | "cashier" | "kitchen" | "rider_coordinator";

type Permissions = {
  dashboard: "full" | "view";
  orders: "full" | "view" | "none";
  products: "full" | "view" | "none";
  staff: "full" | "view" | "none";
  settings: "full" | "view" | "none";
  financials: "full" | "view" | "none";
};

export function useMerchantPermissions() {
  const { user } = useSession();

  const { data, isLoading } = useQuery({
    queryKey: ["merchant-staff-permission", user?.id],
    enabled: Boolean(user),
    queryFn: async () => {
      // First, find the merchant store owned by this user (if any)
      const { data: merchant } = await supabase
        .from("merchants")
        .select("id")
        .eq("owner_id", user!.id)
        .maybeSingle();

      if (merchant) {
        // This user is the owner
        return {
          storeId: merchant.id,
          role: "owner" as StaffRole,
          permissions: {
            dashboard: "full" as const,
            orders: "full" as const,
            products: "full" as const,
            staff: "full" as const,
            settings: "full" as const,
            financials: "full" as const,
          },
          isOwner: true,
        };
      }

      // Otherwise, check store_staff table
      const { data: staff } = await supabase
        .from("store_staff")
        .select("store_id, role, permissions")
        .eq("user_id", user!.id)
        .maybeSingle();

      if (staff) {
        return {
          storeId: staff.store_id,
          role: staff.role as StaffRole,
          permissions: staff.permissions as Permissions,
          isOwner: false,
        };
      }

      return null;
    },
  });

  return {
    permissions: data?.permissions ?? null,
    role: data?.role ?? null,
    storeId: data?.storeId ?? null,
    isOwner: data?.isOwner ?? false,
    isLoading,
  };
}
