import { useRef, useState } from "react";
import { Camera, CheckCircle2, Loader2 } from "lucide-react";

/**
 * A tap-to-capture photo field. On mobile this opens the camera directly
 * (via capture="environment"/"user"); on desktop it opens the file picker.
 * `accept="image/*"` plus the upload-time validation in uploads.ts means a
 * video can never be selected here — only real pictures.
 */
export function PhotoCaptureField({
  label,
  hint,
  value,
  onCapture,
  facingMode = "environment",
}: {
  label: string;
  hint?: string;
  /** Current public URL, if a photo has already been uploaded. */
  value: string | null;
  onCapture: (file: File) => Promise<void>;
  /** "user" = front camera (for a rider's own photo), "environment" = rear camera (for a document). */
  facingMode?: "user" | "environment";
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file again later
    if (!file) return;
    setError(null);
    setBusy(true);
    try {
      await onCapture(file);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{label}</span>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture={facingMode}
        className="hidden"
        onChange={handleChange}
      />

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        className={`mt-2 flex w-full items-center gap-3 rounded-xl border p-3 text-left transition disabled:opacity-60 ${
          value ? "border-success/30 bg-success-soft" : "border-dashed border-border bg-card"
        }`}
      >
        <span
          className={`grid size-11 shrink-0 place-items-center rounded-full ${
            value ? "bg-success text-primary-foreground" : "bg-secondary text-muted-foreground"
          }`}
        >
          {busy ? (
            <Loader2 className="size-5 animate-spin" strokeWidth={2.2} />
          ) : value ? (
            <CheckCircle2 className="size-5" strokeWidth={2.2} />
          ) : (
            <Camera className="size-5" strokeWidth={2.2} />
          )}
        </span>
        <span className="min-w-0">
          <span className="block text-sm font-bold">
            {busy ? "Uploading…" : value ? "Photo added — tap to retake" : "Tap to take a photo"}
          </span>
          <span className="block text-xs text-muted-foreground">
            {value ? "Looks good" : "Camera or photo library"}
          </span>
        </span>
      </button>

      {error ? <p className="mt-1.5 text-xs font-semibold text-destructive">{error}</p> : null}

      {value ? (
        <img
          src={value}
          alt=""
          className="mt-2 h-32 w-full rounded-xl border border-border object-cover"
        />
      ) : null}
    </div>
  );
}
