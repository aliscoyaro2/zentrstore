import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { useRouterState } from "@tanstack/react-router";
import { AdminSidebar } from "./admin-sidebar";
import { AdminTopbar } from "./admin-topbar";

/**
 * Shared shell for every /admin/* page: dark charcoal sidebar + topbar +
 * scrollable content area, all scoped under .admin-scope so this page's
 * theme tokens (light gray background, Zentra green accent, Poppins
 * headings) never leak into the mobile customer/merchant/rider app.
 *
 * Below the md breakpoint, the sidebar becomes a slide-in drawer that's
 * toggled via the hamburger button in the topbar; at md+ it's back to
 * the permanent static column.
 */
export function AdminLayout({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  // Close the drawer automatically whenever the route changes (e.g. after
  // tapping a nav link), so it never stays open over the new page.
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  return (
    <div className="admin-scope flex h-screen w-full overflow-hidden">
      <AdminSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex min-w-0 flex-1 flex-col">
        <AdminTopbar title={title} subtitle={subtitle} onMenuClick={() => setSidebarOpen(true)} />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
