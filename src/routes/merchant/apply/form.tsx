import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Screen, PageHeader, Panel } from "@/components/zentra/shell";
import { PhotoCaptureField } from "@/components/zentra/photo-capture-field";
import { MerchantApplyProgress } from "@/components/zentra/merchant-apply-progress";
import { CATEGORIES, type MerchantCategory } from "@/lib/categories";
import {
  sendMerchantApplicationOtp,
  verifyMerchantApplicationOtp,
  saveMerchantApplicationStep,
  submitMerchantApplication,
} from "@/lib/merchant-application.functions";
import { uploadMerchantApplicationFile } from "@/lib/merchant-application-uploads";

export const Route = createFileRoute("/merchant/apply/form")({
  head: () => ({
    meta: [{ title: "Merchant application — Zentra" }],
  }),
  component: MerchantApplyForm,
});

type Stage = "email" | "otp" | "form";

const REFERRAL_SOURCES = ["Friend or family", "Social media", "Saw another store on Zentra", "Radio", "Other"];

// Local storage key so a refresh mid-application doesn't lose the applicant's
// place — the server is the source of truth (autosaved per step), this just
// remembers *which* application and step to resume.
const RESUME_KEY = "zentra_merchant_application_token";

function StepField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{label}</span>
      <div className="mt-2">{children}</div>
    </label>
  );
}

const inputClass =
  "w-full rounded-xl border border-border bg-card px-4 py-3 text-base outline-none focus:ring-2 focus:ring-primary/20";

function MerchantApplyForm() {
  const navigate = useNavigate();

  const [stage, setStage] = useState<Stage>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [applicationToken, setApplicationToken] = useState<string | null>(
    () => sessionStorage.getItem(RESUME_KEY),
  );
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  // Step 1 — Business information
  const [businessName, setBusinessName] = useState("");
  const [category, setCategory] = useState<MerchantCategory | "">("");
  const [description, setDescription] = useState("");
  const [address, setAddress] = useState("");
  const [lga, setLga] = useState("");
  const [phone, setPhone] = useState("");
  const [coverPhotoUrl, setCoverPhotoUrl] = useState<string | null>(null);

  // Step 2 — Settlement
  const [bankName, setBankName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountName, setAccountName] = useState("");

  // Step 3 — Operations
  const [openingTime, setOpeningTime] = useState("");
  const [closingTime, setClosingTime] = useState("");
  const [prepTime, setPrepTime] = useState("");
  const [selfDelivery, setSelfDelivery] = useState<boolean | null>(null);
  const [posAvailable, setPosAvailable] = useState<boolean | null>(null);
  const [commissionAgreed, setCommissionAgreed] = useState(false);

  // Step 4 — Verification
  const [ownerIdUrl, setOwnerIdUrl] = useState<string | null>(null);
  const [tin, setTin] = useState("");
  const [referral, setReferral] = useState("");
  const [signatureName, setSignatureName] = useState("");
  const [agreed, setAgreed] = useState(false);

  function persistToken(token: string) {
    setApplicationToken(token);
    sessionStorage.setItem(RESUME_KEY, token);
  }

  async function sendCode(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await sendMerchantApplicationOtp({ data: { email: email.trim().toLowerCase() } });
      setStage("otp");
      toast.success("Code sent", { description: `Check ${email} for your 6-digit code.` });
    } catch (err) {
      toast.error("Could not send code", { description: err instanceof Error ? err.message : undefined });
    } finally {
      setBusy(false);
    }
  }

  async function verifyCode(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const result = await verifyMerchantApplicationOtp({
        data: {
          email: email.trim().toLowerCase(),
          code: code.trim(),
          existingApplicationToken: applicationToken ?? undefined,
        },
      });
      persistToken(result.applicationToken);
      setStage("form");
      toast.success("Email verified");
    } catch (err) {
      toast.error("That code didn't work", { description: err instanceof Error ? err.message : undefined });
    } finally {
      setBusy(false);
    }
  }

  async function saveStepAndAdvance(nextStep: 2 | 3 | 4 | "submit") {
    if (!applicationToken) return;
    setBusy(true);
    try {
      if (step === 1) {
        if (!businessName || !category || !address || !lga || !phone) {
          toast.error("Please complete every field in this step.");
          setBusy(false);
          return;
        }
        await saveMerchantApplicationStep({
          data: {
            applicationToken,
            step: 1,
            fields: {
              business_name: businessName,
              category,
              business_description: description || undefined,
              address_text: address,
              lga,
              phone,
            },
          },
        });
      } else if (step === 2) {
        if (!bankName || !accountNumber || !accountName) {
          toast.error("Please complete every field in this step.");
          setBusy(false);
          return;
        }
        await saveMerchantApplicationStep({
          data: {
            applicationToken,
            step: 2,
            fields: {
              bank_name: bankName,
              account_number: accountNumber,
              account_name: accountName,
            },
          },
        });
      } else if (step === 3) {
        if (!openingTime || !closingTime || !prepTime || selfDelivery === null || posAvailable === null || !commissionAgreed) {
          toast.error("Please complete every field, including the commission agreement, to continue.");
          setBusy(false);
          return;
        }
        await saveMerchantApplicationStep({
          data: {
            applicationToken,
            step: 3,
            fields: {
              opening_time: openingTime,
              closing_time: closingTime,
              prep_time_mins: Number(prepTime),
              self_delivery: selfDelivery,
              pos_available: posAvailable,
              commission_agreement_accepted: commissionAgreed,
            },
          },
        });
      } else if (step === 4) {
        if (!ownerIdUrl || !referral || !agreed || !signatureName) {
          toast.error("Please complete every field and sign the agreement to continue.");
          setBusy(false);
          return;
        }
        await saveMerchantApplicationStep({
          data: {
            applicationToken,
            step: 4,
            fields: {
              tin: tin || undefined,
              referral_source: referral,
              agreement_accepted: true,
              agreement_signature_name: signatureName,
            },
          },
        });
      }

      if (nextStep === "submit") {
        await submitMerchantApplication({ data: { applicationToken } });
        sessionStorage.removeItem(RESUME_KEY);
        navigate({ to: "/merchant/apply/submitted" });
        return;
      }

      setStep(nextStep);
    } catch (err) {
      toast.error("Could not save this step", { description: err instanceof Error ? err.message : undefined });
    } finally {
      setBusy(false);
    }
  }

  // ── Stage: email ──
  if (stage === "email") {
    return (
      <Screen nav={false}>
        <PageHeader title="Merchant application" back="/merchant/apply" />
        <div className="px-4 py-8">
          <p className="font-display text-xl font-extrabold">Let's start with your email</p>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            We'll send a 6-digit code to verify it's really you. No account or password needed.
          </p>
          <form onSubmit={sendCode} className="mt-6 space-y-4">
            <StepField label="Email address">
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className={inputClass}
              />
            </StepField>
            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-xl bg-primary py-3.5 font-bold text-primary-foreground disabled:opacity-60"
            >
              {busy ? "Sending code..." : "Send verification code"}
            </button>
          </form>
        </div>
      </Screen>
    );
  }

  // ── Stage: otp ──
  if (stage === "otp") {
    return (
      <Screen nav={false}>
        <PageHeader title="Merchant application" back="/merchant/apply" />
        <div className="px-4 py-8">
          <p className="font-display text-xl font-extrabold">Enter your code</p>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            We sent a 6-digit code to {email}.
          </p>
          <form onSubmit={verifyCode} className="mt-6 space-y-4">
            <StepField label="6-digit code">
              <input
                inputMode="numeric"
                autoComplete="one-time-code"
                required
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="••••••"
                className={`${inputClass} text-center font-display text-2xl font-extrabold tracking-[0.4em]`}
              />
            </StepField>
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
                setCode("");
                setStage("email");
              }}
              className="w-full py-2 text-sm font-semibold text-primary"
            >
              Use a different email
            </button>
          </form>
        </div>
      </Screen>
    );
  }

  // ── Stage: form (4 steps) ──
  return (
    <Screen nav={false}>
      <PageHeader title="Merchant application" back="/merchant/apply" />
      <MerchantApplyProgress currentStep={step} />
      <div className="space-y-5 px-4 pb-10">
        {step === 1 && (
          <Panel className="space-y-4 p-4">
            <p className="font-display text-lg font-extrabold">Business information</p>
            <StepField label="Business name">
              <input value={businessName} onChange={(e) => setBusinessName(e.target.value)} className={inputClass} />
            </StepField>
            <StepField label="Business type">
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as MerchantCategory)}
                className={inputClass}
              >
                <option value="">Select</option>
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </StepField>
            <StepField label="Business description (optional)">
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                placeholder="What do you sell?"
                className={inputClass}
              />
            </StepField>
            <StepField label="Business address">
              <textarea value={address} onChange={(e) => setAddress(e.target.value)} rows={2} className={inputClass} />
            </StepField>
            <StepField label="LGA">
              <input value={lga} onChange={(e) => setLga(e.target.value)} placeholder="e.g. Maiduguri" className={inputClass} />
            </StepField>
            <StepField label="Phone number">
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="e.g. 0803 123 4567"
                className={inputClass}
              />
            </StepField>
            <PhotoCaptureField
              label="Store photo or logo (optional)"
              hint="A clear photo of your store, product, or logo."
              value={coverPhotoUrl}
              onCapture={async (file) => {
                if (!applicationToken) return;
                const path = await uploadMerchantApplicationFile({ applicationToken, kind: "cover-photo", file });
                setCoverPhotoUrl(path);
              }}
              facingMode="environment"
            />
          </Panel>
        )}

        {step === 2 && (
          <>
            <Panel className="space-y-4 p-4">
              <p className="font-display text-lg font-extrabold">Settlement details</p>
              <StepField label="Bank name">
                <input value={bankName} onChange={(e) => setBankName(e.target.value)} className={inputClass} />
              </StepField>
              <StepField label="Account number">
                <input value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} className={inputClass} />
              </StepField>
              <StepField label="Account name">
                <input value={accountName} onChange={(e) => setAccountName(e.target.value)} className={inputClass} />
              </StepField>
            </Panel>
            <Panel className="space-y-2 p-4 text-xs leading-relaxed text-muted-foreground">
              <p className="font-bold text-foreground">How settlement works</p>
              <p>
                Zentra never pays instantly per order. Instead, your sales are tracked as a running balance and
                paid out to the bank account above on a scheduled settlement cycle.
              </p>
              <p className="font-bold text-foreground">How commission works</p>
              <p>
                Zentra takes a percentage of each completed order as commission — the rate depends on your business
                category, and you'll confirm it explicitly in the Operations step.
              </p>
            </Panel>
          </>
        )}

        {step === 3 && (
          <Panel className="space-y-4 p-4">
            <p className="font-display text-lg font-extrabold">Operations</p>
            <StepField label="Opening time">
              <input type="time" value={openingTime} onChange={(e) => setOpeningTime(e.target.value)} className={inputClass} />
            </StepField>
            <StepField label="Closing time">
              <input type="time" value={closingTime} onChange={(e) => setClosingTime(e.target.value)} className={inputClass} />
            </StepField>
            <StepField label="Typical preparation time (minutes)">
              <input
                type="number"
                min={1}
                max={240}
                value={prepTime}
                onChange={(e) => setPrepTime(e.target.value)}
                className={inputClass}
              />
            </StepField>
            <StepField label="Do you deliver your own orders?">
              <div className="flex gap-3">
                {[
                  { label: "No", value: false },
                  { label: "Yes", value: true },
                ].map((opt) => (
                  <button
                    key={opt.label}
                    type="button"
                    onClick={() => setSelfDelivery(opt.value)}
                    className={`flex-1 rounded-xl border py-2.5 text-sm font-semibold ${
                      selfDelivery === opt.value
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-card text-muted-foreground"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </StepField>
            <StepField label="Do you have a POS terminal?">
              <div className="flex gap-3">
                {[
                  { label: "No", value: false },
                  { label: "Yes", value: true },
                ].map((opt) => (
                  <button
                    key={opt.label}
                    type="button"
                    onClick={() => setPosAvailable(opt.value)}
                    className={`flex-1 rounded-xl border py-2.5 text-sm font-semibold ${
                      posAvailable === opt.value
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-card text-muted-foreground"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </StepField>
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                checked={commissionAgreed}
                onChange={(e) => setCommissionAgreed(e.target.checked)}
                className="mt-1 size-4 shrink-0"
              />
              <span>I understand and agree that Zentra will deduct a category-based commission from each completed order.</span>
            </label>
          </Panel>
        )}

        {step === 4 && (
          <>
            <Panel className="space-y-4 p-4">
              <p className="font-display text-lg font-extrabold">Verification</p>
              <PhotoCaptureField
                label="Owner's means of ID (optional for now)"
                hint="A clear photo of a valid government-issued ID. You can add this later before going live."
                value={ownerIdUrl}
                onCapture={async (file) => {
                  if (!applicationToken) return;
                  const path = await uploadMerchantApplicationFile({ applicationToken, kind: "owner-id", file });
                  setOwnerIdUrl(path);
                }}
                facingMode="environment"
              />
              <StepField label="TIN (optional)">
                <input value={tin} onChange={(e) => setTin(e.target.value)} className={inputClass} />
              </StepField>
              <StepField label="How did you hear about Zentra?">
                <select value={referral} onChange={(e) => setReferral(e.target.value)} className={inputClass}>
                  <option value="">Select</option>
                  {REFERRAL_SOURCES.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </StepField>
            </Panel>

            <Panel className="space-y-3 p-4">
              <p className="font-display text-lg font-extrabold">Merchant agreement</p>
              <div className="max-h-40 overflow-y-auto rounded-xl border border-border bg-secondary/40 p-3 text-xs leading-relaxed text-muted-foreground">
                <p className="font-bold text-foreground">Platform Policy</p>
                <p className="mt-1">
                  As a Zentra merchant, you set your own prices and manage your own catalog and hours. Zentra
                  reserves the right to review suspicious or abusive pricing. Orders are paid online in full before
                  preparation — there is no cash on delivery on Zentra.
                </p>
                <p className="mt-2 font-bold text-foreground">Commission & Settlement</p>
                <p className="mt-1">
                  Zentra deducts a category-based commission from every completed order and settles your remaining
                  balance to the bank account you provided, on a scheduled cycle rather than per order.
                </p>
                <p className="mt-2 font-bold text-foreground">Accuracy & Conduct</p>
                <p className="mt-1">
                  You agree to keep your preparation-time estimates accurate, fulfil accepted orders promptly, and
                  treat customers and riders with respect. Violations may result in suspension or removal from the
                  platform.
                </p>
              </div>
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={agreed}
                  onChange={(e) => setAgreed(e.target.checked)}
                  className="mt-1 size-4 shrink-0"
                />
                <span>I have read and agree to the Merchant Agreement and Platform Policy.</span>
              </label>
              <StepField label="Digital signature — type your full name">
                <input
                  value={signatureName}
                  onChange={(e) => setSignatureName(e.target.value)}
                  placeholder="Your full name"
                  className={`${inputClass} font-display italic`}
                />
              </StepField>
            </Panel>
          </>
        )}

        <div className="flex gap-3 pt-2">
          {step > 1 ? (
            <button
              type="button"
              onClick={() => setStep((step - 1) as 1 | 2 | 3)}
              className="flex-1 rounded-xl border border-border bg-card py-3.5 font-bold"
            >
              Back
            </button>
          ) : null}
          <button
            type="button"
            disabled={busy}
            onClick={() => saveStepAndAdvance(step === 4 ? "submit" : ((step + 1) as 2 | 3 | 4))}
            className="flex-1 rounded-xl bg-primary py-3.5 font-bold text-primary-foreground disabled:opacity-60"
          >
            {busy ? "Saving..." : step === 4 ? "Submit application" : "Continue"}
          </button>
        </div>
      </div>
    </Screen>
  );
}
