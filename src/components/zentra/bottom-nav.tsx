import { Link } from "@tanstack/react-router";
import { Compass, ClipboardList, ShoppingBasket, User } from "lucide-react";
import { useCart } from "@/lib/cart";

const items = [
  { to: "/", label: "Explore", icon: Compass },
  { to: "/customer/orders", label: "Orders", icon: ClipboardList },
  { to: "/customer/cart", label: "Cart", icon: ShoppingBasket },
  { to: "/customer/account", label: "Profile", icon: User },
] as const;

export function BottomNav() {
  const { count } = useCart();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 mx-auto max-w-[30rem] border-t border-border bg-card px-6 py-2 shadow-bar">
      <ul className="flex items-center justify-between">
        {items.map(({ to, label, icon: Icon }) => (
          <li key={to}>
            <Link
              to={to}
              activeOptions={{ exact: to === "/" }}
              className="flex flex-col items-center gap-1 px-2 py-1 text-muted-foreground [&.active]:text-primary"
            >
              <span className="relative">
                <Icon className="size-5" strokeWidth={2.2} />
                {to === "/cart" && count > 0 ? (
                  <span className="absolute -right-2 -top-1.5 grid size-4 place-items-center rounded-full bg-accent text-[9px] font-bold text-accent-foreground">
                    {count}
                  </span>
                ) : null}
              </span>
              <span className="text-[10px] font-bold">{label}</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
