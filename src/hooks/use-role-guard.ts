import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useSession } from "@/hooks/use-session";
import { roleHome, type UserRole } from "@/lib/roles";

/**
 * Enforces that only the given role(s) can see the calling route.
 * - Not signed in → sent to /login.
 * - Signed in but wrong role → sent to that account's own home
 *   (accounts are strictly single-purpose: a merchant never sees
 *   customer screens, a rider never sees merchant screens, etc).
 *
 * Usage: const { user, ready } = useRoleGuard("merchant");
 * `ready` is false while session/role are still loading or a redirect
 * is about to happen — render nothing (or a loader) until it's true.
 */
export function useRoleGuard(...allowed: UserRole[]) {
  const { user, role, roleLoading } = useSession();
  const navigate = useNavigate();

  useEffect(() => {
    if (roleLoading) return;
    if (!user) {
      navigate({ to: "/login" });
      return;
    }
    if (role && !allowed.includes(role)) {
      navigate({ to: roleHome(role) });
    }
    // allowed is spread from callers as a fresh array each render, so we
    // compare its contents rather than identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roleLoading, user, role, navigate, allowed.join(",")]);

  const ready = !roleLoading && Boolean(user) && Boolean(role) && allowed.includes(role as UserRole);

  return { user, role, ready };
}