import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { UserRole } from "@/lib/roles";

export function useSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<UserRole | null>(null);
  const [roleLoading, setRoleLoading] = useState(true);

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      setLoading(false);
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const userId = session?.user?.id;

  useEffect(() => {
    let active = true;
    if (!userId) {
      setRole(null);
      setRoleLoading(false);
      return;
    }
    setRoleLoading(true);
    supabase
      .from("profiles")
      .select("role")
      .eq("id", userId)
      .maybeSingle()
      .then(({ data }) => {
        if (!active) return;
        setRole(data?.role ?? "customer");
        setRoleLoading(false);
      });
    return () => {
      active = false;
    };
  }, [userId]);

  return {
    session,
    user: session?.user ?? null,
    loading,
    role,
    // True while we still don't know either the session or the profile role.
    roleLoading: loading || (Boolean(userId) && roleLoading),
  };
}