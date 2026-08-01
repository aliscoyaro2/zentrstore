import type { ReactNode } from "react";
import { AdminSidebar } from "./admin-sidebar";
import { AdminTopbar } from "./admin-topbar";

/**
 * Shared shell for every /admin/* page: dark charcoal sidebar + topbar +
 * scrollable content area, all scoped under .admin-scope so this page's
 * theme tokens (light gray background, Zentra green accent, Poppins
 * headings) never leak into the mobile customer/merchant/rider app.
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
  return (
    <div className="admin-scope flex h-screen w-full overflow-hidden">
      <AdminSidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <AdminTopbar title={title} subtitle={subtitle} />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
