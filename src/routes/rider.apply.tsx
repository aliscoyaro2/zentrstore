import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Screen, PageHeader, Panel } from "@/components/zentra/shell";
import { PhotoCaptureField } from "@/components/zentra/photo-capture-field";
import { useSession } from "@/hooks/use-session";
import { uploadRiderDocumentPhoto } from "@/lib/uploads";

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
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [idUrl, setIdUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [loading, user, navigate]);

  async function capturePhoto(file: File) {
    if (!user) return;
    const url = await uploadRiderDocumentPhoto({ riderId: user.id, kind: "photo", file });
    setPhotoUrl(url);
  }

  async function captureId(file: File) {
    if (!user) return;
    const url = await uploadRiderDocumentPhoto({ riderId: user.id, kind: "national-id", file });
    setIdUrl(url);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    if (!photoUrl) {
      toast.error("Add your photo", { description: "We need a clear photo of you before you can apply." });
      return;
    }
    if (!idUrl) {
      toast.error("Add your ID photo", { description: "We need a photo of your national ID before you can apply." });
      return;
    }
    setBusy(true);
    const { error } = await supabase.from("riders").insert({
      id: user.id,
      vehicle_make: make.trim(),
      vehicle_model: model.trim(),
      plate_number: plate.trim().toUpperCase(),
      photo_url: photoUrl,
      national_id_doc_url: idUrl,
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
            <li>• A clear photo of yourself</li>
            <li>• A photo of your national ID</li>
          </ul>
        </Panel>

        <form onSubmit={submit} className="space-y-5">
          <Field label="Vehicle make" value={make} onChange={setMake} placeholder="e.g. Bajaj" />
          <Field label="Vehicle model" value={model} onChange={setModel} placeholder="e.g. Boxer 100" />
          <Field label="Plate number" value={plate} onChange={setPlate} placeholder="e.g. BOR 123 AB" />

          <PhotoCaptureField
            label="Your photo"
            hint="A clear photo of your face, taken now — this helps merchants and customers recognize you."
            value={photoUrl}
            onCapture={capturePhoto}
            facingMode="user"
          />

          <PhotoCaptureField
            label="National ID"
            hint="A clear photo of your national ID card or slip."
            value={idUrl}
            onCapture={captureId}
            facingMode="environment"
          />

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
