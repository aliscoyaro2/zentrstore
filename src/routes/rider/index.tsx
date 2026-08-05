import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { 
  Bike, 
  MapPin, 
  Navigation, 
  PackageCheck, 
  Radio, 
  Star, 
  X,
  CheckCircle2,
  Clock,
  AlertCircle,
  Loader2,
  Home,
  ShoppingBag,
  User,
  Navigation2,
  Check,
  Circle
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Screen, PageHeader, Panel, EmptyState } from "@/components/zentra/shell";
import { RiderBottomNav } from "@/components/zentra/rider-bottom-nav";
import { statusLabel } from "@/components/zentra/status-rail";
import { useRoleGuard } from "@/hooks/use-role-guard";
import { useRiderLocationTracking } from "@/hooks/use-rider-location";
import { naira } from "@/lib/money";
import { cn } from "@/lib/utils";
import { OrderRouteMap } from "@/components/zentra/map/order-route-map";

export const Route = createFileRoute("/rider/")({
  head: () => ({
    meta: [
      { title: "Rider dashboard — Zentra" },
      {
        name: "description",
        content: "Go online, pick up assigned deliveries and move each Zentra order to delivered.",
      },
    ],
  }),
  component: RiderDashboard,
});

// Statuses during which a delivery is actively "in the rider's hands"
const ACTIVE_DELIVERY_STATUSES = new Set([
  "rider_assigned",
  "rider_en_route_to_merchant",
  "picked_up",
  "rider_en_route_to_customer",
]);

const ACCEPT_WINDOW_SECONDS = 90;

// Define the journey steps with visual states
const JOURNEY_STEPS = [
  { id: "assigned", label: "Assigned", icon: Clock },
  { id: "heading_to_store", label: "Heading to store", icon: Navigation },
  { id: "arrived_store", label: "At store", icon: MapPin },
  { id: "picked_up", label: "Picked up", icon: PackageCheck },
  { id: "heading_to_customer", label: "Heading to customer", icon: Navigation2 },
  { id: "delivered", label: "Delivered", icon: CheckCircle2 },
] as const;

type JourneyStep = typeof JOURNEY_STEPS[number]["id"];

// Map order status to journey step
const STATUS_TO_STEP: Record<string, JourneyStep> = {
  rider_assigned: "assigned",
  rider_en_route_to_merchant: "heading_to_store",
  picked_up: "picked_up",
  rider_en_route_to_customer: "heading_to_customer",
  delivered: "delivered",
};

// Map step to button actions
const STEP_ACTIONS: Record<JourneyStep, { label: string; nextStep: JourneyStep | null }> = {
  assigned: { label: "Head to store", nextStep: "heading_to_store" },
  heading_to_store: { label: "I've arrived at store", nextStep: "arrived_store" },
  arrived_store: { label: "Confirm pickup", nextStep: "picked_up" },
  picked_up: { label: "Head to customer", nextStep: "heading_to_customer" },
  heading_to_customer: { label: "Complete delivery", nextStep: "delivered" },
  delivered: { label: "Completed", nextStep: null },
};

function RiderDashboard() {
  const { user, ready } = useRoleGuard("rider");
  const queryClient = useQueryClient();

  const rider = useQuery({
    queryKey: ["rider", user?.id],
    enabled: ready,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("riders")
        .select("id,status,is_online,total_deliveries,rating_avg,vehicle_make,vehicle_model,current_lat,current_lng")
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

  // Get active jobs (not completed/cancelled)
  const jobs = useQuery({
    queryKey: ["rider-jobs", user?.id],
    enabled: ready,
    refetchInterval: 5000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select(
          `
          id,
          status,
          total_kobo,
          delivery_fee_kobo,
          rider_assigned_at,
          placed_at,
          merchants (
            business_name,
            address_text,
            phone,
            lat,
            lng
          ),
          addresses (
            formatted,
            lat,
            lng
          )
          `
        )
        .eq("rider_id", user!.id)
        // 'delivered' = rider dropped it off, awaiting customer confirmation
        // (or the 24h auto-complete safety net). 'completed' = paid out.
        .in("status", ["rider_assigned", "rider_en_route_to_merchant", "picked_up", "rider_en_route_to_customer", "delivered", "completed"])
        .order("placed_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Get available offers (for dispatch)
  const offers = useQuery({
    queryKey: ["rider-offers", user?.id],
    enabled: ready && Boolean(rider.data?.is_online),
    refetchInterval: 3000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("order_offers")
        .select(`
          id,
          status,
          expires_at,
          offered_at,
          order:order_id (
            id,
            total_kobo,
            delivery_fee_kobo,
            prep_time_mins,
            merchant:merchant_id (
              business_name,
              address_text,
              lat,
              lng
            ),
            addresses (
              formatted,
              landmark,
              lat,
              lng
            )
          )
        `)
        .eq("rider_id", user!.id)
        .eq("status", "pending")
        .gte("expires_at", new Date().toISOString())
        .order("offered_at", { ascending: true })
        .limit(5);
      if (error) throw error;
      return data;
    },
  });

  // Stamp rider_assigned_at for accept window
  const stampedRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    const needsStamp = (jobs.data ?? []).find(
      (j) => j.status === "rider_assigned" && !j.rider_assigned_at && !stampedRef.current.has(j.id),
    );
    if (!needsStamp) return;
    stampedRef.current.add(needsStamp.id);
    supabase
      .from("orders")
      .update({ rider_assigned_at: new Date().toISOString() })
      .eq("id", needsStamp.id)
      .then(() => jobs.refetch());
  }, [jobs.data]);

  useRiderLocationTracking(rider.data?.id, Boolean(rider.data?.is_online));

  if (!ready) return null;

  if (rider.isFetched && !rider.data) {
    return (
      <Screen navSlot={<RiderBottomNav />}>
        <PageHeader title="Rider" back="/" />
        <div className="px-4 py-8">
          <EmptyState
            title="You're not a rider yet"
            body="Apply with your motorcycle details and we'll verify you."
          />
          <Link
            to="/partners"
            className="mt-4 block rounded-xl bg-primary py-3.5 text-center font-bold text-primary-foreground"
          >
            Apply to ride
          </Link>
        </div>
      </Screen>
    );
  }

  // "delivered" still counts as active — the rider has dropped it off but
  // is waiting on the customer to confirm (or the 24h auto-complete) before
  // it's truly done and paid out. Only "completed" leaves the active list.
  const allActive = (jobs.data ?? []).filter(
    (j) => j.status !== "completed" && j.status !== "cancelled"
  );

  // Separate current job vs completed
  const [currentJob, ...queuedJobs] = allActive;
  const completedJobs = (jobs.data ?? []).filter((j) => j.status === "completed");

  const isVerified = rider.data?.status === "approved";
  const isOnline = Boolean(rider.data?.is_online);
  // A rider can go offline once they've dropped off (delivered) — they're
  // just waiting on the customer now, not actively en route.
  const hasActiveDelivery = Boolean(
    currentJob && ACTIVE_DELIVERY_STATUSES.has(currentJob.status) && currentJob.status !== "delivered",
  );
  const isPendingAccept = currentJob?.status === "rider_assigned";

  // Get available offers (pending)
  const availableOffers = offers.data ?? [];

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

      <div className="space-y-4 px-4 py-5 pb-24">
        {/* Online toggle */}
        <OnlineToggle
          isOnline={isOnline}
          isVerified={isVerified}
          hasActiveDelivery={hasActiveDelivery}
          toggleOnline={async () => {
            if (!rider.data) return;
            if (rider.data.is_online && hasActiveDelivery) {
              toast.error("Can't go offline mid-delivery", {
                description: "Finish your current job before going offline.",
              });
              return;
            }
            const { error } = await supabase
              .from("riders")
              .update({ is_online: !rider.data.is_online })
              .eq("id", rider.data.id);
            if (error) toast.error("Could not update", { description: error.message });
            else await rider.refetch();
          }}
        />

        {/* Available Jobs (from dispatch) */}
        {isOnline && availableOffers.length > 0 && !currentJob && (
          <AvailableJobsSection 
            offers={availableOffers} 
            riderLocation={
              rider.data?.current_lat != null && rider.data?.current_lng != null
                ? { lat: rider.data.current_lat, lng: rider.data.current_lng }
                : null
            }
            onAccept={async (offerId) => {
              try {
                const { acceptOffer } = await import("@/lib/dispatch.functions");
                const result = await acceptOffer({ data: { offerId } });
                toast.success("Job accepted!");
                await Promise.all([jobs.refetch(), offers.refetch()]);
              } catch (err) {
                toast.error("Could not accept", { description: err instanceof Error ? err.message : undefined });
              }
            }}
            onDecline={async (offerId) => {
              try {
                const { declineOffer } = await import("@/lib/dispatch.functions");
                await declineOffer({ data: { offerId } });
                await offers.refetch();
              } catch (err) {
                toast.error("Could not decline", { description: err instanceof Error ? err.message : undefined });
              }
            }}
          />
        )}

        {/* Current Job */}
        {currentJob && isPendingAccept ? (
          <IncomingJobCard
            job={currentJob}
            onAccept={async () => {
              await advanceOrder(currentJob.id, "rider_en_route_to_merchant");
            }}
            onDecline={async () => {
              await declineOrder(currentJob.id);
            }}
          />
        ) : currentJob ? (
          <CurrentJobCard 
            job={currentJob} 
            riderLocation={
              rider.data?.current_lat != null && rider.data?.current_lng != null
                ? { lat: rider.data.current_lat, lng: rider.data.current_lng }
                : null
            }
            onAdvance={async (orderId, status) => {
              await advanceOrder(orderId, status);
            }}
          />
        ) : isOnline ? (
          <WaitingState />
        ) : (
          <EmptyState
            title="You're offline"
            body="Go online above to start receiving delivery jobs near you."
          />
        )}

        {/* Queued Jobs */}
        {queuedJobs.length > 0 && (
          <QueuedJobsSection jobs={queuedJobs} />
        )}

        {/* Completed Jobs (Today) */}
        {completedJobs.length > 0 && (
          <CompletedJobsSection jobs={completedJobs} />
        )}

        {/* Stats */}
        <StatsSection 
          deliveries={rider.data?.total_deliveries ?? 0}
          rating={Number(rider.data?.rating_avg ?? 5).toFixed(1)}
          balance={balance.data?.balance_kobo ?? 0}
        />
      </div>
    </Screen>
  );

  // Helper functions
  async function advanceOrder(orderId: string, status: string) {
    // delivered_at is now stamped server-side (trg_mark_order_delivered),
    // and rider payout only fires once the customer confirms and the order
    // reaches 'completed' — see update_rider_balance(). This just moves the
    // status forward.
    const patch = { status: status as "rider_en_route_to_merchant" | "picked_up" | "rider_en_route_to_customer" | "delivered" };

    const { error } = await supabase.from("orders").update(patch).eq("id", orderId);
    if (error) {
      toast.error("Update failed", { description: error.message });
      return;
    }
    await jobs.refetch();
    toast.success("Status updated");
  }

  async function declineOrder(orderId: string) {
    const { error } = await supabase
      .from("orders")
      .update({ rider_id: null, status: "preparing", rider_assigned_at: null })
      .eq("id", orderId);
    if (error) {
      toast.error("Could not decline", { description: error.message });
      return;
    }
    toast("Job declined", { description: "It's been sent back to dispatch." });
    await jobs.refetch();
  }
}

// ── Components ──

function OnlineToggle({ 
  isOnline, 
  isVerified, 
  hasActiveDelivery, 
  toggleOnline 
}: { 
  isOnline: boolean; 
  isVerified: boolean; 
  hasActiveDelivery: boolean; 
  toggleOnline: () => void;
}) {
  return (
    <button
      type="button"
      onClick={toggleOnline}
      disabled={!isVerified}
      className={cn(
        "flex w-full items-center justify-between rounded-2xl border p-4 text-left shadow-card transition disabled:opacity-50",
        isOnline ? "border-success/30 bg-success-soft" : "border-border bg-card"
      )}
    >
      <span className="flex items-center gap-3">
        <span
          className={cn(
            "grid size-10 shrink-0 place-items-center rounded-full",
            isOnline ? "bg-success text-primary-foreground" : "bg-secondary text-muted-foreground"
          )}
        >
          <Radio className="size-5" strokeWidth={2.2} />
        </span>
        <span>
          <span className="block text-sm font-bold">
            {isOnline ? "You're online" : "You're offline"}
          </span>
          <span className="block text-xs text-muted-foreground">
            {isOnline && hasActiveDelivery
              ? "Finish your current job to go offline"
              : isOnline
                ? "Dispatch can send you jobs"
                : "Tap to start receiving jobs"}
          </span>
        </span>
      </span>
      <span
        className={cn(
          "rounded-full px-3 py-1.5 text-[10px] font-bold",
          isOnline ? "bg-success text-primary-foreground" : "bg-secondary text-muted-foreground"
        )}
      >
        {isOnline ? "GO OFFLINE" : "GO ONLINE"}
      </span>
    </button>
  );
}

function AvailableJobsSection({ 
  offers, 
  riderLocation,
  onAccept, 
  onDecline 
}: { 
  offers: any[]; 
  riderLocation?: { lat: number; lng: number } | null;
  onAccept: (offerId: string) => void; 
  onDecline: (offerId: string) => void;
}) {
  return (
    <div>
      <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
        Available jobs ({offers.length})
      </h2>
      <div className="space-y-3">
        {offers.map((offer) => (
          <OfferCard key={offer.id} offer={offer} riderLocation={riderLocation} onAccept={onAccept} onDecline={onDecline} />
        ))}
      </div>
    </div>
  );
}

// ── Single offer card: full route preview before the rider commits ──

function OfferCard({
  offer,
  riderLocation,
  onAccept,
  onDecline,
}: {
  offer: any;
  riderLocation?: { lat: number; lng: number } | null;
  onAccept: (offerId: string) => void;
  onDecline: (offerId: string) => void;
}) {
  const order = offer.order;
  const merchant = order?.merchant;
  const dropoff = order?.addresses;
  const [expiresIn, setExpiresIn] = useState(() =>
    Math.max(0, Math.floor((new Date(offer.expires_at).getTime() - Date.now()) / 1000))
  );

  useEffect(() => {
    const tick = () =>
      setExpiresIn(Math.max(0, Math.floor((new Date(offer.expires_at).getTime() - Date.now()) / 1000)));
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [offer.expires_at]);

  const hasMerchantLocation = merchant?.lat != null && merchant?.lng != null;
  const hasDropoffLocation = dropoff?.lat != null && dropoff?.lng != null;

  // Distance/ETA from the rider's current position to the pickup point —
  // routed through the server-side MapProviderService, never called
  // directly from the client.
  const pickupTrip = useQuery({
    queryKey: ["offer-pickup-trip", offer.id, riderLocation?.lat, riderLocation?.lng],
    enabled: Boolean(riderLocation) && hasMerchantLocation,
    staleTime: 60_000,
    queryFn: async () => {
      const { calculateDistance } = await import("@/lib/routing.functions");
      return calculateDistance({ data: { from: riderLocation!, to: { lat: merchant.lat, lng: merchant.lng } } });
    },
  });

  return (
    <Panel className="overflow-hidden border-primary/30">
      {hasMerchantLocation && hasDropoffLocation && (
        <OrderRouteMap
          merchant={{ lat: merchant.lat, lng: merchant.lng, label: merchant.business_name ?? "Pickup" }}
          customer={{ lat: dropoff.lat, lng: dropoff.lng, label: dropoff.formatted ?? "Drop-off" }}
          rider={riderLocation}
          className="h-40 w-full rounded-none border-0"
        />
      )}

      <div className="p-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="font-bold text-sm">{merchant?.business_name ?? "Store"}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{merchant?.address_text}</p>
          </div>
          <span className={cn("text-xs font-bold tabular-nums", expiresIn <= 15 ? "text-destructive" : "text-muted-foreground")}>
            {expiresIn}s left
          </span>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {pickupTrip.data ? (
            <>
              <span>{(pickupTrip.data.distanceMeters / 1000).toFixed(1)} km to pickup</span>
              <span>~{Math.round(pickupTrip.data.durationSeconds / 60)} min away</span>
            </>
          ) : riderLocation && hasMerchantLocation ? (
            <span>Calculating distance…</span>
          ) : null}
          {order?.prep_time_mins != null && <span>~{order.prep_time_mins} min prep</span>}
        </div>

        {dropoff?.formatted && (
          <div className="mt-2.5 border-t border-border pt-2.5">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Drop-off</p>
            <p className="mt-0.5 text-xs text-foreground">{dropoff.formatted}</p>
            {dropoff.landmark && (
              <p className="mt-0.5 text-xs text-muted-foreground">Landmark: {dropoff.landmark}</p>
            )}
          </div>
        )}

        <p className="font-display font-bold text-primary mt-2 text-base">
          Est. earnings: {naira(order?.delivery_fee_kobo ?? 0)}
        </p>

        <div className="flex gap-2 mt-3">
          <button
            type="button"
            onClick={() => onAccept(offer.id)}
            className="flex-1 rounded-lg bg-primary py-2.5 text-sm font-bold text-primary-foreground"
          >
            Accept
          </button>
          <button
            type="button"
            onClick={() => onDecline(offer.id)}
            className="flex-1 rounded-lg border border-border py-2.5 text-sm font-bold text-muted-foreground"
          >
            Decline
          </button>
        </div>
      </div>
    </Panel>
  );
}

function WaitingState() {
  return (
    <div className="rounded-2xl border border-dashed border-primary/30 bg-primary/5 p-6 text-center">
      <Radio className="mx-auto size-6 text-primary animate-pulse" strokeWidth={2.2} />
      <p className="mt-2 font-display text-base font-extrabold">Waiting for a job</p>
      <p className="mt-1 text-sm text-muted-foreground">
        You're online and visible to dispatch. This screen updates automatically.
      </p>
    </div>
  );
}

function QueuedJobsSection({ jobs }: { jobs: any[] }) {
  return (
    <div>
      <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
        Next up ({jobs.length})
      </h2>
      <div className="space-y-2">
        {jobs.map((j) => (
          <Panel key={j.id} className="flex items-center justify-between gap-3 p-3">
            <div>
              <p className="text-sm font-bold">{j.merchants?.business_name ?? "Store"}</p>
              <p className="text-xs text-muted-foreground">{statusLabel(j.status)}</p>
            </div>
            <span className="font-display font-bold">{naira(j.delivery_fee_kobo)}</span>
          </Panel>
        ))}
      </div>
    </div>
  );
}

function CompletedJobsSection({ jobs }: { jobs: any[] }) {
  return (
    <div>
      <h2 className="text-xs font-bold uppercase tracking-wider text-success mb-2">
        Completed today ({jobs.length})
      </h2>
      <div className="space-y-2">
        {jobs.map((j) => (
          <Panel key={j.id} className="flex items-center justify-between gap-3 p-3 bg-success/5 border-success/20">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="size-4 text-success" />
              <div>
                <p className="text-sm font-bold">{j.merchants?.business_name ?? "Store"}</p>
                <p className="text-xs text-success">Delivered</p>
              </div>
            </div>
            <span className="font-display font-bold">{naira(j.delivery_fee_kobo)}</span>
          </Panel>
        ))}
      </div>
    </div>
  );
}

function StatsSection({ deliveries, rating, balance }: { deliveries: number; rating: string; balance: number }) {
  return (
    <div className="grid grid-cols-3 gap-2 pt-1">
      <Stat icon={PackageCheck} label="Deliveries" value={String(deliveries)} />
      <Stat icon={Star} label="Rating" value={rating} />
      <Stat icon={Bike} label="Balance" value={naira(balance)} />
    </div>
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

// ── Incoming Job Card (with countdown) ──

function IncomingJobCard({
  job,
  onAccept,
  onDecline,
}: {
  job: any;
  onAccept: () => void;
  onDecline: () => void;
}) {
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);

  useEffect(() => {
    if (!job.rider_assigned_at) {
      setSecondsLeft(ACCEPT_WINDOW_SECONDS);
      return;
    }
    const assignedAt = new Date(job.rider_assigned_at).getTime();
    const tick = () => {
      const elapsed = Math.floor((Date.now() - assignedAt) / 1000);
      setSecondsLeft(Math.max(0, ACCEPT_WINDOW_SECONDS - elapsed));
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [job.rider_assigned_at]);

  const expired = secondsLeft === 0;

  return (
    <Panel className="overflow-hidden border-primary/40">
      <div className="flex items-center justify-between border-b border-border bg-primary px-4 py-2.5">
        <p className="text-[11px] font-bold uppercase tracking-wider text-primary-foreground">
          New delivery request
        </p>
        {secondsLeft !== null ? (
          <span
            className={cn(
              "rounded-full px-2.5 py-1 text-xs font-extrabold tabular-nums",
              expired ? "bg-destructive text-destructive-foreground" : "bg-primary-foreground/20 text-primary-foreground"
            )}
          >
            {expired ? "Time's up" : `${Math.floor((secondsLeft ?? 0) / 60)}:${String((secondsLeft ?? 0) % 60).padStart(2, "0")}`}
          </span>
        ) : null}
      </div>
      <div className="p-4">
        <p className="text-base font-bold">{job.merchants?.business_name ?? "Store"}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {job.merchants?.address_text ?? "Pickup address to follow"}
        </p>
        <p className="mt-3 font-display text-lg font-extrabold text-primary">
          {naira(job.delivery_fee_kobo)}
        </p>

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={onDecline}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-border bg-card py-3.5 text-sm font-bold text-muted-foreground"
          >
            <X className="size-4" strokeWidth={2.5} />
            Decline
          </button>
          <button
            type="button"
            onClick={onAccept}
            className="flex-1 rounded-xl bg-primary py-3.5 text-sm font-bold text-primary-foreground"
          >
            Accept
          </button>
        </div>
      </div>
    </Panel>
  );
}

// ── Current Job Card (with Visual Progress) ──

function CurrentJobCard({
  job,
  riderLocation,
  onAdvance,
}: {
  job: any;
  riderLocation?: { lat: number; lng: number } | null;
  onAdvance: (orderId: string, status: string) => void;
}) {
  const currentStep = STATUS_TO_STEP[job.status] || "assigned";
  const stepIndex = JOURNEY_STEPS.findIndex(s => s.id === currentStep);
  const isDelivered = job.status === "delivered";
  
  const action = STEP_ACTIONS[currentStep];
  const [arrived, setArrived] = useState(false);

  // Show arrival step if heading to store and not yet arrived
  const showArrivalStep = job.status === "rider_en_route_to_merchant" && !arrived;

  // Calculate progress percentage
  const progress = isDelivered ? 100 : Math.round((stepIndex / (JOURNEY_STEPS.length - 1)) * 100);

  return (
    <Panel className="overflow-hidden">
      <div className="border-b border-border bg-primary/5 px-4 py-2.5 flex items-center justify-between">
        <p className="text-[11px] font-bold uppercase tracking-wider text-primary">Active delivery</p>
        <span className="text-xs font-bold text-muted-foreground">
          {progress}% complete
        </span>
      </div>

      <div className="p-4 space-y-4">
        {/* Progress Bar */}
        <div className="relative">
          <div className="h-2 w-full rounded-full bg-secondary overflow-hidden">
            <div 
              className="h-full bg-primary transition-all duration-500 ease-in-out"
              style={{ width: `${progress}%` }}
            />
          </div>
          
          {/* Step Indicators */}
          <div className="flex justify-between mt-1">
            {JOURNEY_STEPS.map((step, idx) => {
              const isActive = idx <= stepIndex;
              const isCurrent = idx === stepIndex;
              const Icon = step.icon;
              return (
                <div key={step.id} className="flex flex-col items-center">
                  <div
                    className={cn(
                      "rounded-full p-1 transition-all",
                      isActive && !isDelivered ? "bg-primary text-primary-foreground" : 
                      isDelivered ? "bg-success text-primary-foreground" :
                      "bg-secondary text-muted-foreground"
                    )}
                  >
                    <Icon className="size-3" strokeWidth={2.5} />
                  </div>
                  <p className={cn(
                    "text-[8px] font-medium mt-1 hidden sm:block",
                    isActive ? "text-foreground" : "text-muted-foreground"
                  )}>
                    {step.label}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Store Info */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-base font-bold">{job.merchants?.business_name ?? "Store"}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {job.merchants?.address_text ?? "Address not provided"}
            </p>
            <div className="flex items-center gap-3 mt-2">
              <span className="text-xs font-bold text-primary">
                {naira(job.delivery_fee_kobo)}
              </span>
              <span className="text-xs text-muted-foreground">
                • Order #{job.id.slice(0, 8)}
              </span>
            </div>
          </div>
          {job.merchants?.phone && (
            <a 
              href={`tel:${job.merchants.phone}`}
              className="grid size-9 place-items-center rounded-full bg-primary/10 text-primary"
            >
              <svg className="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
            </a>
          )}
        </div>

        {/* Route map — always visible, follows the current delivery leg */}
        {job.merchants?.lat != null && job.merchants?.lng != null && job.addresses?.lat != null && job.addresses?.lng != null && (
          <ActiveRouteMap job={job} riderLocation={riderLocation} />
        )}

        {/* Action Button */}
        {!isDelivered ? (
          <div>
            {showArrivalStep ? (
              <button
                type="button"
                onClick={() => setArrived(true)}
                className="w-full rounded-xl bg-accent py-3.5 text-sm font-bold text-accent-foreground"
              >
                <span className="flex items-center justify-center gap-2">
                  <MapPin className="size-4" />
                  I've arrived at the store
                </span>
              </button>
            ) : job.status === "rider_en_route_to_merchant" && arrived ? (
              <button
                type="button"
                onClick={() => onAdvance(job.id, "picked_up")}
                className="w-full rounded-xl bg-primary py-3.5 text-sm font-bold text-primary-foreground"
              >
                <span className="flex items-center justify-center gap-2">
                  <PackageCheck className="size-4" />
                  Confirm pickup
                </span>
              </button>
            ) : action && action.nextStep ? (
              <button
                type="button"
                onClick={() => {
                  if (action.nextStep === "delivered") {
                    onAdvance(job.id, "delivered");
                  } else if (action.nextStep === "heading_to_store") {
                    onAdvance(job.id, "rider_en_route_to_merchant");
                  } else if (action.nextStep === "heading_to_customer") {
                    onAdvance(job.id, "rider_en_route_to_customer");
                  } else if (action.nextStep === "picked_up") {
                    onAdvance(job.id, "picked_up");
                  }
                }}
                className="w-full rounded-xl bg-primary py-3.5 text-sm font-bold text-primary-foreground"
              >
                <span className="flex items-center justify-center gap-2">
                  {action.nextStep === "heading_to_store" && <Navigation className="size-4" />}
                  {action.nextStep === "heading_to_customer" && <Navigation2 className="size-4" />}
                  {action.nextStep === "delivered" && <CheckCircle2 className="size-4" />}
                  {action.label}
                </span>
              </button>
            ) : null}
          </div>
        ) : (
          <div className="space-y-2 rounded-xl bg-success/10 p-3">
            <div className="flex items-center justify-center gap-2 text-sm font-bold text-success">
              <CheckCircle2 className="size-4" />
              Marked as delivered
            </div>
            <p className="text-center text-xs text-muted-foreground">
              Waiting for the customer to confirm. You're free to go offline or take the next job —
              you'll still get paid once they confirm, or automatically after 24 hours.
            </p>
          </div>
        )}
      </div>
    </Panel>
  );
}

// ── Active-delivery route map: always visible, follows the current leg ──
// Before pickup: rider -> merchant. After pickup: merchant -> customer
// (the rider's live position still shows on the map either way).
function ActiveRouteMap({
  job,
  riderLocation,
}: {
  job: any;
  riderLocation?: { lat: number; lng: number } | null;
}) {
  const isHeadingToCustomer = job.status === "picked_up" || job.status === "rider_en_route_to_customer";
  const legLabel = isHeadingToCustomer ? "Route to customer" : "Route to store";

  const routeFrom = isHeadingToCustomer
    ? { lat: job.merchants.lat, lng: job.merchants.lng }
    : riderLocation ?? { lat: job.merchants.lat, lng: job.merchants.lng };
  const routeTo = isHeadingToCustomer
    ? { lat: job.addresses.lat, lng: job.addresses.lng }
    : { lat: job.merchants.lat, lng: job.merchants.lng };

  const route = useQuery({
    queryKey: ["active-job-route", job.id, job.status, routeFrom.lat, routeFrom.lng, routeTo.lat, routeTo.lng],
    staleTime: 30_000,
    queryFn: async () => {
      const { calculateRoute } = await import("@/lib/routing.functions");
      return calculateRoute({ data: { points: [routeFrom, routeTo] } });
    },
  });

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <p className="flex items-center gap-1.5 text-xs font-semibold text-primary">
          <MapPin className="size-3.5" />
          {legLabel}
        </p>
        {route.data && (
          <p className="text-xs text-muted-foreground">
            {(route.data.distanceMeters / 1000).toFixed(1)} km · ~{Math.round(route.data.durationSeconds / 60)} min
          </p>
        )}
      </div>
      <OrderRouteMap
        merchant={{ lat: job.merchants.lat, lng: job.merchants.lng, label: job.merchants.business_name ?? "Store" }}
        customer={{ lat: job.addresses.lat, lng: job.addresses.lng, label: "Drop-off" }}
        rider={riderLocation}
        routePolyline={route.data?.polyline}
        className="h-56 w-full"
      />
    </div>
  );
}