import { Link, useRouterState } from "@tanstack/react-router";
import { LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ADMIN_NAV } from "./nav-config";
import { cn } from "@/lib/utils";

export function AdminSidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  async function signOut() {
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  return (
    <aside className="flex h-screen w-60 shrink-0 flex-col bg-[var(--sidebar)] text-[var(--sidebar-foreground)]">
      <div className="flex items-center gap-2 px-5 py-5">
        <span className="grid size-8 place-items-center rounded-lg bg-[var(--sidebar-primary)] font-display text-sm font-extrabold text-[var(--sidebar-primary-foreground)]">
          Z
        </span>
        <div className="min-w-0">
          <p className="font-display text-sm font-bold leading-tight">Zentra</p>
          <p className="text-[11px] leading-tight text-[var(--sidebar-foreground)]/60">
            Admin control
          </p>
        </div>
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-2">
        {ADMIN_NAV.map((item) => {
          const active = item.to === "/admin" ? pathname === "/admin" : pathname.startsWith(item.to);
          const Icon = item.icon;
          return (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-[var(--sidebar-primary)] text-[var(--sidebar-primary-foreground)]"
                  : "text-[var(--sidebar-foreground)]/75 hover:bg-[var(--sidebar-accent)] hover:text-[var(--sidebar-accent-foreground)]",
              )}
            >
              <Icon className="size-4 shrink-0" />
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-[var(--sidebar-border)] px-3 py-3">
        <button
          type="button"
          onClick={signOut}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-[var(--sidebar-foreground)]/75 transition-colors hover:bg-[var(--sidebar-accent)] hover:text-[var(--sidebar-accent-foreground)]"
        >
          <LogOut className="size-4 shrink-0" />
          Sign out
        </button>
      </div>
    </aside>
  );
}
