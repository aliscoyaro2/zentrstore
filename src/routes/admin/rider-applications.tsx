import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Search, X, FileText } from "lucide-react";
import { AdminLayout } from "@/components/admin/admin-layout";
import { AdminStatusBadge } from "@/components/admin/admin-status-badge";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { useRoleGuard } from "@/hooks/use-role-guard";
import {
  listRiderApplications,
  getRiderApplicationDetail,
  approveRiderApplication,
  rejectRiderApplication,
} from "@/lib/rider-application-admin.functions";

export const Route = createFileRoute("/admin/rider-applications")({
  head: () => ({
    meta: [
      { title: "Rider applications — Zentra Admin" },
      { name: "description", content: "Review and decide on incoming rider applications." },
    ],
  }),
  component: RiderApplicationsPage,
});

const STATUS_FILTERS = ["submitted", "approved", "rejected", "draft", "all"] as const;

function RiderApplicationsPage() {
  const { ready } = useRoleGuard("admin");
  const queryClient = useQueryClient();
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<(typeof STATUS_FILTERS)[number]>("submitted");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const applications = useQuery({
    queryKey: ["admin-rider-applications", statusFilter],
    enabled: ready,
    queryFn: () => listRiderApplications({ data: { status: statusFilter } }),
  });

  const detail = useQuery({
    queryKey: ["admin-rider-application-detail", selectedId],
    enabled: Boolean(selectedId),
    queryFn: () => getRiderApplicationDetail({ data: { applicationId: selectedId! } }),
  });

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return applications.data ?? [];
    return (applications.data ?? []).filter((a) =>
      [a.full_name, a.email, a.phone, a.plate_number, a.lga].some((v) => (v ?? "").toLowerCase().includes(q)),
    );
  }, [applications.data, query]);

  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: ["admin-rider-applications"] });
    if (selectedId) await queryClient.invalidateQueries({ queryKey: ["admin-rider-application-detail", selectedId] });
  }

  async function approve(id: string) {
    setBusy(true);
    try {
      await approveRiderApplication({ data: { applicationId: id } });
      toast.success("Application approved", { description: "The rider account has been created and invited by email." });
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
      await rejectRiderApplication({ data: { applicationId: id, reason } });
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
    <AdminLayout title="Rider applications" subtitle={`${filtered.length} of ${applications.data?.length ?? 0} applications`}>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative">
          <Search className="pointer-events-none absolute inset-y-0 left-3 my-auto size-4 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, email, plate number, LGA…"
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
              <TableHead>Applicant</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Vehicle</TableHead>
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
                    {a.full_name ?? a.email}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{a.phone ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {`${a.vehicle_type ?? ""} ${a.plate_number ?? ""}`.trim() || "—"}
                  </TableCell>
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

                <DetailSection title="Personal">
                  <DetailRow label="Full name" value={selected.full_name} />
                  <DetailRow label="Email" value={selected.email} />
                  <DetailRow label="Phone" value={selected.phone} />
                  <DetailRow label="Date of birth" value={selected.date_of_birth} />
                  <DetailRow label="Gender" value={selected.gender} />
                  <DetailRow label="Address" value={selected.residential_address} />
                  <DetailRow label="LGA" value={selected.lga} />
                </DetailSection>

                <DetailSection title="Vehicle">
                  <DetailRow label="Type" value={selected.vehicle_type} />
                  <DetailRow label="Plate number" value={selected.plate_number} />
                  <DetailRow label="License number" value={selected.drivers_license_number} />
                  <DetailRow label="Ownership" value={selected.vehicle_ownership} />
                  <DetailRow label="Experience" value={selected.years_riding_experience ? `${selected.years_riding_experience} years` : null} />
                </DetailSection>

                <DetailSection title="Banking & next of kin">
                  <DetailRow label="Bank" value={selected.bank_name} />
                  <DetailRow label="Account number" value={selected.account_number} />
                  <DetailRow label="Account name" value={selected.account_name} />
                  <DetailRow label="Next of kin" value={selected.next_of_kin_name} />
                  <DetailRow label="Next of kin phone" value={selected.next_of_kin_phone} />
                  <DetailRow label="Relationship" value={selected.next_of_kin_relationship} />
                </DetailSection>

                <DetailSection title="Background">
                  <DetailRow label="Prior experience" value={selected.previous_delivery_experience} />
                  <DetailRow label="Criminal record" value={selected.has_criminal_record ? "Yes" : "No"} />
                  {selected.has_criminal_record ? (
                    <DetailRow label="Details" value={selected.criminal_record_details} />
                  ) : null}
                  <DetailRow label="Referral source" value={selected.referral_source} />
                  <DetailRow label="Signed as" value={selected.agreement_signature_name} />
                </DetailSection>

                <DetailSection title="Documents">
                  <DocLink label="Passport photo" url={signedUrls?.['photo_url']} />
                  <DocLink label="License (front)" url={signedUrls?.['drivers_license_front_url']} />
                  <DocLink label="License (back)" url={signedUrls?.['drivers_license_back_url']} />
                  <DocLink label="Vehicle insurance" url={signedUrls?.['vehicle_insurance_url']} />
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
