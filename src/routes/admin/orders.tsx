import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Search, X, Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "@/components/admin/admin-layout";
import { AdminStatusBadge } from "@/components/admin/admin-status-badge";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { useRoleGuard } from "@/hooks/use-role-guard";
import { statusLabel, STATUS_COPY } from "@/components/zentra/status-rail";
import { naira } from "@/lib/money";
import { Marker, Popup } from "react-leaflet";
import { LeafletMap } from "@/components/zentra/map/leaflet-map";
import { merchantIcon, customerIcon, riderIcon } from "@/components/zentra/map/map-icons";

export const Route = createFileRoute("/admin/orders")({
  head: () => ({
    meta: [
      { title: "Orders — Zentra Admin" },
      { name: "description", content: "Search, filter, track and manage every Zentra order." },
    ],
  }),
  component: OrdersPage,
});

const STATUS_FILTERS = [
  "all",
  "placed",
  "paid",
  "merchant_accepted",
  "preparing",
  "rider_assigned",
  "picked_up",
  "delivered",
  "cancelled",
  "refunded",
] as const;

type OrderRow = {
  id: string;
  status: string;
  total_kobo: number;
  subtotal_kobo: number;
  delivery_fee_kobo: number;
  service_fee_kobo: number;
  placed_at: string | null;
  payment_reference: string;
  cancel_reason: string | null;
  merchants: { business_name: string; address_text: string | null; lat: number | null; lng: number | null } | null;
  addresses: { formatted: string | null; landmark: string | null; lat: number | null; lng: number | null } | null;
  profiles: { full_name: string | null; email: string | null } | null;
};

function OrdersPage() {
  const { ready } = useRoleGuard("admin");
  const queryClient = useQueryClient();
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<(typeof STATUS_FILTERS)[number]>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const orders = useQuery({
    queryKey: ["admin-orders-list"],
    enabled: ready,
    refetchInterval: 20000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select(
          "id,status,total_kobo,subtotal_kobo,delivery_fee_kobo,service_fee_kobo,placed_at,payment_reference,cancel_reason,merchants(business_name,address_text,lat,lng),addresses(formatted,landmark,lat,lng),profiles:customer_id(full_name,email)",
        )
        .order("placed_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as unknown as OrderRow[];
    },
  });

  const riders = useQuery({
    queryKey: ["admin-orders-approved-riders"],
    enabled: ready,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("riders")
        .select("id,vehicle_make,plate_number,is_online,current_lat,current_lng")
        .eq("status", "approved")
        .order("is_online", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const timeline = useQuery({
    queryKey: ["admin-order-timeline", selectedId],
    enabled: Boolean(selectedId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("order_status_history")
        .select("id,status,changed_at,note")
        .eq("order_id", selectedId!)
        .order("changed_at", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (orders.data ?? []).filter((o) => {
      if (statusFilter !== "all" && o.status !== statusFilter) return false;
      if (!q) return true;
      return (
        o.id.toLowerCase().includes(q) ||
        o.payment_reference.toLowerCase().includes(q) ||
        (o.merchants?.business_name ?? "").toLowerCase().includes(q) ||
        (o.profiles?.full_name ?? "").toLowerCase().includes(q) ||
        (o.profiles?.email ?? "").toLowerCase().includes(q)
      );
    });
  }, [orders.data, query, statusFilter]);

  const selected = (orders.data ?? []).find((o) => o.id === selectedId) ?? null;

  async function forceAssign(orderId: string, riderId: string) {
    const { error } = await supabase
      .from("orders")
      .update({ rider_id: riderId, status: "rider_assigned" })
      .eq("id", orderId);
    if (error) {
      toast.error("Could not assign rider", { description: error.message });
      return;
    }
    await logAdminAction("force_assign_rider", "orders", orderId, { rider_id: riderId });
    toast.success("Rider assigned");
    queryClient.invalidateQueries({ queryKey: ["admin-orders-list"] });
  }

  async function cancelOrder(orderId: string) {
    const reason = window.prompt("Reason for cancelling this order?");
    if (reason === null) return;
    const { error } = await supabase
      .from("orders")
      .update({
        status: "cancelled",
        cancelled_at: new Date().toISOString(),
        cancel_reason: reason || "Cancelled by admin",
      })
      .eq("id", orderId);
    if (error) {
      toast.error("Could not cancel order", { description: error.message });
      return;
    }
    await logAdminAction("cancel_order", "orders", orderId, { reason });
    toast.success("Order cancelled");
    queryClient.invalidateQueries({ queryKey: ["admin-orders-list"] });
  }

  async function refundOrder(orderId: string) {
    if (!window.confirm("Mark this order as refunded? This only records the refund — issue the actual Paystack refund separately.")) return;
    const { error } = await supabase.from("orders").update({ status: "refunded" }).eq("id", orderId);
    if (error) {
      toast.error("Could not mark as refunded", { description: error.message });
      return;
    }
    await supabase.from("payments").update({ status: "refunded" }).eq("order_id", orderId);
    await logAdminAction("refund_order", "orders", orderId, {});
    toast.success("Order marked as refunded");
    queryClient.invalidateQueries({ queryKey: ["admin-orders-list"] });
  }

  async function logAdminAction(actionType: string, targetTable: string, targetId: string, details: Record<string, unknown>) {
    const { data } = await supabase.auth.getUser();
    if (!data.user) return;
    await supabase.from("admin_actions").insert({
      admin_id: data.user.id,
      action_type: actionType,
      target_table: targetTable,
      target_id: targetId,
      details: details as never,
    });
  }

  function downloadInvoice(order: OrderRow) {
    const lines = [
      `Zentra order invoice`,
      `Order: ${order.id}`,
      `Reference: ${order.payment_reference}`,
      `Placed: ${order.placed_at ? new Date(order.placed_at).toLocaleString("en-NG") : "-"}`,
      `Store: ${order.merchants?.business_name ?? "-"}`,
      `Customer: ${order.profiles?.full_name ?? order.profiles?.email ?? "-"}`,
      ``,
      `Subtotal: ${naira(order.subtotal_kobo)}`,
      `Delivery fee: ${naira(order.delivery_fee_kobo)}`,
      `Service fee: ${naira(order.service_fee_kobo)}`,
      `Total: ${naira(order.total_kobo)}`,
      `Status: ${statusLabel(order.status)}`,
    ].join("\n");
    const blob = new Blob([lines], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `zentra-order-${order.id.slice(0, 8)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (!ready) return null;

  return (
    <AdminLayout title="Orders" subtitle={`${filtered.length} of ${orders.data?.length ?? 0} orders`}>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative">
          <Search className="pointer-events-none absolute inset-y-0 left-3 my-auto size-4 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search order ID, reference, store or customer…"
            className="w-80 rounded-lg border border-border bg-card py-2 pl-9 pr-3 text-sm outline-none ring-primary/20 focus:ring-2"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {STATUS_FILTERS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatusFilter(s)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold capitalize transition-colors ${
                statusFilter === s
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-muted-foreground hover:bg-secondary/70"
              }`}
            >
              {s === "all" ? "All" : statusLabel(s)}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Order</TableHead>
              <TableHead>Store</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Placed</TableHead>
              <TableHead className="text-right">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders.isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                  Loading orders…
                </TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                  No orders match this search.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((o) => (
                <TableRow
                  key={o.id}
                  onClick={() => setSelectedId(o.id)}
                  className="cursor-pointer hover:bg-secondary/50"
                >
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {o.id.slice(0, 8)}
                  </TableCell>
                  <TableCell className="font-medium">{o.merchants?.business_name ?? "Store"}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {o.profiles?.full_name ?? o.profiles?.email ?? "Customer"}
                  </TableCell>
                  <TableCell>
                    <AdminStatusBadge status={o.status} label={statusLabel(o.status)} />
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {o.placed_at ? new Date(o.placed_at).toLocaleDateString("en-NG") : "-"}
                  </TableCell>
                  <TableCell className="text-right font-display font-semibold">{naira(o.total_kobo)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {selected ? (
        <div className="fixed inset-0 z-50 flex justify-end bg-foreground/20" onClick={() => setSelectedId(null)}>
          <div
            className="flex h-full w-full max-w-md flex-col overflow-y-auto bg-card p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-start justify-between">
              <div>
                <p className="text-xs font-mono text-muted-foreground">{selected.id}</p>
                <p className="mt-1 font-display text-lg font-bold">{selected.merchants?.business_name}</p>
              </div>
              <button type="button" onClick={() => setSelectedId(null)} className="text-muted-foreground">
                <X className="size-5" />
              </button>
            </div>

            <AdminStatusBadge status={selected.status} label={statusLabel(selected.status)} />
            {selected.cancel_reason ? (
              <p className="mt-2 text-xs text-destructive">Reason: {selected.cancel_reason}</p>
            ) : null}

            {(selected.addresses?.formatted || selected.merchants?.address_text) && (
              <div className="mt-4 space-y-1.5 rounded-lg border border-border p-3 text-sm">
                {selected.merchants?.address_text && (
                  <div className="flex items-start gap-2">
                    <span className="mt-0.5 size-1.5 shrink-0 rounded-full bg-primary" />
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground">Pickup — {selected.merchants.business_name}</p>
                      <p className="text-sm">{selected.merchants.address_text}</p>
                    </div>
                  </div>
                )}
                {selected.addresses?.formatted && (
                  <div className="flex items-start gap-2">
                    <span className="mt-0.5 size-1.5 shrink-0 rounded-full bg-info" />
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground">Delivery address</p>
                      <p className="text-sm">{selected.addresses.formatted}</p>
                      {selected.addresses.landmark && (
                        <p className="text-xs text-muted-foreground">Landmark: {selected.addresses.landmark}</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="mt-5 space-y-1 rounded-lg border border-border p-3 text-sm">
              <Row label="Subtotal" value={naira(selected.subtotal_kobo)} />
              <Row label="Delivery fee" value={naira(selected.delivery_fee_kobo)} />
              <Row label="Service fee" value={naira(selected.service_fee_kobo)} />
              <Row label="Total" value={naira(selected.total_kobo)} bold />
              <Row label="Reference" value={selected.payment_reference} mono />
            </div>

            <p className="mt-5 text-xs font-bold uppercase tracking-wide text-muted-foreground">Timeline</p>
            <div className="mt-2 space-y-3">
              {(timeline.data ?? []).length === 0 ? (
                <p className="text-xs text-muted-foreground">No status history recorded yet.</p>
              ) : (
                (timeline.data ?? []).map((t) => (
                  <div key={t.id} className="flex items-start gap-3 text-sm">
                    <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />
                    <div className="min-w-0">
                      <p className="font-medium">{STATUS_COPY[t.status]?.label ?? t.status}</p>
                      <p className="text-xs text-muted-foreground">
                        {t.changed_at ? new Date(t.changed_at).toLocaleString("en-NG") : ""}
                      </p>
                      {t.note ? <p className="text-xs text-muted-foreground">{t.note}</p> : null}
                    </div>
                  </div>
                ))
              )}
            </div>

            <p className="mt-6 text-xs font-bold uppercase tracking-wide text-muted-foreground">
              Dispatch map
            </p>
            {selected.merchants?.lat != null && selected.merchants?.lng != null ? (
              <div className="mt-2">
                <LeafletMap
                  center={[selected.merchants.lat, selected.merchants.lng]}
                  zoom={13}
                  className="h-56 w-full"
                >
                  <Marker position={[selected.merchants.lat, selected.merchants.lng]} icon={merchantIcon}>
                    <Popup>
                      <span className="font-medium">{selected.merchants.business_name}</span>
                      {selected.merchants.address_text && (
                        <span className="block text-xs text-muted-foreground">{selected.merchants.address_text}</span>
                      )}
                    </Popup>
                  </Marker>
                  {selected.addresses?.lat != null && selected.addresses?.lng != null && (
                    <Marker position={[selected.addresses.lat, selected.addresses.lng]} icon={customerIcon}>
                      <Popup>
                        <span className="font-medium">{selected.addresses.formatted ?? "Delivery address"}</span>
                        {selected.addresses.landmark && (
                          <span className="block text-xs text-muted-foreground">Landmark: {selected.addresses.landmark}</span>
                        )}
                      </Popup>
                    </Marker>
                  )}
                  {(riders.data ?? [])
                    .filter((r) => r.is_online && r.current_lat != null && r.current_lng != null)
                    .map((r) => (
                      <Marker key={r.id} position={[r.current_lat!, r.current_lng!]} icon={riderIcon}>
                        <Popup>
                          {r.vehicle_make ?? "Rider"} {r.plate_number ?? ""}
                        </Popup>
                      </Marker>
                    ))}
                </LeafletMap>
                <p className="mt-1.5 text-[11px] text-muted-foreground">
                  Amber = store, teal = delivery address, pulsing dots = online riders.
                </p>
              </div>
            ) : (
              <p className="mt-2 text-xs text-muted-foreground">Store location not set — map unavailable.</p>
            )}

            <p className="mt-6 text-xs font-bold uppercase tracking-wide text-muted-foreground">
              Force assign rider
            </p>
            <select
              defaultValue=""
              onChange={(e) => e.target.value && forceAssign(selected.id, e.target.value)}
              className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            >
              <option value="">Choose a rider…</option>
              {(riders.data ?? []).map((r) => (
                <option key={r.id} value={r.id}>
                  {r.vehicle_make ?? "Rider"} {r.plate_number ?? ""} {r.is_online ? "· online" : ""}
                </option>
              ))}
            </select>

            <div className="mt-6 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => downloadInvoice(selected)}
                className="flex items-center justify-center gap-1.5 rounded-lg border border-border py-2.5 text-xs font-bold"
              >
                <Download className="size-3.5" />
                Invoice
              </button>
              <button
                type="button"
                onClick={() => refundOrder(selected.id)}
                className="rounded-lg border border-info py-2.5 text-xs font-bold text-info"
              >
                Mark refunded
              </button>
              <button
                type="button"
                onClick={() => cancelOrder(selected.id)}
                disabled={["delivered", "cancelled", "refunded"].includes(selected.status)}
                className="col-span-2 rounded-lg border border-destructive py-2.5 text-xs font-bold text-destructive disabled:opacity-40"
              >
                Cancel order
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </AdminLayout>
  );
}

function Row({ label, value, bold, mono }: { label: string; value: string; bold?: boolean; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className={`${bold ? "font-display font-bold" : ""} ${mono ? "font-mono text-xs" : ""}`}>{value}</span>
    </div>
  );
}
