import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Screen } from "@/components/zentra/shell";

export const Route = createFileRoute("/auth/set-password")({
  head: () => ({
    meta: [{ title: "Set your password — Zentra" }],
  }),
  component: SetPasswordPage,
});

// Supabase's invite/reset link lands here with a token in the URL hash.
// supabase-js auto-detects that on load (detectSessionInUrl, on by
// default) and turns it into a real, temporary session — that's the only
// thing that lets updateUser({ password }) below work. Until that's
// finished, `checking` stays true so we don't render a form for a session
// that doesn't exist yet.
function SetPasswordPage() {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);
  const [hasSession, setHasSession] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setHasSession(Boolean(data.session));
      setChecking(false);
    });
    // Covers the case where the hash is still being processed when this
    // component first mounts — the SDK fires this once it's done.
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setHasSession(Boolean(session));
      setChecking(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    setBusy(true);
    const { error: err } = await supabase.auth.updateUser({ password });
    if (err) {
      setBusy(false);
      setError(err.message);
      return;
    }
    // Deliberately sign out of the temporary invite session and send them
    // to /login — they sign in fresh with the password they just set,
    // rather than being carried straight into the dashboard.
    await supabase.auth.signOut();
    setBusy(false);
    toast.success("Password set", { description: "You can now sign in with your new password." });
    navigate({ to: "/login" });
  }

  if (checking) return null;

  if (!hasSession) {
    return (
      <Screen nav={false}>
        <div className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
          <p className="font-display text-xl font-extrabold">This link has expired</p>
          <p className="mt-2 max-w-xs text-sm leading-relaxed text-muted-foreground">
            Invite links only work once and expire after a while. Ask whoever approved your
            application to resend it, or contact support.
          </p>
        </div>
      </Screen>
    );
  }

  return (
    <Screen nav={false}>
      <div className="flex min-h-screen flex-col px-6 pb-10 pt-16">
        <div className="mb-10">
          <span className="inline-block rounded-lg bg-primary px-3 py-1 font-display text-lg font-extrabold tracking-tight text-primary-foreground">
            Zentra
          </span>
          <h1 className="mt-6 text-3xl leading-tight">Set your password</h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Choose a password for your account. You'll use this to sign in from now on.
          </p>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <label className="block">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              New password
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
          <label className="block">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Confirm password
            </span>
            <input
              type="password"
              required
              minLength={6}
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Type it again"
              className="mt-2 w-full rounded-xl border border-border bg-card px-4 py-3 text-base outline-none ring-primary/20 focus:ring-2"
            />
          </label>
          {error ? <p className="text-sm font-medium text-destructive">{error}</p> : null}
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-xl bg-primary py-3.5 font-bold text-primary-foreground disabled:opacity-60"
          >
            {busy ? "Saving..." : "Set password & continue"}
          </button>
        </form>
      </div>
    </Screen>
  );
}
