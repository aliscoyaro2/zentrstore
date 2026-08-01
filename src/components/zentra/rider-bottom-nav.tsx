import { Link } from "@tanstack/react-router";
import { Home, Wallet, TrendingUp, User } from "lucide-react";

const items = [
  { to: "/rider", label: "Home", icon: Home },
  { to: "/rider/wallet", label: "Wallet", icon: Wallet },
  { to: "/rider/performance", label: "Stats", icon: TrendingUp },
  { to: "/rider/account", label: "Profile", icon: User },
] as const;

export function RiderBottomNav() {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 mx-auto max-w-[30rem] border-t border-border bg-card px-6 py-2 shadow-bar">
      <ul className="flex items-center justify-between">
        {items.map(({ to, label, icon: Icon }) => (
          <li key={to}>
            <Link
              to={to}
              activeOptions={{ exact: to === "/rider" }}
              className="flex flex-col items-center gap-1 px-2 py-1 text-muted-foreground [&.active]:text-primary"
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
