import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Search, X, FileText } from "lucide-react";
import { AdminLayout } from "@/components/admin/admin-layout";
import { AdminStatusBadge } from "@/components/admin/admin-status-badge";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { useRoleGuard } from "@/hooks/use-role-guard";
import { categoryLabel } from "@/lib/categories";
import {
  listMerchantApplications,
  getMerchantApplicationDetail,
  approveMerchantApplication,
  rejectMerchantApplication,
} from "@/lib/merchant-application-admin.functions";

export const Route = createFileRoute("/admin/merchant-applications")({
  head: () => ({
    meta: [
      { title: "Merchant applications — Zentra Admin" },
      { name: "description", content: "Review and decide on incoming merchant applications." },
    ],
  }),
  component: MerchantApplicationsPage,
});

const STATUS_FILTERS = ["submitted", "approved", "rejected", "draft", "all"] as const;

function MerchantApplicationsPage() {
  const { ready } = useRoleGuard("admin");
  const queryClient = useQueryClient();
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<(typeof STATUS_FILTERS)[number]>("submitted");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const applications = useQuery({
    queryKey: ["admin-merchant-applications", statusFilter],
    enabled: ready,
    queryFn: () => listMerchantApplications({ data: { status: statusFilter } }),
  });

  const detail = useQuery({
    queryKey: ["admin-merchant-application-detail", selectedId],
    enabled: Boolean(selectedId),
    queryFn: () => getMerchantApplicationDetail({ data: { applicationId: selectedId! } }),
  });

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return applications.data ?? [];
    return (applications.data ?? []).filter((a) =>
      [a.business_name, a.email, a.phone, a.lga].some((v) => (v ?? "").toLowerCase().includes(q)),
    );
  }, [applications.data, query]);

  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: ["admin-merchant-applications"] });
    if (selectedId) await queryClient.invalidateQueries({ queryKey: ["admin-merchant-application-detail", selectedId] });
  }

  async function approve(id: string) {
    setBusy(true);
    try {
      await approveMerchantApplication({ data: { applicationId: id } });
      toast.success("Application approved", { description: "The merchant account has been created and invited by email." });
      setSelectedId(null);
      await refresh();
    } catch (err) {
      toast.error("Could not approve", { description: err instanceof Error ? err.message : undefined });
    } finally {
      setBusy(false);
    }
  }

  async function reject(id: string) {
    const reason = window.prompt("Reason for rejecting this application?");
    if (!reason) return;
    setBusy(true);
    try {
      await rejectMerchantApplication({ data: { applicationId: id, reason } });
      toast.success("Application rejected");
      setSelectedId(null);
      await refresh();
    } catch (err) {
      toast.error("Could not reject", { description: err instanceof Error ? err.message : undefined });
    } finally {
      setBusy(false);
    }
  }

  if (!ready) return null;

  const selected = detail.data?.application;
  const signedUrls = detail.data?.signedUrls;

  return (
    <AdminLayout title="Merchant applications" subtitle={`${filtered.length} of ${applications.data?.length ?? 0} applications`}>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative">
          <Search className="pointer-events-none absolute inset-y-0 left-3 my-auto size-4 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search business name, email, phone, LGA…"
            className="w-80 rounded-lg border border-border bg-card py-2 pl-9 pr-3 text-sm outline-none ring-primary/20 focus:ring-2"
          />
        </div>
        <div className="flex gap-1.5">
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
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Business</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>LGA</TableHead>
              <TableHead>Submitted</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {applications.isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                  Loading applications…
                </TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                  No applications match this search.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((a) => (
                <TableRow key={a.id} className="hover:bg-secondary/50">
                  <TableCell onClick={() => setSelectedId(a.id)} className="cursor-pointer font-medium">
                    {a.business_name ?? a.email}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{a.category ? categoryLabel(a.category) : "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{a.phone ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{a.lga ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Date(a.updated_at ?? a.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <AdminStatusBadge status={a.status} />
                  </TableCell>
                  <TableCell className="text-right">
                    {a.status === "submitted" ? (
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => approve(a.id)}
                          className="rounded-lg bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground disabled:opacity-60"
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => reject(a.id)}
                          className="rounded-lg border border-border px-2.5 py-1 text-xs font-semibold disabled:opacity-60"
                        >
                          Reject
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setSelectedId(a.id)}
                        className="text-xs font-semibold text-primary"
                      >
                        View
                      </button>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {selectedId ? (
        <div className="fixed inset-0 z-50 flex items-center justify-end bg-black/40" onClick={() => setSelectedId(null)}>
          <div
            className="h-full w-full max-w-md overflow-y-auto bg-card p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <p className="font-display text-lg font-extrabold">Application detail</p>
              <button type="button" onClick={() => setSelectedId(null)} aria-label="Close">
                <X className="size-5 text-muted-foreground" />
              </button>
            </div>

            {detail.isLoading || !selected ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : (
              <div className="space-y-5 text-sm">
                <div className="flex items-center justify-between">
                  <AdminStatusBadge status={selected.status} />
                  {selected.status === "rejected" && selected.rejection_reason ? (
                    <span className="text-xs text-destructive">Reason: {selected.rejection_reason}</span>
                  ) : null}
                </div>

                <DetailSection title="Business">
                  <DetailRow label="Business name" value={selected.business_name} />
                  <DetailRow label="Category" value={selected.category ? categoryLabel(selected.category) : null} />
                  <DetailRow label="Description" value={selected.business_description} />
                  <DetailRow label="Email" value={selected.email} />
                  <DetailRow label="Phone" value={selected.phone} />
                  <DetailRow label="Address" value={selected.address_text} />
                  <DetailRow label="LGA" value={selected.lga} />
                </DetailSection>

                <DetailSection title="Settlement">
                  <DetailRow label="Bank" value={selected.bank_name} />
                  <DetailRow label="Account number" value={selected.account_number} />
                  <DetailRow label="Account name" value={selected.account_name} />
                </DetailSection>

                <DetailSection title="Operations">
                  <DetailRow label="Opening time" value={selected.opening_time} />
                  <DetailRow label="Closing time" value={selected.closing_time} />
                  <DetailRow label="Prep time" value={selected.prep_time_mins ? `${selected.prep_time_mins} mins` : null} />
                  <DetailRow label="Self delivery" value={selected.self_delivery === null ? null : selected.self_delivery ? "Yes" : "No"} />
                  <DetailRow label="POS available" value={selected.pos_available === null ? null : selected.pos_available ? "Yes" : "No"} />
                  <DetailRow label="Commission agreed" value={selected.commission_agreement_accepted ? "Yes" : "No"} />
                </DetailSection>

                <DetailSection title="Verification">
                  <DetailRow label="TIN" value={selected.tin} />
                  <DetailRow label="Referral source" value={selected.referral_source} />
                  <DetailRow label="Signed as" value={selected.agreement_signature_name} />
                </DetailSection>

                <DetailSection title="Documents">
                  <DocLink label="Store photo / logo" url={signedUrls?.cover_photo_url} />
                  <DocLink label="Owner ID" url={signedUrls?.owner_id_doc_url} />
                  <DocLink label="CAC document" url={signedUrls?.cac_doc_url} />
                </DetailSection>

                {selected.status === "submitted" ? (
                  <div className="flex gap-2 pt-2">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => approve(selected.id)}
                      className="flex-1 rounded-lg bg-primary py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-60"
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => reject(selected.id)}
                      className="flex-1 rounded-lg border border-border py-2.5 text-sm font-bold disabled:opacity-60"
                    >
                      Reject
                    </button>
                  </div>
                ) : null}
              </div>
            )}
          </div>
        </div>
      ) : null}
    </AdminLayout>
  );
}

function DetailSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{title}</p>
      <div className="mt-2 space-y-1.5 rounded-lg border border-border bg-secondary/30 p-3">{children}</div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value || "—"}</span>
    </div>
  );
}

function DocLink({ label, url }: { label: string; url: string | null | undefined }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="flex items-center gap-1.5 text-muted-foreground">
        <FileText className="size-3.5" />
        {label}
      </span>
      {url ? (
        <a href={url} target="_blank" rel="noreferrer" className="font-semibold text-primary">
          View
        </a>
      ) : (
        <span className="text-muted-foreground">Not uploaded</span>
      )}
    </div>
  );
}
