import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Screen } from "@/components/zentra/shell";
import { useSession } from "@/hooks/use-session";
import { roleHome, type UserRole } from "@/lib/roles";

export const Route = createFileRoute("/register")({
  head: () => ({
    meta: [
      { title: "Create your Zentra account" },
      {
        name: "description",
        content: "Sign up with email and password to order, sell, or ride on Zentra Maiduguri.",
      },
      { property: "og:title", content: "Create your Zentra account" },
      { property: "og:description", content: "Join Zentra Maiduguri." },
    ],
  }),
  component: RegisterPage,
});

// "signup" – choose account type, enter email + password, triggers a one-time confirmation code
// "verify" – enter that code to confirm the new account
type Mode = "signup" | "verify";

const SIGNUP_ROLES: { value: UserRole; label: string; hint: string }[] = [
  { value: "customer", label: "Order stuff", hint: "Browse and order from local stores" },
  { value: "merchant", label: "Sell on Zentra", hint: "Run a restaurant, kitchen, shop or pharmacy" },
  { value: "rider", label: "Ride & deliver", hint: "Deliver orders on your own motorcycle" },
];

function RegisterPage() {
  const navigate = useNavigate();
  const { user, loading, role, roleLoading } = useSession();
  const [mode, setMode] = useState<Mode>("signup");
  const [accountRole, setAccountRole] = useState<UserRole>("customer");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Already signed in — nothing to register, send them to their own home.
  useEffect(() => {
    if (!loading && user && !roleLoading) navigate({ to: roleHome(role) });
  }, [loading, user, roleLoading, role, navigate]);

  async function upsertProfile(u: { id: string; email?: string | null }) {
    await supabase
      .from("profiles")
      .upsert({ id: u.id, email: u.email ?? null, role: accountRole }, { onConflict: "id" });
  }

  // ── New user: create account with password, triggers email verification code ──
  async function signUp(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { data, error: err } = await supabase.auth.signUp({
      email: email.trim(),
      password,
    });
    setBusy(false);
    if (err) {
      setError(err.message);
      return;
    }
    // Supabase returns a user object with no error even when the email is
    // already registered (to avoid leaking which emails exist). A real new
    // signup has identities on the user; an existing account comes back with
    // an empty identities array.
    if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
      setError("That email already has an account. Try signing in instead.");
      return;
    }
    setMode("verify");
    toast.success("Code sent", { description: `Check ${email} to confirm your account.` });
  }

  // ── Confirm the signup code — one time only, then the password works from here on ──
  async function verifySignup(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { data, error: err } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token: code.trim(),
      type: "email",
    });
    if (err) {
      setBusy(false);
      setError(err.message);
      return;
    }
    if (data.user) {
      await upsertProfile(data.user);
    }
    setBusy(false);
    if (accountRole === "merchant") {
      navigate({ to: "/merchant/apply" });
    } else if (accountRole === "rider") {
      navigate({ to: "/rider/apply" });
    } else {
      navigate({ to: "/" });
    }
  }

  // While we check for an existing session, or once redirecting, show nothing.
  if (loading || user) return null;

  return (
    <Screen nav={false}>
      <div className="flex min-h-screen flex-col px-6 pb-10 pt-16">
        <div className="mb-10">
          <span className="inline-block rounded-lg bg-primary px-3 py-1 font-display text-lg font-extrabold tracking-tight text-primary-foreground">
            Zentra
          </span>
          <h1 className="mt-6 text-3xl leading-tight">
            {mode === "signup" ? "Create your account" : "Enter your code"}
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            {mode === "signup"
              ? "We'll send a code to confirm your email — just once."
              : `We sent a 6-digit code to ${email}.`}
          </p>
        </div>

        {/* ── Create account with password ── */}
        {mode === "signup" && (
          <form onSubmit={signUp} className="space-y-4">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                I want to...
              </span>
              <div className="mt-2 space-y-2">
                {SIGNUP_ROLES.map((r) => (
                  <button
                    key={r.value}
                    type="button"
                    onClick={() => setAccountRole(r.value)}
                    className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left transition-colors ${
                      accountRole === r.value
                        ? "border-primary bg-primary/5"
                        : "border-border bg-card"
                    }`}
                  >
                    <span>
                      <span className="block text-sm font-bold">{r.label}</span>
                      <span className="block text-xs text-muted-foreground">{r.hint}</span>
                    </span>
                    <span
                      className={`grid size-5 shrink-0 place-items-center rounded-full border-2 ${
                        accountRole === r.value ? "border-primary" : "border-border"
                      }`}
                    >
                      {accountRole === r.value ? (
                        <span className="size-2.5 rounded-full bg-primary" />
                      ) : null}
                    </span>
                  </button>
                ))}
              </div>
              {accountRole !== "customer" ? (
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                  {accountRole === "merchant"
                    ? "After this, you'll register your store and we'll review it within a day."
                    : "After this, you'll add your motorcycle details and we'll verify you."}
                </p>
              ) : null}
            </div>

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
                minLength={6}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 6 characters"
                className="mt-2 w-full rounded-xl border border-border bg-card px-4 py-3 text-base outline-none ring-primary/20 focus:ring-2"
              />
            </label>
            {error ? <p className="text-sm font-medium text-destructive">{error}</p> : null}
            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-xl bg-primary py-3.5 font-bold text-primary-foreground disabled:opacity-60"
            >
              {busy ? "Sending code..." : "Create account"}
            </button>
            <p className="text-center text-sm text-muted-foreground">
              Already have an account?{" "}
              <Link to="/login" className="font-semibold text-primary">
                Sign in
              </Link>
            </p>
          </form>
        )}

        {/* ── Verify the signup confirmation code ── */}
        {mode === "verify" && (
          <form onSubmit={verifySignup} className="space-y-4">
            <label className="block">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                6-digit code
              </span>
              <input
                inputMode="numeric"
                autoComplete="one-time-code"
                required
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="••••••"
                className="mt-2 w-full rounded-xl border border-border bg-card px-4 py-3 text-center font-display text-2xl font-extrabold tracking-[0.4em] outline-none ring-primary/20 focus:ring-2"
              />
            </label>
            {error ? <p className="text-sm font-medium text-destructive">{error}</p> : null}
            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-xl bg-primary py-3.5 font-bold text-primary-foreground disabled:opacity-60"
            >
              {busy ? "Checking..." : "Confirm & continue"}
            </button>
            <button
              type="button"
              onClick={() => {
                setError(null);
                setCode("");
                setMode("signup");
              }}
              className="w-full py-2 text-sm font-semibold text-primary"
            >
              Use a different email
            </button>
          </form>
        )}
      </div>
    </Screen>
  );
}