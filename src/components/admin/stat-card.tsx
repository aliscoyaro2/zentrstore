import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  icon: Icon,
  tone = "default",
}: {
  label: string;
  value: string;
  icon?: LucideIcon;
  tone?: "default" | "warning";
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        {Icon ? (
          <span
            className={cn(
              "grid size-8 place-items-center rounded-lg",
              tone === "warning" ? "bg-accent-soft text-accent-foreground" : "bg-secondary text-primary",
            )}
          >
            <Icon className="size-4" />
          </span>
        ) : null}
      </div>
      <p className="mt-3 font-display text-2xl font-bold text-foreground">{value}</p>
    </div>
  );
}
