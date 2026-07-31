import type { Database } from "@/integrations/supabase/types";

export type UserRole = Database["public"]["Enums"]["user_role"];

/**
 * Zentra accounts are strictly single-purpose: a merchant account only ever
 * sees merchant screens, a rider account only ever sees rider screens, and
 * so on. This is the one place that maps a role to where that account
 * belongs, so every route guard and every redirect agrees with each other.
 */
export function roleHome(role: UserRole | null | undefined): string {
  switch (role) {
    case "merchant":
      return "/merchant";
    case "rider":
      return "/rider";
    case "admin":
      return "/admin";
    case "customer":
    default:
      return "/";
  }
}