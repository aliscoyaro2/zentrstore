import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  User,
  MapPin,
  Package,
  Store,
  Bike,
  Headphones,
  Settings as SettingsIcon,
  Info,
  LogOut,
  ChevronRight,
  BadgeCheck,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Screen, PageHeader, Panel } from "@/components/zentra/shell";
import { useSession } from "@/hooks/use-session";

export const Route = createFileRoute("/customer/account")({
  head: () => ({
    meta: [
      { title: "Your Zentra profile" },
      {
        name: "description",
        content: "Manage your Zentra account and settings.",
      },
    ],
  }),
  component: AccountPage,
});

function AccountPage() {
  const { user, loading } = useSession();
  const navigate = useNavigate();

  // ── Profile ──
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

  // ── Merchant application status ──
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

  // ── Rider application status ──
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
  const fullName = profile.data?.full_name || user?.email || "User";
  const merchantStatus = merchantApp.data?.status || null;
  const riderStatus = riderApp.data?.status || null;

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/" });
  };

  // ── Not signed in ──
  if (!user && !loading) {
    return (
      <Screen>
        <PageHeader title="Your profile" subtitle="Sign in to manage your account" />
        <div className="px-4 py-6">
          <Panel className="p-5 text-center">
            <div className="w-20 h-20 bg-blue-100 rounded-full mx-auto mb-4 flex items-center justify-center">
              <User className="w-10 h-10 text-blue-600" />
            </div>
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
      <PageHeader title="Your profile" subtitle="Manage your account" />
      <div className="space-y-6 px-4 py-6 pb-24">
        {/* ── Profile Card ── */}
        <Panel className="p-5">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center text-2xl font-bold text-primary shrink-0">
              {fullName.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="font-display text-lg font-extrabold truncate">
                  {fullName}
                </p>
                <BadgeCheck className="w-5 h-5 text-blue-500 shrink-0" />
              </div>
              <p className="text-sm text-muted-foreground">
                {role.charAt(0).toUpperCase() + role.slice(1)}
              </p>
              <p className="text-xs text-muted-foreground/70 truncate">
                {user?.email}
              </p>
            </div>
            <Link
              to="/customer/account/edit"
              className="text-sm font-medium text-primary hover:underline shrink-0"
            >
              Edit Profile
            </Link>
          </div>
        </Panel>

        {/* ── Pending alerts ── */}
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

        {/* ── Main Menu ── */}
        <div className="space-y-1">
          <MenuItem to="/customer/addresses" icon={<MapPin className="size-5" />} label="My Addresses" />
          <MenuItem to="/customer/orders" icon={<Package className="size-5" />} label="My Orders" />
          {/* Payment Methods & Favorites skipped */}
        </div>

        {/* ── Business Section ── */}
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground px-1 mb-2">
            Business
          </p>
          <div className="space-y-1">
            {role === "customer" && (
              <>
                <MenuItem to="/merchant/apply" icon={<Store className="size-5" />} label="Register a Store" />
                <MenuItem to="/rider/apply" icon={<Bike className="size-5" />} label="Become a Rider" />
              </>
            )}
            {role === "merchant" && (
              <MenuItem to="/merchant" icon={<Store className="size-5" />} label="Merchant Dashboard" />
            )}
            {role === "rider" && (
              <MenuItem to="/rider" icon={<Bike className="size-5" />} label="Rider Dashboard" />
            )}
            {role === "admin" && (
              <MenuItem to="/admin" icon={<Store className="size-5" />} label="Admin Panel" />
            )}
          </div>
        </div>

        {/* ── Support Section ── */}
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground px-1 mb-2">
            Support
          </p>
          <div className="space-y-1">
            <MenuItem to="/help" icon={<Headphones className="size-5" />} label="Help Center" />
            <MenuItem to="/customer/settings" icon={<SettingsIcon className="size-5" />} label="Settings" />
            <MenuItem to="/about" icon={<Info className="size-5" />} label="About" />
          </div>
        </div>

        {/* ── Sign Out ── */}
        <button
          type="button"
          onClick={handleSignOut}
          className="flex w-full items-center justify-between rounded-xl border border-border bg-card px-4 py-3 text-sm font-medium text-red-600 hover:bg-red-50 transition"
        >
          <span className="flex items-center gap-3">
            <LogOut className="size-5" />
            Sign Out
          </span>
          <ChevronRight className="size-5 text-muted-foreground" />
        </button>
      </div>

      {/* ── Bottom Navigation ── */}
      <div className="fixed bottom-0 left-0 right-0 border-t border-border bg-card py-2 px-4 flex justify-around max-w-md mx-auto">
        <Link to="/" className="text-center text-sm text-muted-foreground hover:text-primary transition">
          Explore
        </Link>
        <Link to="/customer/orders" className="text-center text-sm text-muted-foreground hover:text-primary transition">
          Orders
        </Link>
        <Link to="/customer/cart" className="text-center text-sm text-muted-foreground hover:text-primary transition">
          Cart
        </Link>
        <Link to="/customer/account" className="text-center text-sm text-primary font-medium">
          Profile
        </Link>
      </div>
    </Screen>
  );
}

// ── Menu Item Component ──
function MenuItem({
  to,
  icon,
  label,
}: {
  to: string;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <Link
      to={to}
      className="flex w-full items-center justify-between rounded-xl border border-border bg-card px-4 py-3 text-sm font-medium hover:bg-muted/50 transition"
    >
      <span className="flex items-center gap-3">
        <span className="text-muted-foreground">{icon}</span>
        {label}
      </span>
      <ChevronRight className="size-5 text-muted-foreground" />
    </Link>
  );
}
