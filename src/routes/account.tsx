import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Store, Bike, ShieldCheck, LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Screen, PageHeader, Panel } from "@/components/zentra/shell";
import { useSession } from "@/hooks/use-session";

export const Route = createFileRoute("/account")({
  head: () => ({
    meta: [
      { title: "Your Zentra profile" },
      {
        name: "description",
        content: "Manage your Zentra account and switch between customer, merchant and rider tools.",
      },
      { property: "og:title", content: "Your Zentra profile" },
      { property: "og:description", content: "Customer, merchant and rider access in one place." },
    ],
  }),
  component: AccountPage,
});

function AccountPage() {
  const { user, loading } = useSession();
  const navigate = useNavigate();

  const profile = useQuery({
    queryKey: ["profile", user?.id],
    enabled: Boolean(user),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id,role,full_name,phone,email")
        .eq("id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  return (
    <Screen>
      <PageHeader title="Your profile" subtitle={user?.email ?? "Not signed in"} />
      <div className="space-y-4 px-4 py-6">
        {!user && !loading ? (
          <Panel className="p-5 text-center">
            <p className="font-display text-lg font-extrabold">Sign in to order</p>
            <p className="mt-1 text-sm text-muted-foreground">
              One-time code, no password needed.
            </p>
            <Link
              to="/login"
              className="mt-4 inline-block w-full rounded-xl bg-primary py-3 font-bold text-primary-foreground"
            >
              Sign in
            </Link>
          </Panel>
        ) : (
          <Panel className="p-5">
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Signed in as
            </p>
            <p className="mt-1 font-display text-lg font-extrabold">
              {profile.data?.full_name ?? user?.email}
            </p>
            <p className="text-xs capitalize text-muted-foreground">
              {profile.data?.role ?? "customer"} account
            </p>
          </Panel>
        )}

        <div className="space-y-3">
          <Tile to="/merchant" icon={<Store className="size-5 text-primary" />} title="Merchant dashboard" body="Orders, products and store info" />
          <Tile to="/merchant/apply" icon={<Store className="size-5 text-primary" />} title="Register a store" body="Restaurants, home kitchens, pharmacies and more" />
          <Tile to="/rider" icon={<Bike className="size-5 text-primary" />} title="Rider dashboard" body="Your delivery jobs and status updates" />
          <Tile to="/rider/apply" icon={<Bike className="size-5 text-primary" />} title="Apply to ride" body="Deliver with your own motorcycle" />
          <Tile to="/admin" icon={<ShieldCheck className="size-5 text-primary" />} title="Admin panel" body="Approvals, dispatch and financials" />
        </div>

        {user ? (
          <button
            type="button"
            onClick={async () => {
              await supabase.auth.signOut();
              navigate({ to: "/" });
            }}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-card py-3 text-sm font-bold text-muted-foreground"
          >
            <LogOut className="size-4" /> Sign out
          </button>
        ) : null}
      </div>
    </Screen>
  );
}

function Tile({
  to,
  icon,
  title,
  body,
}: {
  to: "/merchant" | "/merchant/apply" | "/rider" | "/rider/apply" | "/admin";
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <Link to={to} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 shadow-card">
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10">{icon}</span>
      <span className="min-w-0">
        <span className="block text-sm font-bold leading-tight">{title}</span>
        <span className="block text-xs text-muted-foreground">{body}</span>
      </span>
    </Link>
  );
}
