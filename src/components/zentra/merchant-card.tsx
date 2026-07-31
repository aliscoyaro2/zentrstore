import { Link } from "@tanstack/react-router";
import { categoryImage, categoryLabel } from "@/lib/categories";
import { naira } from "@/lib/money";

export type MerchantSummary = {
  id: string;
  business_name: string;
  category: string;
  address_text: string | null;
  is_open_override: boolean | null;
  opening_time: string | null;
  closing_time: string | null;
  fromKobo?: number | null;
};

export function isMerchantOpen(m: MerchantSummary): boolean {
  return m.is_open_override !== false;
}

export function MerchantCard({ merchant }: { merchant: MerchantSummary }) {
  const image = categoryImage(merchant.category);
  const open = isMerchantOpen(merchant);
  const initials = merchant.business_name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("");

  return (
    <Link
      to="/store/$merchantId"
      params={{ merchantId: merchant.id }}
      className="block overflow-hidden rounded-2xl border border-border bg-card shadow-card active:scale-[0.995]"
    >
      {image ? (
        <img
          src={image}
          alt={`${merchant.business_name} — ${categoryLabel(merchant.category)} in Maiduguri`}
          loading="lazy"
          width={910}
          height={512}
          className="aspect-video w-full object-cover"
        />
      ) : (
        <div className="flex aspect-[3/1] w-full items-center gap-3 bg-secondary px-4">
          <span className="grid size-11 place-items-center rounded-xl bg-primary/10 font-display text-base font-extrabold text-primary">
            {initials}
          </span>
          <span className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">
            {categoryLabel(merchant.category)}
          </span>
        </div>
      )}
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate font-display text-lg font-extrabold leading-tight">
              {merchant.business_name}
            </h3>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {categoryLabel(merchant.category)} • {merchant.address_text ?? "Maiduguri"}
            </p>
          </div>
          {open ? (
            <span className="shrink-0 rounded bg-success-soft px-2 py-1 text-[10px] font-bold text-success">
              15–25 min
            </span>
          ) : (
            <span className="shrink-0 rounded bg-secondary px-2 py-1 text-[10px] font-bold text-muted-foreground">
              CLOSED
            </span>
          )}
        </div>
        <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
          <span className="text-sm font-semibold">
            {merchant.fromKobo ? `From ${naira(merchant.fromKobo)}` : "Delivers in your zone"}
          </span>
          <span className="rounded-lg bg-primary px-4 py-2 text-xs font-bold text-primary-foreground">
            {open ? "Order now" : "View store"}
          </span>
        </div>
      </div>
    </Link>
  );
}
