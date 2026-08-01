import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  Package,
  Users,
  Store,
  Bike,
  Wallet,
  CreditCard,
  MapPin,
  BarChart3,
  Headphones,
  Bell,
  Star,
  Settings,
  UserCog,
  ScrollText,
} from "lucide-react";

export type AdminNavItem = {
  label: string;
  to: string;
  icon: LucideIcon;
};

// Promotions intentionally omitted — out of scope for this build.
export const ADMIN_NAV: AdminNavItem[] = [
  { label: "Dashboard", to: "/admin", icon: LayoutDashboard },
  { label: "Orders", to: "/admin/orders", icon: Package },
  { label: "Customers", to: "/admin/customers", icon: Users },
  { label: "Merchants", to: "/admin/merchants", icon: Store },
  { label: "Riders", to: "/admin/riders", icon: Bike },
  { label: "Payments", to: "/admin/payments", icon: Wallet },
  { label: "Settlements", to: "/admin/settlements", icon: CreditCard },
  { label: "Delivery Zones", to: "/admin/zones", icon: MapPin },
  { label: "Analytics", to: "/admin/analytics", icon: BarChart3 },
  { label: "Support", to: "/admin/support", icon: Headphones },
  { label: "Notifications", to: "/admin/notifications", icon: Bell },
  { label: "Reviews", to: "/admin/reviews", icon: Star },
  { label: "Settings", to: "/admin/settings", icon: Settings },
  { label: "Admin Users", to: "/admin/admins", icon: UserCog },
  { label: "Audit Logs", to: "/admin/audit-logs", icon: ScrollText },
];
