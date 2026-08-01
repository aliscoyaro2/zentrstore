import { Search } from "lucide-react";
import { useSession } from "@/hooks/use-session";

export function AdminTopbar({ title, subtitle }: { title: string; subtitle?: string }) {
  const { user } = useSession();
  const initial = (user?.email ?? "A").charAt(0).toUpperCase();

  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-border bg-card px-6">
      <div className="min-w-0">
        <h1 className="font-display text-lg font-bold leading-tight text-foreground">{title}</h1>
        {subtitle ? <p className="text-xs text-muted-foreground">{subtitle}</p> : null}
      </div>

      <div className="flex items-center gap-4">
        <div className="relative hidden sm:block">
          <Search className="pointer-events-none absolute inset-y-0 left-3 my-auto size-4 text-muted-foreground" />
          <input
            type="search"
            placeholder="Search orders, merchants, riders…"
            className="w-64 rounded-lg border border-border bg-secondary py-2 pl-9 pr-3 text-sm outline-none ring-primary/20 focus:ring-2"
          />
        </div>
        <div className="grid size-9 place-items-center rounded-full bg-primary font-display text-sm font-bold text-primary-foreground">
          {initial}
        </div>
      </div>
    </header>
  );
}
