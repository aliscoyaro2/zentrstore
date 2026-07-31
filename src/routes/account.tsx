import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Store, Bike, ShieldCheck, LogOut, User } from "lucide-react";
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

  // 1. Fetch user profile (role, name, etc.)
  const profile = useQuery({
    queryKey: ["profile", user?.id],
    enabled: Boolean(user),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, role, full_name, phone, email")
        .eq("id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  // 2. Fetch merchant application status (if any)
  const merchantApp = useQuery({
    queryKey: ["merchantApp", user?.id],
    enabled: Boolean(user),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("merchants")
        .select("status")
        .eq("owner_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  // 3. Fetch rider application status (if any)
  const riderApp = useQuery({
    queryKey: ["riderApp", user?.id],
    enabled: Boolean(user),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("riders")
        .select("status")
        .eq("id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const role = profile.data?.role || "customer";
  const merchantStatus = merchantApp.data?.status || null;
  const riderStatus = riderApp.data?.status || null;

  // Handle sign out
  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/" });
  };

  // If not signed in, show login prompt
  if (!user && !loading) {
    return (
      <Screen>
        <PageHeader title="Your profile" subtitle="Sign in to manage your account" />
        <div className="px-4 py-6">
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
        </div>
      </Screen>
    );
  }

  return (
    <Screen>
      <PageHeader title="Your profile" subtitle={user?.email ?? "Account"} />
      <div className="space-y-4 px-4 py-6">
        {/* Profile summary */}
        <Panel className="p-5">
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Signed in as
          </p>
          <p className="mt-1 font-display text-lg font-extrabold">
            {profile.data?.full_name ?? user?.email}
          </p>
          <p className="text-xs capitalize text-muted-foreground">
            {role} account
          </p>
        </Panel>

        {/* Role-based tiles */}
        <div className="space-y-3">
          {/* CUSTOMER: show "Register a store" and "Apply to ride" */}
          {role === "customer" && (
            <>
              <Tile
                to="/merchant/apply"
                icon={<Store className="size-5 text-primary" />}
                title="Register a store"
                body="Restaurants, home kitchens, pharmacies and more"
              />
              <Tile
                to="/rider/apply"
                icon={<Bike className="size-5 text-primary" />}
                title="Apply to ride"
                body="Deliver with your own motorcycle"
              />
            </>
          )}

          {/* MERCHANT: show "Merchant dashboard" and optionally "Apply to ride" */}
          {role === "merchant" && (
            <>
              <Tile
                to="/merchant"
                icon={<Store className="size-5 text-primary" />}
                title="Merchant dashboard"
                body="Orders, products and store info"
              />
              <Tile
                to="/rider/apply"
                icon={<Bike className="size-5 text-primary" />}
                title="Apply to ride"
                body="Deliver with your own motorcycle"
              />
            </>
          )}

          {/* RIDER: show "Rider dashboard" and optionally "Register a store" */}
          {role === "rider" && (
            <>
              <Tile
                to="/rider"
                icon={<Bike className="size-5 text-primary" />}
                title="Rider dashboard"
                body="Your delivery jobs and status updates"
              />
              <Tile
                to="/merchant/apply"
                icon={<Store className="size-5 text-primary" />}
                title="Register a store"
                body="Become a merchant too"
              />
            </>
          )}

          {/* ADMIN: show all tiles */}
          {role === "admin" && (
            <>
              <Tile
                to="/admin"
                icon={<ShieldCheck className="size-5 text-primary" />}
                title="Admin panel"
                body="Approvals, dispatch and financials"
              />
              <Tile
                to="/merchant"
                icon={<Store className="size-5 text-primary" />}
                title="Merchant dashboard"
                body="Orders, products and store info"
              />
              <Tile
                to="/rider"
                icon={<Bike className="size-5 text-primary" />}
                title="Rider dashboard"
                body="Your delivery jobs and status updates"
              />
            </>
          )}
        </div>

        {/* Application status messages */}
        {merchantStatus === "pending" && (
          <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-700">
            ⏳ Your merchant application is pending admin approval.
          </div>
        )}
        {riderStatus === "pending" && (
          <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-700">
            ⏳ Your rider application is pending admin approval.
          </div>
        )}

        {/* Sign out button */}
        {user && (
          <button
            type="button"
            onClick={handleSignOut}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-card py-3 text-sm font-bold text-muted-foreground hover:bg-muted/50 transition"
          >
            <LogOut className="size-4" /> Sign out
          </button>
        )}
      </div>

      {/* Bottom navigation (consistent with other pages) */}
      <div className="fixed bottom-0 left-0 right-0 border-t border-border bg-card py-2 px-4 flex justify-around max-w-md mx-auto">
        <Link to="/" className="text-center text-sm text-muted-foreground hover:text-primary transition">
          Explore
        </Link>
        <Link to="/orders" className="text-center text-sm text-muted-foreground hover:text-primary transition">
          Orders
        </Link>
        <Link to="/cart" className="text-center text-sm text-muted-foreground hover:text-primary transition">
          Cart
        </Link>
        <Link to="/account" className="text-center text-sm text-primary font-medium">
          Profile
        </Link>
      </div>
    </Screen>
  );
}

// Tile component – now accepts any valid route string
function Tile({
  to,
  icon,
  title,
  body,
}: {
  to: string; // more flexible than union type
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <Link
      to={to}
      className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 shadow-card hover:shadow-md transition"
    >
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10">
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-bold leading-tight">{title}</span>
        <span className="block text-xs text-muted-foreground">{body}</span>
      </span>
    </Link>
  );
}