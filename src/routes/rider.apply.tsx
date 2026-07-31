import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Screen, PageHeader, Panel } from "@/components/zentra/shell";
import { useSession } from "@/hooks/use-session";

export const Route = createFileRoute("/rider/apply")({
  head: () => ({
    meta: [
      { title: "Ride with Zentra Maiduguri" },
      {
        name: "description",
        content: "Apply to deliver Zentra orders around Maiduguri on your own motorcycle.",
      },
      { property: "og:title", content: "Ride with Zentra" },
      { property: "og:description", content: "Steady delivery jobs across GRA and Monday Market." },
    ],
  }),
  component: RiderApply,
});

function RiderApply() {
  const { user, loading } = useSession();
  const navigate = useNavigate();
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [plate, setPlate] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [loading, user, navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setBusy(true);
    const { error } = await supabase.from("riders").insert({
      id: user.id,
      vehicle_make: make.trim(),
      vehicle_model: model.trim(),
      plate_number: plate.trim().toUpperCase(),
    });
    setBusy(false);
    if (error) {
      toast.error("Could not submit", { description: error.message });
      return;
    }
    toast.success("Application received", { description: "We'll verify your details shortly." });
    navigate({ to: "/rider" });
  }

  return (
    <Screen>
      <PageHeader title="Ride with Zentra" subtitle="Rider application" back="/" />
      <div className="space-y-5 px-4 py-6">
        <div>
          <p className="font-display text-2xl font-extrabold leading-tight">
            Deliver around your own streets.
          </p>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Jobs come zone by zone, so you stay close to home. Payouts are tracked per delivery.
          </p>
        </div>

        <Panel className="p-4">
          <p className="text-xs font-bold uppercase tracking-[0.15em] text-muted-foreground">
            What you need
          </p>
          <ul className="mt-2 space-y-1.5 text-sm">
            <li>• A working motorcycle you own or control</li>
            <li>• A valid plate number</li>
            <li>• A phone that stays on while you're online</li>
          </ul>
        </Panel>

        <form onSubmit={submit} className="space-y-4">
          <Field label="Vehicle make" value={make} onChange={setMake} placeholder="e.g. Bajaj" />
          <Field label="Vehicle model" value={model} onChange={setModel} placeholder="e.g. Boxer 100" />
          <Field label="Plate number" value={plate} onChange={setPlate} placeholder="e.g. BOR 123 AB" />
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-xl bg-primary py-3.5 font-bold text-primary-foreground disabled:opacity-60"
          >
            {busy ? "Submitting..." : "Submit application"}
          </button>
        </form>
      </div>
    </Screen>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <label className="block">
      <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <input
        required
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-2 w-full rounded-xl border border-border bg-card px-4 py-3 text-base outline-none focus:ring-2 focus:ring-primary/20"
      />
    </label>
  );
}
