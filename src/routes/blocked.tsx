import { createFileRoute, Link } from "@tanstack/react-router";
import { ShieldAlert } from "lucide-react";
import { Screen } from "@/components/zentra/shell";

export const Route = createFileRoute("/blocked")({
  head: () => ({
    meta: [{ title: "Account restricted — Zentra" }],
  }),
  component: BlockedPage,
});

function BlockedPage() {
  return (
    <Screen nav={false}>
      <div className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
        <ShieldAlert className="size-10 text-destructive" />
        <h1 className="mt-4 text-2xl leading-tight">Your account is restricted</h1>
        <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
          An admin has restricted access to this account. If you think this is a mistake, please
          reach out to Zentra support.
        </p>
        <Link to="/login" className="mt-6 font-semibold text-primary">
          Back to sign in
        </Link>
      </div>
    </Screen>
  );
}
