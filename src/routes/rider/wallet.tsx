import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Wallet, ArrowDownToLine, Clock, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Screen, PageHeader, Panel, EmptyState } from "@/components/zentra/shell";
import { RiderBottomNav } from "@/components/zentra/rider-bottom-nav";
import { useRoleGuard } from "@/hooks/use-role-guard";
import { naira } from "@/lib/money";

export const Route = createFileRoute("/rider/wallet")({
  head: () => ({
    meta: [
      { title: "Wallet — Zentra Rider" },
      {
        name: "description",
        content: "Track your Zentra delivery earnings and settlement history.",
      },
    ],
  }),
  component: RiderWallet,
});

// Every completed delivery credits the rider via a `rider_earnings` ledger
// entry (see admin.support.tsx / schema for the sibling pattern). We read
// straight from `ledger` rather than recomputing from `orders`, since the
// ledger is the single source of truth the backend already reconciles
// settlements against.
type LedgerRow = {
  id: string;
  amount_kobo: number;
  type: string;
  created_at: string | null;
  order_id: string | null;
};

type SettlementRow = {
  id: string;
  amount_kobo: number;
  status: "pending" | "processing" | "paid" | "failed";
  bank_reference: string | null;
  created_at: string | null;
  paid_at: string | null;
};

function RiderWallet() {
  const { user, ready } = useRoleGuard("rider");

  const balance = useQuery({
    queryKey: ["rider-balance", user?.id],
    enabled: ready,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rider_balances")
        .select("balance_kobo,last_settled_at")
        .eq("rider_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  // NOTE for backend: `ledger.to_party`/`from_party` are plain strings with
  // no documented convention in this repo (no existing frontend code writes
  // to this table — it's populated by a DB trigger). This assumes the
  // rider's own id is stored verbatim. If the real convention is prefixed
  // (e.g. "rider:<uuid>") this filter needs to match that instead — flagging
  // for whoever wires the trigger/schema doc.
  const earnings = useQuery({
    queryKey: ["rider-earnings", user?.id],
    enabled: ready,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ledger")
        .select("id,amount_kobo,type,created_at,order_id")
        .eq("to_party", user!.id)
        .eq("type", "rider_earnings")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data as LedgerRow[];
    },
    // Don't let an unconfirmed ledger convention take down the whole wallet
    // screen — the balance card above still works off rider_balances either way.
    retry: false,
  });

  const settlements = useQuery({
    queryKey: ["rider-settlements", user?.id],
    enabled: ready,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("settlements")
        .select("id,amount_kobo,status,bank_reference,created_at,paid_at")
        .eq("rider_id", user!.id)
        .eq("party_type", "rider")
        .order("created_at", { ascending: false })
        .limit(30);
      if (error) throw error;
      return data as SettlementRow[];
    },
  });

  if (!ready) return null;

  // Today's earnings — summed client-side from today's ledger rows, since
  // there's no server-side daily rollup yet.
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const todayKobo = (earnings.data ?? [])
    .filter((e) => e.created_at && new Date(e.created_at) >= startOfToday)
    .reduce((sum, e) => sum + e.amount_kobo, 0);

  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  const weekKobo = (earnings.data ?? [])
    .filter((e) => e.created_at && new Date(e.created_at) >= weekAgo)
    .reduce((sum, e) => sum + e.amount_kobo, 0);

  return (
    <Screen navSlot={<RiderBottomNav />}>
      <PageHeader title="Wallet" subtitle="Earnings & settlements" back="/rider" />

      <div className="space-y-4 px-4 py-5">
        {/* Balance — the headline number, same visual weight the online
            toggle gets on the dashboard, since this is the other thing
            a rider checks constantly. */}
        <Panel className="overflow-hidden">
          <div className="bg-primary p-5 text-primary-foreground">
            <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider opacity-80">
              <Wallet className="size-3.5" strokeWidth={2.5} />
              Available balance
            </p>
            <p className="mt-1 font-display text-3xl font-extrabold">
              {naira(balance.data?.balance_kobo ?? 0)}
            </p>
            {balance.data?.last_settled_at ? (
              <p className="mt-1 text-xs opacity-80">
                Last paid out {new Date(balance.data.last_settled_at).toLocaleDateString("en-NG", {
                  day: "numeric",
                  month: "short",
                })}
              </p>
            ) : (
              <p className="mt-1 text-xs opacity-80">No payouts yet</p>
            )}
          </div>
          <div className="grid grid-cols-2 divide-x divide-border">
            <div className="p-3 text-center">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Today</p>
              <p className="mt-0.5 font-display text-base font-extrabold">{naira(todayKobo)}</p>
            </div>
            <div className="p-3 text-center">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">This week</p>
              <p className="mt-0.5 font-display text-base font-extrabold">{naira(weekKobo)}</p>
            </div>
          </div>
        </Panel>

        <p className="rounded-xl border border-border bg-secondary/50 px-3 py-2.5 text-xs leading-relaxed text-muted-foreground">
          Payouts are settled to your bank account by the Zentra admin team. There's no cash to hand
          over — every delivery fee is already paid online before you pick up.
        </p>

        {/* Recent earnings */}
        <div>
          <h2 className="pb-2 text-xs font-bold uppercase tracking-[0.15em] text-muted-foreground">
            Recent deliveries
          </h2>
          {earnings.isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : (earnings.data ?? []).length === 0 ? (
            <EmptyState title="No earnings yet" body="Completed deliveries will show up here." />
          ) : (
            <div className="space-y-2">
              {(earnings.data ?? []).map((e) => (
                <Panel key={e.id} className="flex items-center justify-between gap-3 p-3">
                  <div className="flex items-center gap-3">
                    <span className="grid size-9 shrink-0 place-items-center rounded-full bg-success-soft text-success">
                      <ArrowDownToLine className="size-4" strokeWidth={2.5} />
                    </span>
                    <div>
                      <p className="text-sm font-bold">Delivery earnings</p>
                      <p className="text-xs text-muted-foreground">
                        {e.created_at
                          ? new Date(e.created_at).toLocaleString("en-NG", {
                              day: "numeric",
                              month: "short",
                              hour: "numeric",
                              minute: "2-digit",
                            })
                          : ""}
                      </p>
                    </div>
                  </div>
                  <span className="shrink-0 font-display text-sm font-extrabold text-success">
                    +{naira(e.amount_kobo)}
                  </span>
                </Panel>
              ))}
            </div>
          )}
        </div>

        {/* Settlement history */}
        <div>
          <h2 className="pb-2 text-xs font-bold uppercase tracking-[0.15em] text-muted-foreground">
            Settlement history
          </h2>
          {settlements.isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : (settlements.data ?? []).length === 0 ? (
            <EmptyState
              title="No settlements yet"
              body="Once admin processes a payout, it'll appear here with the bank reference."
            />
          ) : (
            <div className="space-y-2">
              {(settlements.data ?? []).map((s) => (
                <SettlementCard key={s.id} settlement={s} />
              ))}
            </div>
          )}
        </div>
      </div>
    </Screen>
  );
}

const SETTLEMENT_STATUS: Record<
  SettlementRow["status"],
  { label: string; icon: typeof Clock; className: string }
> = {
  pending: { label: "Pending", icon: Clock, className: "bg-secondary text-muted-foreground" },
  processing: { label: "Processing", icon: Loader2, className: "bg-info-soft text-info" },
  paid: { label: "Paid", icon: CheckCircle2, className: "bg-success-soft text-success" },
  failed: { label: "Failed", icon: XCircle, className: "bg-destructive/10 text-destructive" },
};

function SettlementCard({ settlement }: { settlement: SettlementRow }) {
  const meta = SETTLEMENT_STATUS[settlement.status];
  const Icon = meta.icon;
  return (
    <Panel className="flex items-center justify-between gap-3 p-3">
      <div className="flex items-center gap-3">
        <span className={`grid size-9 shrink-0 place-items-center rounded-full ${meta.className}`}>
          <Icon className={`size-4 ${settlement.status === "processing" ? "animate-spin" : ""}`} strokeWidth={2.5} />
        </span>
        <div>
          <p className="text-sm font-bold">{naira(settlement.amount_kobo)}</p>
          <p className="text-xs text-muted-foreground">
            {settlement.bank_reference ?? "Awaiting bank reference"}
          </p>
        </div>
      </div>
      <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold ${meta.className}`}>
        {meta.label}
      </span>
    </Panel>
  );
}
