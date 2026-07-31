import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";
import { BottomNav } from "./bottom-nav";

export function Screen({
  children,
  nav = true,
  className = "",
}: {
  children: ReactNode;
  nav?: boolean;
  className?: string;
}) {
  return (
    <div className="app-shell">
      <main className={`${nav ? "pb-28" : "pb-10"} ${className}`}>{children}</main>
      {nav ? <BottomNav /> : null}
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  back,
  right,
}: {
  title: string;
  subtitle?: string | undefined;
  back?: string | undefined;
  right?: ReactNode | undefined;
}) {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-card/90 px-4 py-3 backdrop-blur-md">
      <div className="flex items-center gap-3">
        {back ? (
          <Link
            to={back}
            className="grid size-9 shrink-0 place-items-center rounded-full border border-border bg-secondary text-secondary-foreground"
            aria-label="Go back"
          >
            <ArrowLeft className="size-4" />
          </Link>
        ) : null}
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg leading-tight">{title}</h1>
          {subtitle ? (
            <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
          ) : null}
        </div>
        {right}
      </div>
    </header>
  );
}

export function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-border bg-card shadow-card ${className}`}>
      {children}
    </div>
  );
}

export function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-card/60 p-6 text-center">
      <p className="font-display text-base font-extrabold">{title}</p>
      <p className="mt-1 text-sm text-muted-foreground">{body}</p>
    </div>
  );
}

export function PaystackNote() {
  return (
    <div className="rounded-2xl border border-accent/30 bg-accent-soft p-4">
      <p className="text-sm font-bold text-accent-foreground">Secure payments via Paystack</p>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
        Every order is paid online before the merchant starts preparing. No cash is handled at your
        door.
      </p>
    </div>
  );
}
