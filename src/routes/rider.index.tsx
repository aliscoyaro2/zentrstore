import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Bike, MapPin, Navigation, PackageCheck, Radio, Star } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Screen, PageHeader, Panel, EmptyState } from "@/components/zentra/shell";
import { RiderBottomNav } from "@/components/zentra/rider-bottom-nav";
import { statusLabel } from "@/components/zentra/status-rail";
import { useRoleGuard } from "@/hooks/use-role-guard";
import { naira } from "@/lib/money";

export const Route = createFileRoute("/rider/")({
  head: () => ({
    meta: [
      { title: "Rider dashboard — Zentra" },
      {
        name: "description",
        content: "Go online, pick up assigned deliveries and move each Zentra order to delivered.",
      },
      { property: "og:title", content: "Zentra rider dashboard" },
      { property: "og:description", content: "Your assigned Maiduguri deliveries, step by step." },
    ],
  }),
  component: RiderDashboard,
});

const NEXT: Partial<Record<string, { status: string; label: string }>> = {
  rider_assigned: { status: "rider_en_route_to_merchant", label: "Heading to store" },
  rider_en_route_to_merchant: { status: "picked_up", label: "Picked up order" },
  picked_up: { status: "rider_en_route_to_customer", label: "Heading to customer" },
  rider_en_route_to_customer: { status: "delivered", label: "Mark delivered" },
};

// Where the rider currently needs to go, and which leg of the trip they're
// on — this drives the mini progress rail on the active job card.
const LEG: Record<string, { step: 0 | 1; verb: string; destination: "merchant" | "customer" }> = {
  rider_assigned: { step: 0, verb: "Head to store", destination: "merchant" },
  rider_en_route_to_merchant: { step: 0, verb: "On the way to store", destination: "merchant" },
  picked_up: { step: 1, verb: "Head to customer", destination: "customer" },
  rider_en_route_to_customer: { step: 1, verb: "On the way to customer", destination: "customer" },
};

function RiderDashboard() {
  const { user, ready } = useRoleGuard("rider");

  const rider = useQuery({
    queryKey: ["rider", user?.id],
    enabled: ready,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("riders")
        .select("id,status,is_online,total_deliveries,rating_avg,vehicle_make,vehicle_model")
        .eq("id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const balance = useQuery({
    queryKey: ["rider-balance", user?.id],
    enabled: ready,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rider_balances")
        .select("balance_kobo")
        .eq("rider_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const jobs = useQuery({
    queryKey: ["rider-jobs", user?.id],
    enabled: ready,
    refetchInterval: 20000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("id,status,total_kobo,delivery_fee_kobo,merchants(business_name,address_text),addresses(formatted)")
        .order("placed_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  async function toggleOnline() {
    if (!rider.data) return;
    const { error } = await supabase
      .from("riders")
      .update({ is_online: !rider.data.is_online })
      .eq("id", rider.data.id);
    if (error) toast.error("Could not update", { description: error.message });
    else await rider.refetch();
  }

  async function advance(orderId: string, status: string) {
    const { error } = await supabase
      .from("orders")
      .update(
        status === "delivered"
          ? { status: "delivered" as const, delivered_at: new Date().toISOString() }
          : { status: status as "rider_en_route_to_merchant" | "picked_up" | "rider_en_route_to_customer" },
      )
      .eq("id", orderId);
    if (error) toast.error("Update failed", { description: error.message });
    else await jobs.refetch();
  }

  if (!ready) return null;

  if (rider.isFetched && !rider.data) {
    return (
      <Screen>
        <PageHeader title="Rider" back="/" />
        <div className="px-4 py-8">
          <EmptyState
            title="You're not a rider yet"
            body="Apply with your motorcycle details and we'll verify you."
          />
          <Link
            to="/rider/apply"
            className="mt-4 block rounded-xl bg-primary py-3.5 text-center font-bold text-primary-foreground"
          >
            Apply to ride
          </Link>
        </div>
      </Screen>
    );
  }

  const allActive = (jobs.data ?? []).filter((j) => j.status !== "delivered" && j.status !== "cancelled");
  // A rider works one delivery at a time — the first active job (if any) is
  // "the job", everything else is queued behind it. This is the core fix:
  // the old screen rendered every active order as an identical card, so a
  // rider mid-delivery couldn't tell what needed their attention right now.
  const [currentJob, ...queuedJobs] = allActive;
  const isVerified = rider.data?.status === "approved";
  const isOnline = Boolean(rider.data?.is_online);

  return (
    <Screen navSlot={<RiderBottomNav />}>
      <PageHeader
        title="Rider"
        subtitle={
          rider.data
            ? `${rider.data.vehicle_make ?? ""} ${rider.data.vehicle_model ?? ""}`.trim() || "Motorcycle"
            : undefined
        }
        back="/"
      />

      <div className="space-y-4 px-4 py-5">
        {!isVerified ? (
          <div className="rounded-2xl border border-accent/30 bg-accent-soft p-4 text-sm">
            <p className="font-bold text-accent-foreground">Verification pending</p>
            <p className="mt-1 text-xs text-muted-foreground">
              You can go online once an admin approves your documents.
            </p>
          </div>
        ) : null}

        {/* Online status — the single most important control on this screen,
            so it gets its own full-width block rather than a small badge
            competing with the page title. */}
        <button
          type="button"
          onClick={toggleOnline}
          disabled={!isVerified}
          className={`flex w-full items-center justify-between rounded-2xl border p-4 text-left shadow-card transition disabled:opacity-50 ${
            isOnline ? "border-success/30 bg-success-soft" : "border-border bg-card"
          }`}
        >
          <span className="flex items-center gap-3">
            <span
              className={`grid size-10 shrink-0 place-items-center rounded-full ${
                isOnline ? "bg-success text-primary-foreground" : "bg-secondary text-muted-foreground"
              }`}
            >
              <Radio className="size-5" strokeWidth={2.2} />
            </span>
            <span>
              <span className="block text-sm font-bold">
                {isOnline ? "You're online" : "You're offline"}
              </span>
              <span className="block text-xs text-muted-foreground">
                {isOnline ? "Dispatch can send you jobs" : "Tap to start receiving jobs"}
              </span>
            </span>
          </span>
          <span
            className={`rounded-full px-3 py-1.5 text-[10px] font-bold ${
              isOnline ? "bg-success text-primary-foreground" : "bg-secondary text-muted-foreground"
            }`}
          >
            {isOnline ? "GO OFFLINE" : "GO ONLINE"}
          </span>
        </button>

        {/* Active job — the thing the rider needs right now, always first,
            always the visually dominant element when it exists. */}
        {currentJob ? (
          <CurrentJobCard job={currentJob} onAdvance={advance} />
        ) : isOnline ? (
          <div className="rounded-2xl border border-dashed border-primary/30 bg-primary/5 p-6 text-center">
            <Radio className="mx-auto size-6 text-primary" strokeWidth={2.2} />
            <p className="mt-2 font-display text-base font-extrabold">Waiting for a job</p>
            <p className="mt-1 text-sm text-muted-foreground">
              You're online and visible to dispatch. This screen updates automatically.
            </p>
          </div>
        ) : (
          <EmptyState
            title="You're offline"
            body="Go online above to start receiving delivery jobs near you."
          />
        )}

        {/* Queued jobs — batched work waiting behind the current job, kept
            visually quieter so they don't compete with it. */}
        {queuedJobs.length > 0 ? (
          <div>
            <h2 className="pb-2 text-xs font-bold uppercase tracking-[0.15em] text-muted-foreground">
              Next up ({queuedJobs.length})
            </h2>
            <div className="space-y-2">
              {queuedJobs.map((j) => (
                <Panel key={j.id} className="flex items-center justify-between gap-3 p-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold">{j.merchants?.business_name ?? "Store"}</p>
                    <p className="text-xs text-muted-foreground">{statusLabel(j.status)}</p>
                  </div>
                  <span className="shrink-0 text-sm font-bold">{naira(j.delivery_fee_kobo)}</span>
                </Panel>
              ))}
            </div>
          </div>
        ) : null}

        {/* Stats — useful context, not the headline of the page. */}
        <div className="grid grid-cols-3 gap-2 pt-1">
          <Stat icon={PackageCheck} label="Deliveries" value={String(rider.data?.total_deliveries ?? 0)} />
          <Stat icon={Star} label="Rating" value={Number(rider.data?.rating_avg ?? 5).toFixed(1)} />
          <Stat icon={Bike} label="Balance" value={naira(balance.data?.balance_kobo ?? 0)} />
        </div>
      </div>
    </Screen>
  );
}

type JobRow = {
  id: string;
  status: string;
  delivery_fee_kobo: number;
  merchants: { business_name: string | null; address_text: string | null } | null;
  addresses: { formatted: string | null } | null;
};

function CurrentJobCard({
  job,
  onAdvance,
}: {
  job: JobRow;
  onAdvance: (orderId: string, status: string) => void;
}) {
  const next = NEXT[job.status];
  const leg = LEG[job.status];
  const headingTo = leg?.destination === "customer" ? "customer" : "merchant";

  return (
    <Panel className="overflow-hidden">
      <div className="border-b border-border bg-primary/5 px-4 py-2.5">
        <p className="text-[11px] font-bold uppercase tracking-wider text-primary">Current job</p>
      </div>
      <div className="p-4">
        {/* Mini two-leg progress: pickup → drop-off */}
        <div className="mb-4 flex items-center gap-2">
          <Leg icon={MapPin} label="Pickup" active={leg?.step === 0} done={(leg?.step ?? 0) > 0} />
          <span className="h-px flex-1 bg-border" />
          <Leg icon={Navigation} label="Drop-off" active={leg?.step === 1} done={false} />
        </div>

        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-base font-bold">{job.merchants?.business_name ?? "Store"}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {headingTo === "merchant"
                ? job.merchants?.address_text ?? "See store for address"
                : job.addresses?.formatted ?? "Customer address"}
            </p>
          </div>
          <span className="shrink-0 font-display text-lg font-extrabold text-primary">
            {naira(job.delivery_fee_kobo)}
          </span>
        </div>

        {next ? (
          <button
            type="button"
            onClick={() => onAdvance(job.id, next.status)}
            className="mt-4 w-full rounded-xl bg-primary py-3.5 text-sm font-bold text-primary-foreground"
          >
            {next.label}
          </button>
        ) : (
          <p className="mt-4 text-center text-xs text-muted-foreground">{statusLabel(job.status)}</p>
        )}
      </div>
    </Panel>
  );
}

function Leg({
  icon: Icon,
  label,
  active,
  done,
}: {
  icon: typeof MapPin;
  label: string;
  active: boolean;
  done: boolean;
}) {
  return (
    <span className="flex shrink-0 items-center gap-1.5">
      <span
        className={`grid size-6 place-items-center rounded-full ${
          active ? "bg-primary text-primary-foreground" : done ? "bg-success text-primary-foreground" : "bg-secondary text-muted-foreground"
        }`}
      >
        <Icon className="size-3.5" strokeWidth={2.5} />
      </span>
      <span className={`text-[11px] font-bold ${active ? "text-primary" : "text-muted-foreground"}`}>
        {label}
      </span>
    </span>
  );
}

function Stat({ icon: Icon, label, value }: { icon: typeof Bike; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-3 text-center shadow-card">
      <Icon className="mx-auto mb-1 size-4 text-muted-foreground" strokeWidth={2.2} />
      <p className="font-display text-base font-extrabold leading-none">{value}</p>
      <p className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
    </div>
  );
}