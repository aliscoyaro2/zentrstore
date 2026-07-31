import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Screen } from "@/components/zentra/shell";

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
// "signin"       – returning user, email + password
// "signup"       – new user, email + password (submitting sends a verification code)
// "verify"       – enter the 6-digit code that confirms the new account or signs in
// "signin-code"  – fallback: sign in via one-time email code, no password
type Mode = "signin" | "signup" | "verify" | "signin-code";

// Which flow the "verify" step belongs to — set explicitly rather than
// inferred from other form state, so switching modes can't cross-wire it.
type VerifyKind = "signup" | "signin-code";

function LoginPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("signin");
  const [verifyKind, setVerifyKind] = useState<VerifyKind>("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upsertProfile(user: { id: string; email?: string | null }) {
    await supabase
      .from("profiles")
      .upsert({ id: user.id, email: user.email ?? null }, { onConflict: "id" });
  }

  // ── Returning user: email + password ──
  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setBusy(false);
    if (err) {
      setError(err.message);
      return;
    }
    navigate({ to: "/" });
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
    setVerifyKind("signup");
    setMode("verify");
    toast.success("Code sent", { description: `Check ${email} to confirm your account.` });
  }

  // ── Confirm the signup code — one time only, then password works from here on ──
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
    navigate({ to: "/" });
  }

  // ── Fallback: passwordless sign-in via emailed code (no password on file) ──
  async function sendSignInCode(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { shouldCreateUser: false },
    });
    setBusy(false);
    if (err) {
      setError(err.message);
      return;
    }
    setVerifyKind("signin-code");
    setMode("verify");
    toast.success("Code sent", { description: `Check ${email} for your 6-digit code.` });
  }

  async function verifySignInCode(e: React.FormEvent) {
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
    navigate({ to: "/" });
  }

  function backToStart() {
    setError(null);
    setCode("");
    setMode(verifyKind === "signup" ? "signup" : "signin-code");
  }

  const heading =
    mode === "signin"
      ? "Welcome back"
      : mode === "signup"
      ? "Create your account"
      : mode === "signin-code"
      ? "Sign in with a code"
      : "Enter your code";

  const subheading =
    mode === "signin"
      ? "Sign in with your email and password."
      : mode === "signup"
      ? "We'll send a code to confirm your email — just once."
      : mode === "signin-code"
      ? "We'll email you a 6-digit code, no password needed."
      : `We sent a 6-digit code to ${email}.`;

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
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setMode("signup");
                }}
                className="font-semibold text-primary"
              >
                Create an account
              </button>
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setMode("signin-code");
                }}
                className="text-muted-foreground underline"
              >
                Use email code instead
              </button>
            </div>
          </form>
        )}

        {/* ── Create account with password ── */}
        {mode === "signup" && (
          <form onSubmit={signUp} className="space-y-4">
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
            <button
              type="button"
              onClick={() => {
                setError(null);
                setMode("signin");
              }}
              className="w-full py-2 text-sm font-semibold text-primary"
            >
              Already have an account? Sign in
            </button>
          </form>
        )}

        {/* ── Passwordless sign-in fallback ── */}
        {mode === "signin-code" && (
          <form onSubmit={sendSignInCode} className="space-y-4">
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
              {busy ? "Sending code..." : "Send my code"}
            </button>
            <button
              type="button"
              onClick={() => {
                setError(null);
                setMode("signin");
              }}
              className="w-full py-2 text-sm font-semibold text-primary"
            >
              Back to password sign in
            </button>
          </form>
        )}

        {/* ── Verify code (either signup confirmation or passwordless sign-in) ── */}
        {mode === "verify" && (
          <form
            onSubmit={verifyKind === "signup" ? verifySignup : verifySignInCode}
            className="space-y-4"
          >
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
            <button type="button" onClick={backToStart} className="w-full py-2 text-sm font-semibold text-primary">
              Use a different email
            </button>
          </form>
        )}
      </div>
    </Screen>
  );
}
