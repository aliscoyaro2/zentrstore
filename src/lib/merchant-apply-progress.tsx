import { Check } from "lucide-react";

const STEP_LABELS = ["Business", "Settlement", "Operations", "Verification"] as const;

export function MerchantApplyProgress({ currentStep }: { currentStep: 1 | 2 | 3 | 4 }) {
  return (
    <div className="px-4 py-4">
      <div className="flex items-center">
        {STEP_LABELS.map((label, idx) => {
          const stepNumber = idx + 1;
          const complete = stepNumber < currentStep;
          const active = stepNumber === currentStep;
          return (
            <div key={label} className="flex flex-1 items-center last:flex-none">
              <div className="flex flex-col items-center gap-1">
                <div
                  className={`grid size-8 shrink-0 place-items-center rounded-full text-xs font-bold transition-colors ${
                    complete
                      ? "bg-primary text-primary-foreground"
                      : active
                        ? "border-2 border-primary text-primary"
                        : "border border-border bg-secondary text-muted-foreground"
                  }`}
                >
                  {complete ? <Check className="size-4" /> : stepNumber}
                </div>
                <span
                  className={`text-[10px] font-semibold uppercase tracking-wide ${
                    active || complete ? "text-foreground" : "text-muted-foreground"
                  }`}
                >
                  {label}
                </span>
              </div>
              {stepNumber < STEP_LABELS.length ? (
                <div className={`mx-2 h-0.5 flex-1 rounded ${complete ? "bg-primary" : "bg-border"}`} />
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
