import { Link } from "@tanstack/react-router";
import { LayoutDashboard, Package, ShoppingBag, Users, Settings, User } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { to: "/merchant", label: "Dashboard", icon: LayoutDashboard },
  { to: "/merchant/orders", label: "Orders", icon: Package },
  { to: "/merchant/products", label: "Catalogue", icon: ShoppingBag },
  { to: "/merchant/staff", label: "Staff", icon: Users },
  { to: "/merchant/settings", label: "Settings", icon: Settings },
  { to: "/merchant/profile", label: "Profile", icon: User },
] as const;

export function MerchantBottomNav() {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 mx-auto max-w-[30rem] border-t border-border bg-card px-2 py-1 shadow-bar">
      <ul className="flex items-center justify-around">
        {items.map(({ to, label, icon: Icon }) => (
          <li key={to}>
            <Link
              to={to}
              activeOptions={{ exact: to === "/merchant" }}
              className="flex flex-col items-center gap-0.5 px-1 py-1 text-muted-foreground [&.active]:text-primary"
            >
              <Icon className="size-5" strokeWidth={2.2} />
              <span className="text-[10px] font-bold">{label}</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
