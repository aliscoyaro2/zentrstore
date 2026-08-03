import { cn } from "@/lib/utils";

const TONE_BY_STATUS: Record<string, "neutral" | "success" | "warning" | "danger" | "info"> = {
  // orders
  placed: "neutral",
  paid: "info",
  merchant_accepted: "info",
  preparing: "warning",
  rider_assigned: "warning",
  rider_en_route_to_merchant: "warning",
  picked_up: "warning",
  rider_en_route_to_customer: "warning",
  delivered: "success",
  cancelled: "danger",
  refunded: "danger",
  // approvals
  pending: "warning",
  approved: "success",
  suspended: "danger",
  // payments
  authorized: "info",
  verified: "info",
  failed: "danger",
  // tickets
  open: "warning",
  in_progress: "info",
  resolved: "success",
  closed: "neutral",
  // settlements
  processing: "info",
  // rider applications
  draft: "neutral",
  submitted: "warning",
  rejected: "danger",
};

const TONE_CLASSES: Record<string, string> = {
  neutral: "bg-secondary text-muted-foreground",
  success: "bg-success-soft text-success",
  warning: "bg-accent-soft text-accent-foreground",
  danger: "bg-destructive/10 text-destructive",
  info: "bg-info-soft text-info",
};

export function AdminStatusBadge({ status, label }: { status: string; label?: string }) {
  const tone = TONE_BY_STATUS[status] ?? "neutral";
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-[11px] font-semibold capitalize",
        TONE_CLASSES[tone],
      )}
    >
      {label ?? status.replaceAll("_", " ")}
    </span>
  );
}
