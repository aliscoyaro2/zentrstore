import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Screen } from "@/components/zentra/shell";
import { useSession } from "@/hooks/use-session";
import { getSiteUrl } from "@/lib/site-url";
import { roleHome } from "@/lib/roles";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Sign in to Zentra" },
      {
        name: "description",
        content: "Sign in to order, sell, or ride on Zentra Maiduguri.",
      },
      { property: "og:title", content: "Sign in to Zentra" },
      { property: "og:description", content: "Sign in to Zentra Maiduguri." },
    ],
  }),
  component: LoginPage,
});

// Modes:
// "signin"       – email + password (the only way in)
// "forgot"       – enter email, request a reset link
// "forgot-sent"  – confirmation that the reset email is on its way
type Mode = "signin" | "forgot" | "forgot-sent";

// Right after a fresh sign-in, useSession's cached role hasn't updated yet,
// so look the profile up directly to decide where this account belongs.
async function resolveHome(userId: string | undefined): Promise<string> {
  if (!userId) return "/";
  const { data } = await supabase.from("profiles").select("role").eq("id", userId).maybeSingle();
  return roleHome(data?.role ?? "customer");
}

function LoginPage() {
  const navigate = useNavigate();
  const { user, loading, role, roleLoading } = useSession();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Already signed in — send them to their own account's home, not
  // necessarily the customer app.
  useEffect(() => {
    if (!loading && user && !roleLoading) navigate({ to: roleHome(role) });
  }, [loading, user, roleLoading, role, navigate]);

  // ── Sign in with email + password ──
  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { data, error: err } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setBusy(false);
    if (err) {
      setError(err.message);
      return;
    }
    navigate({ to: await resolveHome(data.user?.id) });
  }

  // ── Forgot password — reuses the same set-password page as the invite flow ──
  async function sendResetLink(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${getSiteUrl()}/auth/set-password`,
    });
    setBusy(false);
    if (err) {
      setError(err.message);
      return;
    }
    setMode("forgot-sent");
    toast.success("Reset link sent", { description: `Check ${email} for a link to set a new password.` });
  }

  // While we check for an existing session, or once redirecting, show nothing.
  if (loading || user) return null;

  const heading = mode === "signin" ? "Welcome back" : "Reset your password";
  const subheading =
    mode === "signin"
      ? "Sign in with your email and password."
      : mode === "forgot"
        ? "We'll email you a link to set a new password."
        : `Check ${email} for a link to set a new password.`;

  return (
    <Screen nav={false}>
      <div className="flex min-h-screen flex-col px-6 pb-10 pt-16">
        <div className="mb-10">
          <span className="inline-block rounded-lg bg-primary px-3 py-1 font-display text-lg font-extrabold tracking-tight text-primary-foreground">
            Zentra
          </span>
          <h1 className="mt-6 text-3xl leading-tight">{heading}</h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{subheading}</p>
        </div>

        {/* ── Sign in with password ── */}
        {mode === "signin" && (
          <form onSubmit={signIn} className="space-y-4">
            <label className="block">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Email address
              </span>
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="mt-2 w-full rounded-xl border border-border bg-card px-4 py-3 text-base outline-none ring-primary/20 focus:ring-2"
              />
            </label>
            <label className="block">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Password
              </span>
              <input
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="mt-2 w-full rounded-xl border border-border bg-card px-4 py-3 text-base outline-none ring-primary/20 focus:ring-2"
              />
            </label>
            {error ? <p className="text-sm font-medium text-destructive">{error}</p> : null}
            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-xl bg-primary py-3.5 font-bold text-primary-foreground disabled:opacity-60"
            >
              {busy ? "Signing in..." : "Sign in"}
            </button>
            <div className="flex items-center justify-between pt-1 text-sm">
              <Link to="/register" className="font-semibold text-primary">
                Create an account
              </Link>
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setMode("forgot");
                }}
                className="text-muted-foreground underline"
              >
                Forgot password?
              </button>
            </div>
          </form>
        )}

        {/* ── Forgot password: request a reset link ── */}
        {mode === "forgot" && (
          <form onSubmit={sendResetLink} className="space-y-4">
            <label className="block">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Email address
              </span>
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="mt-2 w-full rounded-xl border border-border bg-card px-4 py-3 text-base outline-none ring-primary/20 focus:ring-2"
              />
            </label>
            {error ? <p className="text-sm font-medium text-destructive">{error}</p> : null}
            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-xl bg-primary py-3.5 font-bold text-primary-foreground disabled:opacity-60"
            >
              {busy ? "Sending..." : "Send reset link"}
            </button>
            <button
              type="button"
              onClick={() => {
                setError(null);
                setMode("signin");
              }}
              className="w-full py-2 text-sm font-semibold text-primary"
            >
              Back to sign in
            </button>
          </form>
        )}

        {/* ── Reset link sent ── */}
        {mode === "forgot-sent" && (
          <button
            type="button"
            onClick={() => setMode("signin")}
            className="w-full rounded-xl border border-border bg-card py-3.5 font-bold"
          >
            Back to sign in
          </button>
        )}
      </div>
    </Screen>
  );
}
