import { Link, useRouterState } from "@tanstack/react-router";
import { LogOut, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ADMIN_NAV } from "./nav-config";
import { cn } from "@/lib/utils";

/**
 * Sidebar content shared by both the permanent desktop rail and the
 * mobile slide-in drawer. `onNavigate` lets the mobile drawer close
 * itself the moment a link is tapped.
 */
function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  async function signOut() {
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  return (
    <>
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
              onClick={onNavigate}
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
    </>
  );
}

export function AdminSidebar({
  open = false,
  onClose,
}: {
  /** Whether the mobile drawer is open. Ignored at md+ (always visible there). */
  open?: boolean;
  onClose?: () => void;
}) {
  return (
    <>
      {/* Desktop: permanent static column, unchanged from before */}
      <aside className="hidden h-screen w-60 shrink-0 flex-col bg-[var(--sidebar)] text-[var(--sidebar-foreground)] md:flex">
        <SidebarContent />
      </aside>

      {/* Mobile: backdrop, only interactive while open */}
      <div
        aria-hidden={!open}
        onClick={onClose}
        className={cn(
          "fixed inset-0 z-40 bg-black/50 transition-opacity md:hidden",
          open ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      />

      {/* Mobile: slide-in drawer */}
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Admin navigation"
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex h-screen w-64 max-w-[80vw] flex-col bg-[var(--sidebar)] text-[var(--sidebar-foreground)] shadow-xl transition-transform duration-200 ease-out md:hidden",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close menu"
          className="absolute right-3 top-5 grid size-8 place-items-center rounded-lg text-[var(--sidebar-foreground)]/70 hover:bg-[var(--sidebar-accent)] hover:text-[var(--sidebar-accent-foreground)]"
        >
          <X className="size-4" />
        </button>
        <SidebarContent onNavigate={onClose} />
      </aside>
    </>
  );
}
