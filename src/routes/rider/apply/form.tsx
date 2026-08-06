import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Screen, PageHeader, Panel } from "@/components/zentra/shell";
import { PhotoCaptureField } from "@/components/zentra/photo-capture-field";
import { RiderApplyProgress } from "@/components/zentra/rider-apply-progress";
import {
  sendRiderApplicationOtp,
  verifyRiderApplicationOtp,
  saveRiderApplicationStep,
  submitRiderApplication,
} from "@/lib/rider-application.functions";
import { uploadRiderApplicationFile } from "@/lib/rider-application-uploads";

export const Route = createFileRoute("/rider/apply/form")({
  head: () => ({
    meta: [{ title: "Rider application — Zentra" }],
  }),
  component: RiderApplyForm,
});

type Stage = "email" | "otp" | "form";

const GENDERS = ["Male", "Female"];
const VEHICLE_TYPES = ["Motorcycle", "Tricycle (Keke)", "Bicycle"];
const OWNERSHIP = ["I own it", "I rent it", "Family/friend's vehicle"];
const RELATIONSHIPS = ["Parent", "Sibling", "Spouse", "Other relative", "Friend"];
const REFERRAL_SOURCES = ["Friend or family", "Social media", "Saw a rider on the road", "Radio", "Other"];

// Local storage key so a refresh mid-application doesn't lose the applicant's
// place — the server is the source of truth (autosaved per step), this just
// remembers *which* application and step to resume.
const RESUME_KEY = "zentra_rider_application_token";

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

function RiderApplyForm() {
  const navigate = useNavigate();

  const [stage, setStage] = useState<Stage>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [applicationToken, setApplicationToken] = useState<string | null>(
    () => sessionStorage.getItem(RESUME_KEY),
  );
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  // Step 1
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [dob, setDob] = useState("");
  const [gender, setGender] = useState("");
  const [address, setAddress] = useState("");
  const [lga, setLga] = useState("");
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);

  // Step 2
  const [vehicleType, setVehicleType] = useState("");
  const [plate, setPlate] = useState("");
  const [licenseNumber, setLicenseNumber] = useState("");
  const [licenseFrontUrl, setLicenseFrontUrl] = useState<string | null>(null);
  const [licenseBackUrl, setLicenseBackUrl] = useState<string | null>(null);
  const [insuranceUrl, setInsuranceUrl] = useState<string | null>(null);
  const [ownership, setOwnership] = useState("");
  const [experience, setExperience] = useState("");

  // Step 3
  const [bankName, setBankName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountName, setAccountName] = useState("");
  const [kinName, setKinName] = useState("");
  const [kinPhone, setKinPhone] = useState("");
  const [kinRelationship, setKinRelationship] = useState("");

  // Step 4
  const [priorExperience, setPriorExperience] = useState("");
  const [hasCriminalRecord, setHasCriminalRecord] = useState<boolean | null>(null);
  const [criminalDetails, setCriminalDetails] = useState("");
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
      await sendRiderApplicationOtp({ data: { email: email.trim().toLowerCase() } });
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
      const result = await verifyRiderApplicationOtp({
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
        if (!fullName || !phone || !dob || !gender || !address || !lga || !photoUrl) {
          toast.error("Please complete every field in this step, including your photo.");
          setBusy(false);
          return;
        }
        await saveRiderApplicationStep({
          data: {
            applicationToken,
            step: 1,
            fields: {
              full_name: fullName,
              phone,
              date_of_birth: dob,
              gender,
              residential_address: address,
              lga,
            },
          },
        });
      } else if (step === 2) {
        if (!vehicleType || !plate || !licenseNumber || !licenseFrontUrl || !licenseBackUrl || !insuranceUrl || !ownership) {
          toast.error("Please complete every field in this step, including all document uploads.");
          setBusy(false);
          return;
        }
        await saveRiderApplicationStep({
          data: {
            applicationToken,
            step: 2,
            fields: {
              vehicle_type: vehicleType,
              plate_number: plate.toUpperCase(),
              drivers_license_number: licenseNumber,
              vehicle_ownership: ownership,
              years_riding_experience: experience ? Number(experience) : undefined,
            },
          },
        });
      } else if (step === 3) {
        if (!bankName || !accountNumber || !accountName || !kinName || !kinPhone || !kinRelationship) {
          toast.error("Please complete every field in this step.");
          setBusy(false);
          return;
        }
        await saveRiderApplicationStep({
          data: {
            applicationToken,
            step: 3,
            fields: {
              bank_name: bankName,
              account_number: accountNumber,
              account_name: accountName,
              next_of_kin_name: kinName,
              next_of_kin_phone: kinPhone,
              next_of_kin_relationship: kinRelationship,
            },
          },
        });
      } else if (step === 4) {
        if (hasCriminalRecord === null || !referral || !agreed || !signatureName) {
          toast.error("Please answer every question and sign the agreement to continue.");
          setBusy(false);
          return;
        }
        await saveRiderApplicationStep({
          data: {
            applicationToken,
            step: 4,
            fields: {
              previous_delivery_experience: priorExperience,
              has_criminal_record: hasCriminalRecord,
              criminal_record_details: criminalDetails,
              referral_source: referral,
              agreement_accepted: true,
              agreement_signature_name: signatureName,
            },
          },
        });
      }

      if (nextStep === "submit") {
        await submitRiderApplication({ data: { applicationToken } });
        sessionStorage.removeItem(RESUME_KEY);
        navigate({ to: "/rider/apply/submitted" });
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
        <PageHeader title="Rider application" back="/rider/apply" />
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
        <PageHeader title="Rider application" back="/rider/apply" />
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
      <PageHeader title="Rider application" back="/rider/apply" />
      <RiderApplyProgress currentStep={step} />
      <div className="space-y-5 px-4 pb-10">
        {step === 1 && (
          <Panel className="space-y-4 p-4">
            <p className="font-display text-lg font-extrabold">Personal information</p>
            <StepField label="Full name">
              <input value={fullName} onChange={(e) => setFullName(e.target.value)} className={inputClass} />
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
            <StepField label="Date of birth">
              <input type="date" value={dob} onChange={(e) => setDob(e.target.value)} className={inputClass} />
            </StepField>
            <StepField label="Gender">
              <select value={gender} onChange={(e) => setGender(e.target.value)} className={inputClass}>
                <option value="">Select</option>
                {GENDERS.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </StepField>
            <StepField label="Residential address">
              <textarea
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                rows={2}
                className={inputClass}
              />
            </StepField>
            <StepField label="LGA">
              <input value={lga} onChange={(e) => setLga(e.target.value)} placeholder="e.g. Maiduguri" className={inputClass} />
            </StepField>
            <PhotoCaptureField
              label="Passport photograph (optional for now)"
              hint="A clear photo of your face, taken now. You can add this later before going live."
              value={photoUrl}
              onCapture={async (file) => {
                if (!applicationToken) return;
                const path = await uploadRiderApplicationFile({ applicationToken, kind: "photo", file });
                setPhotoUrl(path);
              }}
              facingMode="user"
            />
          </Panel>
        )}

        {step === 2 && (
          <Panel className="space-y-4 p-4">
            <p className="font-display text-lg font-extrabold">Vehicle information</p>
            <StepField label="Vehicle type">
              <select value={vehicleType} onChange={(e) => setVehicleType(e.target.value)} className={inputClass}>
                <option value="">Select</option>
                {VEHICLE_TYPES.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </StepField>
            <StepField label="Plate number">
              <input value={plate} onChange={(e) => setPlate(e.target.value)} placeholder="e.g. BOR 123 AB" className={inputClass} />
            </StepField>
            <StepField label="Driver's license number">
              <input value={licenseNumber} onChange={(e) => setLicenseNumber(e.target.value)} className={inputClass} />
            </StepField>
            <PhotoCaptureField
              label="Driver's license (front) (optional for now)"
              value={licenseFrontUrl}
              onCapture={async (file) => {
                if (!applicationToken) return;
                const path = await uploadRiderApplicationFile({ applicationToken, kind: "drivers-license-front", file });
                setLicenseFrontUrl(path);
              }}
              facingMode="environment"
            />
            <PhotoCaptureField
              label="Driver's license (back) (optional for now)"
              value={licenseBackUrl}
              onCapture={async (file) => {
                if (!applicationToken) return;
                const path = await uploadRiderApplicationFile({ applicationToken, kind: "drivers-license-back", file });
                setLicenseBackUrl(path);
              }}
              facingMode="environment"
            />
            <PhotoCaptureField
              label="Vehicle insurance (optional for now)"
              value={insuranceUrl}
              onCapture={async (file) => {
                if (!applicationToken) return;
                const path = await uploadRiderApplicationFile({ applicationToken, kind: "vehicle-insurance", file });
                setInsuranceUrl(path);
              }}
              facingMode="environment"
            />
            <StepField label="Vehicle ownership">
              <select value={ownership} onChange={(e) => setOwnership(e.target.value)} className={inputClass}>
                <option value="">Select</option>
                {OWNERSHIP.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </StepField>
            <StepField label="Years of riding experience">
              <input
                type="number"
                min={0}
                max={60}
                value={experience}
                onChange={(e) => setExperience(e.target.value)}
                className={inputClass}
              />
            </StepField>
          </Panel>
        )}

        {step === 3 && (
          <Panel className="space-y-4 p-4">
            <p className="font-display text-lg font-extrabold">Banking & emergency contact</p>
            <StepField label="Bank name">
              <input value={bankName} onChange={(e) => setBankName(e.target.value)} className={inputClass} />
            </StepField>
            <StepField label="Account number">
              <input value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} className={inputClass} />
            </StepField>
            <StepField label="Account name">
              <input value={accountName} onChange={(e) => setAccountName(e.target.value)} className={inputClass} />
            </StepField>
            <StepField label="Next of kin name">
              <input value={kinName} onChange={(e) => setKinName(e.target.value)} className={inputClass} />
            </StepField>
            <StepField label="Next of kin phone number">
              <input type="tel" value={kinPhone} onChange={(e) => setKinPhone(e.target.value)} className={inputClass} />
            </StepField>
            <StepField label="Relationship">
              <select value={kinRelationship} onChange={(e) => setKinRelationship(e.target.value)} className={inputClass}>
                <option value="">Select</option>
                {RELATIONSHIPS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </StepField>
          </Panel>
        )}

        {step === 4 && (
          <>
            <Panel className="space-y-4 p-4">
              <p className="font-display text-lg font-extrabold">Background</p>
              <StepField label="Previous delivery experience (optional)">
                <textarea
                  value={priorExperience}
                  onChange={(e) => setPriorExperience(e.target.value)}
                  rows={2}
                  className={inputClass}
                />
              </StepField>
              <StepField label="Do you have a criminal record?">
                <div className="flex gap-3">
                  {[
                    { label: "No", value: false },
                    { label: "Yes", value: true },
                  ].map((opt) => (
                    <button
                      key={opt.label}
                      type="button"
                      onClick={() => setHasCriminalRecord(opt.value)}
                      className={`flex-1 rounded-xl border py-2.5 text-sm font-semibold ${
                        hasCriminalRecord === opt.value
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border bg-card text-muted-foreground"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </StepField>
              {hasCriminalRecord ? (
                <StepField label="Please explain">
                  <textarea
                    value={criminalDetails}
                    onChange={(e) => setCriminalDetails(e.target.value)}
                    rows={2}
                    className={inputClass}
                  />
                </StepField>
              ) : null}
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
              <p className="font-display text-lg font-extrabold">Rider agreement</p>
              <div className="max-h-40 overflow-y-auto rounded-xl border border-border bg-secondary/40 p-3 text-xs leading-relaxed text-muted-foreground">
                <p className="font-bold text-foreground">Independent Contractor Agreement</p>
                <p className="mt-1">
                  As a Zentra rider, you work as an independent contractor, not an employee. You control your own
                  schedule, use your own vehicle, and are responsible for your own fuel, maintenance, and taxes on
                  your earnings. Zentra pays you per completed delivery.
                </p>
                <p className="mt-2 font-bold text-foreground">Code of Conduct</p>
                <p className="mt-1">
                  You agree to treat customers and merchants with respect, handle every order with care, follow all
                  road safety laws, and never request or accept cash payment for an order. Violations may result in
                  suspension or removal from the platform.
                </p>
              </div>
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={agreed}
                  onChange={(e) => setAgreed(e.target.checked)}
                  className="mt-1 size-4 shrink-0"
                />
                <span>I have read and agree to the Independent Contractor Agreement and Code of Conduct.</span>
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
