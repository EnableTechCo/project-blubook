"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  useCustomerJourneyStore,
  type PackageTier,
  type OnboardingSnapshot,
} from "@/store/customer-journey-store";

const PACKAGE_TIERS: Array<{
  id: PackageTier;
  label: string;
  price: string;
  summary: string;
}> = [
  {
    id: "bronze",
    label: "Bronze",
    price: "$499/mo",
    summary: "Core suite coverage for teams that need structure and speed.",
  },
  {
    id: "silver",
    label: "Silver",
    price: "$999/mo",
    summary: "Expanded execution with tighter response windows and reporting.",
  },
  {
    id: "premium",
    label: "Premium",
    price: "$1,799/mo",
    summary: "Enterprise controls, proactive alerts, and fastest turnaround.",
  },
];

type OnboardingForm = {
  businessTitle: string;
  businessSummary: string;
  companyType: "llc" | "corporation" | "partnership";
  employees: "1-20" | "21-49" | "50+";
  country: string;
  city: string;
  inventoryHandling: "in_house" | "third_party" | "none";
  regions: Array<"domestic" | "cross_border">;
  regulated: boolean;
  agreeToTerms: boolean;
};

const INITIAL_FORM: OnboardingForm = {
  businessTitle: "",
  businessSummary: "",
  companyType: "llc",
  employees: "1-20",
  country: "",
  city: "",
  inventoryHandling: "in_house",
  regions: ["domestic"],
  regulated: false,
  agreeToTerms: false,
};

const STEPS = [
  "Select package",
  "Complete payment",
  "Business overview",
  "Operational profile",
  "Confirm and submit",
] as const;

export default function CustomerOnboardingPage() {
  const searchParams = useSearchParams();
  const {
    packageTier,
    paid,
    onboardingCompleted,
    onboardingSnapshot,
    suiteRequests,
    selectPackage,
    completePayment,
    completeOnboarding,
  } = useCustomerJourneyStore();

  const [currentStep, setCurrentStep] = useState(1);
  const [showCompletedFlow, setShowCompletedFlow] = useState(false);
  const [completedFlowStep, setCompletedFlowStep] = useState(1);
  const [form, setForm] = useState<OnboardingForm>(INITIAL_FORM);

  useEffect(() => {
    const tierFromUrl = searchParams.get("tier");
    if (packageTier || !tierFromUrl) {
      return;
    }

    const matchedTier = PACKAGE_TIERS.find((tier) => tier.id === tierFromUrl);
    if (matchedTier) {
      selectPackage(matchedTier.id);
      setCurrentStep(2);
    }
  }, [packageTier, searchParams, selectPackage]);

  useEffect(() => {
    if (!packageTier) {
      setCurrentStep(1);
      return;
    }

    if (!paid) {
      setCurrentStep((step) => (step > 2 ? 2 : Math.max(step, 2)));
      return;
    }

    setCurrentStep((step) => (step < 3 ? 3 : step));
  }, [packageTier, paid]);

  const isBusinessStepComplete =
    form.businessTitle.trim().length > 1 &&
    form.businessSummary.trim().length > 2 &&
    form.country.trim().length > 1 &&
    form.city.trim().length > 1;

  const missingBusinessFields: string[] = [];
  if (form.businessTitle.trim().length <= 1) {
    missingBusinessFields.push("Business title");
  }
  if (form.businessSummary.trim().length <= 2) {
    missingBusinessFields.push("Business summary");
  }
  if (form.country.trim().length <= 1) {
    missingBusinessFields.push("Country");
  }
  if (form.city.trim().length <= 1) {
    missingBusinessFields.push("City");
  }

  const isOperationsStepComplete = form.regions.length > 0;
  const isConfirmStepComplete = form.agreeToTerms;

  const canContinue = useMemo(() => {
    if (currentStep === 1) {
      return Boolean(packageTier);
    }
    if (currentStep === 2) {
      return paid;
    }
    if (currentStep === 3) {
      return isBusinessStepComplete;
    }
    if (currentStep === 4) {
      return isOperationsStepComplete;
    }
    if (currentStep === 5) {
      return isConfirmStepComplete;
    }
    return false;
  }, [
    currentStep,
    packageTier,
    paid,
    isBusinessStepComplete,
    isOperationsStepComplete,
    isConfirmStepComplete,
  ]);

  const renderStepContent = () => {
    if (currentStep === 1) {
      return (
        <div className="space-y-5">
          <div>
            <h3 className="text-xl font-semibold text-white">
              Select your package
            </h3>
            <p className="mt-1 text-sm text-slate-300">
              Start by choosing the package that fits your operating depth.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {PACKAGE_TIERS.map((tier) => {
              const selected = packageTier === tier.id;
              return (
                <button
                  key={tier.id}
                  type="button"
                  onClick={() => selectPackage(tier.id)}
                  className={`rounded-2xl border p-4 text-left transition ${
                    selected
                      ? "border-coral bg-coral/10"
                      : "border-white/15 bg-white/5 hover:border-white/30"
                  }`}
                >
                  <p className="text-lg font-semibold text-white">
                    {tier.label}
                  </p>
                  <p className="mt-1 text-2xl font-semibold text-cyan-200">
                    {tier.price}
                  </p>
                  <p className="mt-2 text-sm text-slate-300">{tier.summary}</p>
                  <p className="mt-3 text-xs uppercase tracking-[0.12em] text-slate-400">
                    {selected ? "Selected" : "Click to select"}
                  </p>
                </button>
              );
            })}
          </div>
        </div>
      );
    }

    if (currentStep === 2) {
      return (
        <div className="space-y-5">
          <div>
            <h3 className="text-xl font-semibold text-white">Payment</h3>
            <p className="mt-1 text-sm text-slate-300">
              Confirm your package and continue to the onboarding form.
            </p>
          </div>

          <div className="rounded-2xl border border-white/15 bg-white/5 p-4">
            <p className="text-sm text-slate-300">Selected package</p>
            <p className="mt-1 text-xl font-semibold text-white">
              {packageTier ? packageTier.toUpperCase() : "Not selected"}
            </p>
            <p className="mt-2 text-sm text-slate-300">
              Payment is mocked in this environment.
            </p>
            <div className="mt-4">
              <Button onClick={completePayment} disabled={paid || !packageTier}>
                {paid ? "Payment completed" : "Pay for package"}
              </Button>
            </div>
          </div>
        </div>
      );
    }

    if (currentStep === 3) {
      return (
        <div className="space-y-5">
          <div>
            <h3 className="text-xl font-semibold text-white">
              About your business
            </h3>
            <p className="mt-1 text-sm text-slate-300">
              Tell us the basics to configure your account properly.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-1 text-sm text-slate-200 md:col-span-2">
              <span>Business title *</span>
              <input
                type="text"
                value={form.businessTitle}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    businessTitle: event.target.value,
                  }))
                }
                className="h-11 w-full rounded-xl border border-white/20 bg-white/5 px-3 text-sm text-white"
                placeholder="Example: BluBook Commerce"
              />
            </label>

            <label className="space-y-1 text-sm text-slate-200 md:col-span-2">
              <span>Business summary *</span>
              <textarea
                value={form.businessSummary}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    businessSummary: event.target.value,
                  }))
                }
                className="min-h-24 w-full rounded-xl border border-white/20 bg-white/5 px-3 py-2 text-sm text-white"
                placeholder="What does your business do?"
              />
            </label>

            <label className="space-y-1 text-sm text-slate-200">
              <span>Company type</span>
              <select
                value={form.companyType}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    companyType: event.target
                      .value as OnboardingForm["companyType"],
                  }))
                }
                className="h-11 w-full rounded-xl border border-white/20 bg-slate-900 px-3 text-sm text-white"
              >
                <option value="llc">LLC</option>
                <option value="corporation">Corporation</option>
                <option value="partnership">Partnership</option>
              </select>
            </label>

            <label className="space-y-1 text-sm text-slate-200">
              <span>Employees</span>
              <select
                value={form.employees}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    employees: event.target
                      .value as OnboardingForm["employees"],
                  }))
                }
                className="h-11 w-full rounded-xl border border-white/20 bg-slate-900 px-3 text-sm text-white"
              >
                <option value="1-20">1-20</option>
                <option value="21-49">21-49</option>
                <option value="50+">50+</option>
              </select>
            </label>

            <label className="space-y-1 text-sm text-slate-200">
              <span>Country *</span>
              <input
                type="text"
                value={form.country}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    country: event.target.value,
                  }))
                }
                className="h-11 w-full rounded-xl border border-white/20 bg-white/5 px-3 text-sm text-white"
                placeholder="Country"
              />
            </label>

            <label className="space-y-1 text-sm text-slate-200">
              <span>City *</span>
              <input
                type="text"
                value={form.city}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    city: event.target.value,
                  }))
                }
                className="h-11 w-full rounded-xl border border-white/20 bg-white/5 px-3 text-sm text-white"
                placeholder="City"
              />
            </label>

            {!isBusinessStepComplete ? (
              <p className="text-sm text-amber-300 md:col-span-2">
                Fill required fields to continue:{" "}
                {missingBusinessFields.join(", ")}.
              </p>
            ) : null}
          </div>
        </div>
      );
    }

    if (currentStep === 4) {
      return (
        <div className="space-y-5">
          <div>
            <h3 className="text-xl font-semibold text-white">
              Operational profile
            </h3>
            <p className="mt-1 text-sm text-slate-300">
              Configure inventory handling and operating regions.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-1 text-sm text-slate-200">
              <span>Inventory handling</span>
              <select
                value={form.inventoryHandling}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    inventoryHandling: event.target
                      .value as OnboardingForm["inventoryHandling"],
                  }))
                }
                className="h-11 w-full rounded-xl border border-white/20 bg-slate-900 px-3 text-sm text-white"
              >
                <option value="in_house">In-house</option>
                <option value="third_party">Third-party</option>
                <option value="none">No inventory</option>
              </select>
            </label>

            <div className="space-y-2 text-sm text-slate-200">
              <p>Regions served</p>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.regions.includes("domestic")}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      regions: event.target.checked
                        ? Array.from(new Set([...current.regions, "domestic"]))
                        : current.regions.filter(
                            (region) => region !== "domestic",
                          ),
                    }))
                  }
                />
                <span>Domestic</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.regions.includes("cross_border")}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      regions: event.target.checked
                        ? Array.from(
                            new Set([...current.regions, "cross_border"]),
                          )
                        : current.regions.filter(
                            (region) => region !== "cross_border",
                          ),
                    }))
                  }
                />
                <span>Cross-border</span>
              </label>
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm text-slate-200">
            <input
              type="checkbox"
              checked={form.regulated}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  regulated: event.target.checked,
                }))
              }
            />
            <span>Regulated compliance context</span>
          </label>
        </div>
      );
    }

    return (
      <div className="space-y-5">
        <div>
          <h3 className="text-xl font-semibold text-white">
            Confirm and submit
          </h3>
          <p className="mt-1 text-sm text-slate-300">
            Review your setup and continue to your dashboard.
          </p>
        </div>

        <div className="rounded-2xl border border-white/15 bg-white/5 p-4 text-sm text-slate-200">
          <p>Package: {packageTier?.toUpperCase()}</p>
          <p>Payment: {paid ? "Completed" : "Pending"}</p>
          <p>Business: {form.businessTitle || "Not provided"}</p>
          <p>
            Regions:{" "}
            {form.regions.length > 0 ? form.regions.join(", ") : "Not provided"}
          </p>
        </div>

        <label className="flex items-start gap-2 text-sm text-slate-200">
          <input
            type="checkbox"
            checked={form.agreeToTerms}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                agreeToTerms: event.target.checked,
              }))
            }
            className="mt-1"
          />
          <span>I confirm the onboarding information is accurate.</span>
        </label>
      </div>
    );
  };

  const onContinue = () => {
    if (!canContinue) {
      return;
    }

    if (currentStep === 5) {
      const snapshot: OnboardingSnapshot = {
        businessTitle: form.businessTitle.trim(),
        businessSummary: form.businessSummary.trim(),
        companyType: form.companyType,
        employees: form.employees,
        country: form.country.trim(),
        city: form.city.trim(),
        inventoryHandling: form.inventoryHandling,
        regions: form.regions,
        regulated: form.regulated,
        submittedAt: new Date().toISOString(),
      };

      completeOnboarding(snapshot);
      return;
    }

    setCurrentStep((step) => Math.min(step + 1, 5));
  };

  const onBack = () => {
    setCurrentStep((step) => Math.max(step - 1, 1));
  };

  const renderCompletedFlowStepContent = () => {
    const snapshot = onboardingSnapshot;

    if (completedFlowStep === 1) {
      return (
        <div className="space-y-5">
          <div>
            <h3 className="text-xl font-semibold text-white">Select package</h3>
            <p className="mt-1 text-sm text-slate-300">
              Read-only replay of your selected tier.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {PACKAGE_TIERS.map((tier) => {
              const selected = packageTier === tier.id;
              return (
                <div
                  key={tier.id}
                  className={`rounded-2xl border p-4 text-left ${
                    selected
                      ? "border-coral bg-coral/10"
                      : "border-white/15 bg-white/5"
                  }`}
                >
                  <p className="text-lg font-semibold text-white">
                    {tier.label}
                  </p>
                  <p className="mt-1 text-2xl font-semibold text-cyan-200">
                    {tier.price}
                  </p>
                  <p className="mt-2 text-sm text-slate-300">{tier.summary}</p>
                  <p className="mt-3 text-xs uppercase tracking-[0.12em] text-slate-400">
                    {selected ? "Selected" : "Not selected"}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      );
    }

    if (completedFlowStep === 2) {
      return (
        <div className="space-y-5">
          <div>
            <h3 className="text-xl font-semibold text-white">
              Complete payment
            </h3>
            <p className="mt-1 text-sm text-slate-300">
              Payment step as completed during onboarding.
            </p>
          </div>

          <div className="rounded-2xl border border-white/15 bg-white/5 p-4">
            <p className="text-sm text-slate-300">Selected package</p>
            <p className="mt-1 text-xl font-semibold text-white">
              {packageTier ? packageTier.toUpperCase() : "Not selected"}
            </p>
            <p className="mt-2 text-sm text-slate-300">
              Payment: {paid ? "Completed" : "Pending"}
            </p>
          </div>
        </div>
      );
    }

    if (completedFlowStep === 3) {
      return (
        <div className="space-y-5">
          <div>
            <h3 className="text-xl font-semibold text-white">
              Business overview
            </h3>
            <p className="mt-1 text-sm text-slate-300">
              Submitted business profile.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-1 text-sm text-slate-200 md:col-span-2">
              <span>Business title</span>
              <input
                type="text"
                value={snapshot?.businessTitle || ""}
                disabled
                className="h-11 w-full rounded-xl border border-white/20 bg-white/5 px-3 text-sm text-white/90"
              />
            </label>
            <label className="space-y-1 text-sm text-slate-200 md:col-span-2">
              <span>Business summary</span>
              <textarea
                value={snapshot?.businessSummary || ""}
                disabled
                className="min-h-24 w-full rounded-xl border border-white/20 bg-white/5 px-3 py-2 text-sm text-white/90"
              />
            </label>
            <label className="space-y-1 text-sm text-slate-200">
              <span>Company type</span>
              <input
                type="text"
                value={snapshot?.companyType || ""}
                disabled
                className="h-11 w-full rounded-xl border border-white/20 bg-white/5 px-3 text-sm text-white/90"
              />
            </label>
            <label className="space-y-1 text-sm text-slate-200">
              <span>Employees</span>
              <input
                type="text"
                value={snapshot?.employees || ""}
                disabled
                className="h-11 w-full rounded-xl border border-white/20 bg-white/5 px-3 text-sm text-white/90"
              />
            </label>
            <label className="space-y-1 text-sm text-slate-200">
              <span>Country</span>
              <input
                type="text"
                value={snapshot?.country || ""}
                disabled
                className="h-11 w-full rounded-xl border border-white/20 bg-white/5 px-3 text-sm text-white/90"
              />
            </label>
            <label className="space-y-1 text-sm text-slate-200">
              <span>City</span>
              <input
                type="text"
                value={snapshot?.city || ""}
                disabled
                className="h-11 w-full rounded-xl border border-white/20 bg-white/5 px-3 text-sm text-white/90"
              />
            </label>
          </div>
        </div>
      );
    }

    if (completedFlowStep === 4) {
      return (
        <div className="space-y-5">
          <div>
            <h3 className="text-xl font-semibold text-white">
              Operational profile
            </h3>
            <p className="mt-1 text-sm text-slate-300">
              Submitted operations data.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-1 text-sm text-slate-200">
              <span>Inventory handling</span>
              <input
                type="text"
                value={snapshot?.inventoryHandling || ""}
                disabled
                className="h-11 w-full rounded-xl border border-white/20 bg-white/5 px-3 text-sm text-white/90"
              />
            </label>

            <div className="space-y-2 text-sm text-slate-200">
              <p>Regions served</p>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={Boolean(snapshot?.regions?.includes("domestic"))}
                  readOnly
                />
                <span>Domestic</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={Boolean(snapshot?.regions?.includes("cross_border"))}
                  readOnly
                />
                <span>Cross-border</span>
              </label>
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm text-slate-200">
            <input
              type="checkbox"
              checked={Boolean(snapshot?.regulated)}
              readOnly
            />
            <span>Regulated compliance context</span>
          </label>
        </div>
      );
    }

    return (
      <div className="space-y-5">
        <div>
          <h3 className="text-xl font-semibold text-white">
            Confirm and submit
          </h3>
          <p className="mt-1 text-sm text-slate-300">
            Final submitted confirmation details.
          </p>
        </div>

        <div className="rounded-2xl border border-white/15 bg-white/5 p-4 text-sm text-slate-200">
          <p>Package: {packageTier?.toUpperCase()}</p>
          <p>Payment: {paid ? "Completed" : "Pending"}</p>
          <p>Business: {snapshot?.businessTitle || "Not provided"}</p>
          <p>Regions: {snapshot?.regions?.join(", ") || "Not provided"}</p>
          <p>
            Submitted:{" "}
            {snapshot?.submittedAt
              ? new Date(snapshot.submittedAt).toLocaleString()
              : "Unknown"}
          </p>
        </div>

        <label className="flex items-start gap-2 text-sm text-slate-200">
          <input type="checkbox" checked readOnly className="mt-1" />
          <span>I confirm the onboarding information is accurate.</span>
        </label>
      </div>
    );
  };

  if (onboardingCompleted) {
    return (
      <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col py-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-4xl font-semibold text-white">
            Onboarding Summary
          </h2>
          <Button onClick={() => setShowCompletedFlow((open) => !open)}>
            {showCompletedFlow
              ? "Hide onboarding flow"
              : "View onboarding flow"}
          </Button>
        </div>

        <p className="mt-2 text-sm text-slate-300">
          Submitted onboarding details are locked and view-only.
        </p>

        {showCompletedFlow ? (
          <section className="mt-4 grid gap-6 lg:grid-cols-[260px_1fr]">
            <aside className="rounded-2xl border border-white/15 bg-white/5 p-4">
              <ol className="space-y-3">
                {STEPS.map((label, index) => {
                  const stepNumber = index + 1;
                  const isDone = stepNumber < completedFlowStep;
                  const isActive = stepNumber === completedFlowStep;

                  return (
                    <li key={label} className="flex items-start gap-3">
                      <span
                        className={`mt-0.5 inline-flex h-6 w-6 items-center justify-center rounded-full border text-xs font-semibold ${
                          isDone
                            ? "border-cyan-300 bg-cyan-300 text-slate-900"
                            : isActive
                              ? "border-coral bg-coral text-white"
                              : "border-white/25 text-slate-300"
                        }`}
                      >
                        {stepNumber}
                      </span>
                      <div>
                        <p
                          className={`text-sm ${isActive ? "text-white" : "text-slate-300"}`}
                        >
                          {label}
                        </p>
                        <p className="text-xs text-slate-400">
                          {isDone ? "Done" : isActive ? "Current" : "Pending"}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </aside>

            <div className="rounded-2xl border border-white/15 bg-white/5 p-5 md:p-6">
              {renderCompletedFlowStepContent()}

              <div className="mt-8 flex items-center justify-between">
                <Button
                  variant="ghost"
                  onClick={() =>
                    setCompletedFlowStep((step) => Math.max(step - 1, 1))
                  }
                  disabled={completedFlowStep === 1}
                >
                  Back
                </Button>
                <Button
                  onClick={() =>
                    setCompletedFlowStep((step) => Math.min(step + 1, 5))
                  }
                  disabled={completedFlowStep === 5}
                >
                  Next
                </Button>
              </div>
            </div>
          </section>
        ) : null}

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <section className="rounded-2xl border border-white/15 bg-white/5 p-5">
            <h3 className="text-lg font-semibold text-white">
              Business Profile
            </h3>
            <div className="mt-3 space-y-2 text-sm text-slate-200">
              <p>
                Business title:{" "}
                {onboardingSnapshot?.businessTitle || "Not captured"}
              </p>
              <p>
                Summary: {onboardingSnapshot?.businessSummary || "Not captured"}
              </p>
              <p>
                Company type:{" "}
                {onboardingSnapshot?.companyType || "Not captured"}
              </p>
              <p>
                Employees: {onboardingSnapshot?.employees || "Not captured"}
              </p>
              <p>Country: {onboardingSnapshot?.country || "Not captured"}</p>
              <p>City: {onboardingSnapshot?.city || "Not captured"}</p>
            </div>
          </section>

          <section className="rounded-2xl border border-white/15 bg-white/5 p-5">
            <h3 className="text-lg font-semibold text-white">
              Operational Profile
            </h3>
            <div className="mt-3 space-y-2 text-sm text-slate-200">
              <p>
                Package:{" "}
                {packageTier ? packageTier.toUpperCase() : "Not selected"}
              </p>
              <p>Payment: {paid ? "Completed" : "Pending"}</p>
              <p>
                Inventory handling:{" "}
                {onboardingSnapshot?.inventoryHandling || "Not captured"}
              </p>
              <p>
                Regions:{" "}
                {onboardingSnapshot?.regions?.join(", ") || "Not captured"}
              </p>
              <p>Regulated: {onboardingSnapshot?.regulated ? "Yes" : "No"}</p>
              <p>
                Submitted:{" "}
                {onboardingSnapshot?.submittedAt
                  ? new Date(onboardingSnapshot.submittedAt).toLocaleString()
                  : "Unknown"}
              </p>
            </div>
          </section>
        </div>

        <section className="mt-4 rounded-2xl border border-white/15 bg-white/5 p-5">
          <h3 className="text-lg font-semibold text-white">
            Activated Suite Requests
          </h3>
          <div className="mt-3 space-y-2 text-sm text-slate-200">
            {suiteRequests.map((item) => (
              <div
                key={item.id}
                className="rounded-xl border border-white/10 bg-white/5 p-3"
              >
                <p className="font-semibold text-white">{item.title}</p>
                <p className="mt-1 text-xs text-slate-300">
                  Required docs: {item.requiredDocs.join(", ")}
                </p>
              </div>
            ))}
            {suiteRequests.length === 0 ? (
              <p className="text-sm text-slate-300">
                No suite requests generated.
              </p>
            ) : null}
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col justify-center py-10">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-4xl font-semibold text-white">
            Customer Onboarding
          </h2>
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[260px_1fr]">
        <aside className="rounded-2xl border border-white/15 bg-white/5 p-4">
          <ol className="space-y-3">
            {STEPS.map((label, index) => {
              const stepNumber = index + 1;
              const isDone = stepNumber < currentStep;
              const isActive = stepNumber === currentStep;

              return (
                <li key={label} className="flex items-start gap-3">
                  <span
                    className={`mt-0.5 inline-flex h-6 w-6 items-center justify-center rounded-full border text-xs font-semibold ${
                      isDone
                        ? "border-cyan-300 bg-cyan-300 text-slate-900"
                        : isActive
                          ? "border-coral bg-coral text-white"
                          : "border-white/25 text-slate-300"
                    }`}
                  >
                    {stepNumber}
                  </span>
                  <div>
                    <p
                      className={`text-sm ${isActive ? "text-white" : "text-slate-300"}`}
                    >
                      {label}
                    </p>
                    <p className="text-xs text-slate-400">
                      {isDone ? "Done" : isActive ? "Current" : "Pending"}
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>
        </aside>

        <section className="rounded-2xl border border-white/15 bg-white/5 p-5 md:p-6">
          {renderStepContent()}

          <div className="mt-8 flex items-center justify-between">
            <Button
              variant="ghost"
              onClick={onBack}
              disabled={currentStep === 1}
            >
              Back
            </Button>
            <Button onClick={onContinue} disabled={!canContinue}>
              {currentStep === 5
                ? "Finish onboarding and continue to dashboard"
                : "Continue"}
            </Button>
          </div>

          {!canContinue && currentStep === 3 ? (
            <p className="mt-3 text-sm text-amber-300">
              Continue is disabled until required fields are completed.
            </p>
          ) : null}
        </section>
      </div>
    </div>
  );
}
