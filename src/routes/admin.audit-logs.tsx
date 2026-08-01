import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Search, ScrollText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "@/components/admin/admin-layout";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { useRoleGuard } from "@/hooks/use-role-guard";

export const Route = createFileRoute("/admin/audit-logs")({
  head: () => ({
    meta: [
      { title: "Audit Logs — Zentra Admin" },
      { name: "description", content: "Every admin action on Zentra, in order." },
    ],
  }),
  component: AuditLogsPage,
});

type ActionRow = {
  id: string;
  action_type: string;
  target_table: string | null;
  target_id: string | null;
  details: Record<string, unknown> | null;
  created_at: string | null;
  admin_id: string | null;
  profiles: { full_name: string | null; email: string | null } | null;
};

function actionLabel(actionType: string) {
  return actionType.replaceAll("_", " ");
}

function AuditLogsPage() {
  const { ready } = useRoleGuard("admin");
  const [query, setQuery] = useState("");
  const [actionFilter, setActionFilter] = useState("all");

  const logs = useQuery({
    queryKey: ["admin-audit-logs"],
    enabled: ready,
    refetchInterval: 30000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("admin_actions")
        .select("id,action_type,target_table,target_id,details,created_at,admin_id,profiles:admin_id(full_name,email)")
        .order("created_at", { ascending: false })
        .limit(300);
      if (error) throw error;
      return (data ?? []) as unknown as ActionRow[];
    },
  });

  const actionTypes = useMemo(() => {
    const set = new Set((logs.data ?? []).map((l) => l.action_type));
    return ["all", ...[...set].sort()];
  }, [logs.data]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (logs.data ?? []).filter((l) => {
      if (actionFilter !== "all" && l.action_type !== actionFilter) return false;
      if (!q) return true;
      return (
        l.action_type.toLowerCase().includes(q) ||
        (l.target_table ?? "").toLowerCase().includes(q) ||
        (l.target_id ?? "").toLowerCase().includes(q) ||
        (l.profiles?.full_name ?? "").toLowerCase().includes(q) ||
        (l.profiles?.email ?? "").toLowerCase().includes(q)
      );
    });
  }, [logs.data, query, actionFilter]);

  if (!ready) return null;

  return (
    <AdminLayout title="Audit Logs" subtitle={`${filtered.length} of ${logs.data?.length ?? 0} actions`}>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative">
          <Search className="pointer-events-none absolute inset-y-0 left-3 my-auto size-4 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search action, table, ID or admin…"
            className="w-80 rounded-lg border border-border bg-card py-2 pl-9 pr-3 text-sm outline-none ring-primary/20 focus:ring-2"
          />
        </div>
        <select
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
          className="rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none ring-primary/20 focus:ring-2"
        >
          {actionTypes.map((a) => (
            <option key={a} value={a}>
              {a === "all" ? "All actions" : actionLabel(a)}
            </option>
          ))}
        </select>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Admin</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Target</TableHead>
              <TableHead>Details</TableHead>
              <TableHead className="text-right">When</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {logs.isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                  Loading audit log…
                </TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-16 text-center text-sm text-muted-foreground">
                  <div className="flex flex-col items-center gap-2">
                    <ScrollText className="size-6 text-muted-foreground/50" />
                    {logs.data?.length === 0
                      ? "No admin actions recorded yet — actions taken on Orders, Merchants, Riders etc. will show up here."
                      : "No actions match this search."}
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((l) => (
                <TableRow key={l.id}>
                  <TableCell className="font-medium">
                    {l.profiles?.full_name ?? l.profiles?.email ?? "Unknown admin"}
                  </TableCell>
                  <TableCell className="capitalize">{actionLabel(l.action_type)}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {l.target_table ? (
                      <span className="font-mono text-xs">
                        {l.target_table}
                        {l.target_id ? ` · ${l.target_id.slice(0, 8)}` : ""}
                      </span>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell className="max-w-xs truncate text-xs text-muted-foreground">
                    {l.details && Object.keys(l.details).length > 0 ? JSON.stringify(l.details) : "—"}
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {l.created_at ? new Date(l.created_at).toLocaleString("en-NG") : "-"}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </AdminLayout>
  );
}
