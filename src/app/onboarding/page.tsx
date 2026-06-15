"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { SelectMenu } from "@/components/ui/select-menu";
import { createClient } from "@/lib/supabase/browser";

type PackageOption = {
  id: string;
  label: string;
  price: string;
  summary: string;
};

type IndustryOption = {
  value: string;
  label: string;
  subIndustries: string[];
};

type BusinessModel =
  | "seller"
  | "reseller"
  | "distributor"
  | "manufacturer"
  | "marketplace"
  | "service_provider";

type CustomerSegment = "b2b" | "b2c" | "hybrid";

type SalesChannel =
  | "own_website"
  | "marketplace"
  | "retail"
  | "wholesale"
  | "social"
  | "direct_sales";

type InventoryModel = "own_stock" | "dropship" | "hybrid" | "none";

type FulfillmentModel = "in_house" | "third_party" | "hybrid";

type RevenueBand = "under_1m" | "1m_10m" | "10m_50m" | "50m_200m" | "200m_plus";

type OrderVolumeBand = "under_100" | "100_1000" | "1000_10000" | "10000_plus";

type OnboardingForm = {
  contactName: string;
  contactEmail: string;
  password: string;
  confirmPassword: string;
  businessTitle: string;
  businessSummary: string;
  primaryIndustry: string;
  subIndustry: string;
  businessModel: BusinessModel;
  customerSegment: CustomerSegment;
  companyType: "llc" | "corporation" | "partnership";
  employees: "1-20" | "21-49" | "50+";
  country: string;
  city: string;
  salesChannels: SalesChannel[];
  inventoryModel: InventoryModel;
  fulfillmentModel: FulfillmentModel;
  annualRevenueBand: RevenueBand;
  monthlyOrderVolumeBand: OrderVolumeBand;
  inventoryHandling: "in_house" | "third_party" | "none";
  regions: Array<"domestic" | "cross_border">;
  regulated: boolean;
  agreeToTerms: boolean;
};

const INITIAL_FORM: OnboardingForm = {
  contactName: "",
  contactEmail: "",
  password: "",
  confirmPassword: "",
  businessTitle: "",
  businessSummary: "",
  primaryIndustry: "",
  subIndustry: "",
  businessModel: "seller",
  customerSegment: "b2b",
  companyType: "llc",
  employees: "1-20",
  country: "",
  city: "",
  salesChannels: ["own_website"],
  inventoryModel: "own_stock",
  fulfillmentModel: "in_house",
  annualRevenueBand: "under_1m",
  monthlyOrderVolumeBand: "under_100",
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
  "Create account and submit",
] as const;

export default function CustomerOnboardingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [packageOptions, setPackageOptions] = useState<PackageOption[]>([]);
  const [packageLoadError, setPackageLoadError] = useState<string | null>(null);
  const [industryOptions, setIndustryOptions] = useState<IndustryOption[]>([]);
  const [industryLoadError, setIndustryLoadError] = useState<string | null>(
    null,
  );
  const [selectedPackageTier, setSelectedPackageTier] = useState<string | null>(
    null,
  );
  const [paid, setPaid] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [form, setForm] = useState<OnboardingForm>(INITIAL_FORM);
  const [submitStatus, setSubmitStatus] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let active = true;
    const loadOnboardingCatalog = async () => {
      const supabase = createClient();
      const [packageResult, industryResult] = await Promise.all([
        supabase
          .from("service_packages")
          .select("code, name, description, unit_amount_cents, metadata")
          .eq("is_active", true)
          .order("unit_amount_cents", { ascending: true }),
        supabase
          .from("industry_taxonomy")
          .select("primary_industry, sub_industry, sort_order")
          .eq("is_active", true)
          .order("sort_order", { ascending: true })
          .order("primary_industry", { ascending: true })
          .order("sub_industry", { ascending: true }),
      ]);

      if (!active) {
        return;
      }

      if (packageResult.error) {
        setPackageLoadError(packageResult.error.message);
      } else {
        setPackageLoadError(null);

        const options = (packageResult.data ?? [])
          .map((item) => {
            const packageCode = String(item.code ?? "").trim();
            if (!packageCode) {
              return null;
            }

            const displayFromMetadata =
              typeof item.metadata === "object" &&
              item.metadata !== null &&
              "display_price" in item.metadata
                ? String(
                    (item.metadata as { display_price?: string }).display_price,
                  )
                : null;

            const formattedPrice = displayFromMetadata
              ? displayFromMetadata
              : `R${new Intl.NumberFormat("en-ZA").format(item.unit_amount_cents / 100)}/mo`;

            return {
              id: packageCode,
              label: item.name,
              price: formattedPrice,
              summary:
                item.description ??
                "Configurable service coverage aligned to your operating model.",
            } as PackageOption;
          })
          .filter((item): item is PackageOption => Boolean(item));

        setPackageOptions(options);
      }

      if (industryResult.error) {
        setIndustryLoadError(industryResult.error.message);
      } else {
        setIndustryLoadError(null);
        const grouped = new Map<string, string[]>();

        for (const row of industryResult.data ?? []) {
          const primaryIndustry = String(row.primary_industry ?? "").trim();
          const subIndustry = String(row.sub_industry ?? "").trim();

          if (!primaryIndustry || !subIndustry) {
            continue;
          }

          const existing = grouped.get(primaryIndustry) ?? [];
          if (!existing.includes(subIndustry)) {
            grouped.set(primaryIndustry, [...existing, subIndustry]);
          }
        }

        const options = Array.from(grouped.entries()).map(
          ([primaryIndustry, subIndustries]) => ({
            value: primaryIndustry,
            label: primaryIndustry,
            subIndustries,
          }),
        );

        setIndustryOptions(options);
      }
    };

    void loadOnboardingCatalog();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const tierFromUrl = searchParams.get("tier");
    if (selectedPackageTier || !tierFromUrl) {
      return;
    }

    const matchedTier = packageOptions.find((tier) => tier.id === tierFromUrl);
    if (matchedTier) {
      setSelectedPackageTier(matchedTier.id);
      setCurrentStep(2);
    }
  }, [packageOptions, searchParams, selectedPackageTier]);

  useEffect(() => {
    if (!selectedPackageTier) {
      setCurrentStep(1);
      return;
    }

    if (!paid) {
      setCurrentStep((step) => (step > 2 ? 2 : Math.max(step, 2)));
      return;
    }

    setCurrentStep((step) => (step < 3 ? 3 : step));
  }, [selectedPackageTier, paid]);

  const isBusinessStepComplete =
    form.businessTitle.trim().length > 1 &&
    form.businessSummary.trim().length > 2 &&
    form.primaryIndustry.trim().length > 1 &&
    form.country.trim().length > 1 &&
    form.city.trim().length > 1;

  const missingBusinessFields: string[] = [];
  if (form.businessTitle.trim().length <= 1) {
    missingBusinessFields.push("Business title");
  }
  if (form.businessSummary.trim().length <= 2) {
    missingBusinessFields.push("Business summary");
  }
  if (form.primaryIndustry.trim().length <= 1) {
    missingBusinessFields.push("Primary industry");
  }
  if (form.country.trim().length <= 1) {
    missingBusinessFields.push("Country");
  }
  if (form.city.trim().length <= 1) {
    missingBusinessFields.push("City");
  }

  const isOperationsStepComplete =
    form.regions.length > 0 && form.salesChannels.length > 0;
  const normalizedContactEmail = form.contactEmail.trim().toLowerCase();
  const isAccountStepComplete =
    form.contactName.trim().length > 1 &&
    normalizedContactEmail.length > 3 &&
    normalizedContactEmail.includes("@") &&
    form.password.length >= 8 &&
    form.password === form.confirmPassword &&
    form.agreeToTerms;

  const missingAccountFields: string[] = [];
  if (form.contactName.trim().length <= 1) {
    missingAccountFields.push("Full name");
  }
  if (
    normalizedContactEmail.length <= 3 ||
    !normalizedContactEmail.includes("@")
  ) {
    missingAccountFields.push("Email");
  }
  if (form.password.length < 8) {
    missingAccountFields.push("Password (min 8 characters)");
  }
  if (form.password !== form.confirmPassword) {
    missingAccountFields.push("Password confirmation");
  }
  if (!form.agreeToTerms) {
    missingAccountFields.push("Confirmation checkbox");
  }

  const canContinue = useMemo(() => {
    if (currentStep === 1) {
      return Boolean(selectedPackageTier);
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
      return isAccountStepComplete;
    }
    return false;
  }, [
    currentStep,
    selectedPackageTier,
    paid,
    isBusinessStepComplete,
    isOperationsStepComplete,
    isAccountStepComplete,
  ]);

  const selectedIndustry = useMemo(
    () =>
      industryOptions.find(
        (industry) => industry.value === form.primaryIndustry,
      ),
    [form.primaryIndustry, industryOptions],
  );

  const subIndustryOptions = selectedIndustry?.subIndustries ?? [];

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
            {packageOptions.map((tier) => {
              const selected = selectedPackageTier === tier.id;
              return (
                <button
                  key={tier.id}
                  type="button"
                  onClick={() => setSelectedPackageTier(tier.id)}
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
            {packageLoadError ? (
              <p className="text-sm text-red-300 md:col-span-3">
                Could not load packages from database: {packageLoadError}
              </p>
            ) : null}
            {!packageLoadError && packageOptions.length === 0 ? (
              <p className="text-sm text-slate-300 md:col-span-3">
                No active packages found.
              </p>
            ) : null}
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
              {packageOptions.find((tier) => tier.id === selectedPackageTier)
                ?.label ?? "Not selected"}
            </p>
            <p className="mt-2 text-sm text-slate-300">
              Confirm payment to continue with onboarding setup.
            </p>
            <div className="mt-4">
              <Button
                onClick={() => setPaid(true)}
                disabled={paid || !selectedPackageTier}
              >
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
              <SelectMenu
                value={form.companyType}
                onChange={(nextValue) =>
                  setForm((current) => ({
                    ...current,
                    companyType: nextValue as OnboardingForm["companyType"],
                  }))
                }
                options={[
                  { value: "llc", label: "LLC" },
                  { value: "corporation", label: "Corporation" },
                  { value: "partnership", label: "Partnership" },
                ]}
              />
            </label>

            <label className="space-y-1 text-sm text-slate-200">
              <span>Employees</span>
              <SelectMenu
                value={form.employees}
                onChange={(nextValue) =>
                  setForm((current) => ({
                    ...current,
                    employees: nextValue as OnboardingForm["employees"],
                  }))
                }
                options={[
                  { value: "1-20", label: "1-20" },
                  { value: "21-49", label: "21-49" },
                  { value: "50+", label: "50+" },
                ]}
              />
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

            <label className="space-y-1 text-sm text-slate-200">
              <span>Primary industry *</span>
              <SelectMenu
                value={form.primaryIndustry}
                placeholder="Select primary industry"
                onChange={(nextValue) =>
                  setForm((current) => ({
                    ...current,
                    primaryIndustry: nextValue,
                    subIndustry: "",
                  }))
                }
                options={industryOptions.map((industry) => ({
                  value: industry.value,
                  label: industry.label,
                }))}
              />
              {industryLoadError ? (
                <p className="text-xs text-slate-300">
                  Could not load industries from database: {industryLoadError}
                </p>
              ) : null}
            </label>

            <label className="space-y-1 text-sm text-slate-200">
              <span>Sub-industry</span>
              <SelectMenu
                value={form.subIndustry}
                onChange={(nextValue) =>
                  setForm((current) => ({
                    ...current,
                    subIndustry: nextValue,
                  }))
                }
                disabled={!form.primaryIndustry}
                placeholder={
                  form.primaryIndustry
                    ? "Select sub-industry"
                    : "Select primary industry first"
                }
                options={subIndustryOptions.map((subIndustry) => ({
                  value: subIndustry,
                  label: subIndustry,
                }))}
              />
            </label>

            <label className="space-y-1 text-sm text-slate-200">
              <span>Business model</span>
              <SelectMenu
                value={form.businessModel}
                onChange={(nextValue) =>
                  setForm((current) => ({
                    ...current,
                    businessModel: nextValue as BusinessModel,
                  }))
                }
                options={[
                  { value: "seller", label: "Seller" },
                  { value: "reseller", label: "Reseller" },
                  { value: "distributor", label: "Distributor" },
                  { value: "manufacturer", label: "Manufacturer" },
                  { value: "marketplace", label: "Marketplace" },
                  { value: "service_provider", label: "Service provider" },
                ]}
              />
            </label>

            <label className="space-y-1 text-sm text-slate-200">
              <span>Customer segment</span>
              <SelectMenu
                value={form.customerSegment}
                onChange={(nextValue) =>
                  setForm((current) => ({
                    ...current,
                    customerSegment: nextValue as CustomerSegment,
                  }))
                }
                options={[
                  { value: "b2b", label: "B2B" },
                  { value: "b2c", label: "B2C" },
                  { value: "hybrid", label: "Hybrid" },
                ]}
              />
            </label>

            {!isBusinessStepComplete ? (
              <p className="text-sm text-slate-300 md:col-span-2">
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
              <SelectMenu
                value={form.inventoryHandling}
                onChange={(nextValue) =>
                  setForm((current) => ({
                    ...current,
                    inventoryHandling:
                      nextValue as OnboardingForm["inventoryHandling"],
                  }))
                }
                options={[
                  { value: "in_house", label: "In-house" },
                  { value: "third_party", label: "Third-party" },
                  { value: "none", label: "No inventory" },
                ]}
              />
            </label>

            <label className="space-y-1 text-sm text-slate-200">
              <span>Inventory model</span>
              <SelectMenu
                value={form.inventoryModel}
                onChange={(nextValue) =>
                  setForm((current) => ({
                    ...current,
                    inventoryModel: nextValue as InventoryModel,
                  }))
                }
                options={[
                  { value: "own_stock", label: "Own stock" },
                  { value: "dropship", label: "Dropship" },
                  { value: "hybrid", label: "Hybrid" },
                  { value: "none", label: "None" },
                ]}
              />
            </label>

            <label className="space-y-1 text-sm text-slate-200">
              <span>Fulfillment model</span>
              <SelectMenu
                value={form.fulfillmentModel}
                onChange={(nextValue) =>
                  setForm((current) => ({
                    ...current,
                    fulfillmentModel: nextValue as FulfillmentModel,
                  }))
                }
                options={[
                  { value: "in_house", label: "In-house" },
                  { value: "third_party", label: "Third-party" },
                  { value: "hybrid", label: "Hybrid" },
                ]}
              />
            </label>

            <label className="space-y-1 text-sm text-slate-200">
              <span>Annual revenue band</span>
              <SelectMenu
                value={form.annualRevenueBand}
                onChange={(nextValue) =>
                  setForm((current) => ({
                    ...current,
                    annualRevenueBand: nextValue as RevenueBand,
                  }))
                }
                options={[
                  { value: "under_1m", label: "Under R1m" },
                  { value: "1m_10m", label: "R1m - R10m" },
                  { value: "10m_50m", label: "R10m - R50m" },
                  { value: "50m_200m", label: "R50m - R200m" },
                  { value: "200m_plus", label: "R200m+" },
                ]}
              />
            </label>

            <label className="space-y-1 text-sm text-slate-200">
              <span>Monthly order volume band</span>
              <SelectMenu
                value={form.monthlyOrderVolumeBand}
                onChange={(nextValue) =>
                  setForm((current) => ({
                    ...current,
                    monthlyOrderVolumeBand: nextValue as OrderVolumeBand,
                  }))
                }
                options={[
                  { value: "under_100", label: "Under 100 orders" },
                  { value: "100_1000", label: "100 - 1,000 orders" },
                  { value: "1000_10000", label: "1,000 - 10,000 orders" },
                  { value: "10000_plus", label: "10,000+ orders" },
                ]}
              />
            </label>

            <div className="space-y-2 text-sm text-slate-200 md:col-span-2">
              <p>Sales channels</p>
              {[
                ["own_website", "Own website"],
                ["marketplace", "Marketplace"],
                ["retail", "Retail"],
                ["wholesale", "Wholesale"],
                ["social", "Social"],
                ["direct_sales", "Direct sales"],
              ].map(([value, label]) => (
                <label key={value} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={form.salesChannels.includes(value as SalesChannel)}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        salesChannels: event.target.checked
                          ? Array.from(
                              new Set([
                                ...current.salesChannels,
                                value as SalesChannel,
                              ]),
                            )
                          : current.salesChannels.filter(
                              (channel) => channel !== value,
                            ),
                      }))
                    }
                  />
                  <span>{label}</span>
                </label>
              ))}
            </div>

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

          {form.salesChannels.length === 0 ? (
            <p className="text-sm text-slate-300">
              Select at least one sales channel to continue.
            </p>
          ) : null}
        </div>
      );
    }

    return (
      <div className="space-y-5">
        <div>
          <h3 className="text-xl font-semibold text-white">
            Create your customer account
          </h3>
          <p className="mt-1 text-sm text-slate-300">
            Finish onboarding by setting the account credentials you will use to
            sign in.
          </p>
        </div>

        <div className="rounded-2xl border border-white/15 bg-white/5 p-4 text-sm text-slate-200">
          <p>
            Package:{" "}
            {packageOptions.find((tier) => tier.id === selectedPackageTier)
              ?.label ?? "Not selected"}
          </p>
          <p>Payment: {paid ? "Completed" : "Pending"}</p>
          <p>Business: {form.businessTitle || "Not provided"}</p>
          <p>
            Industry: {form.primaryIndustry || "Not provided"}
            {form.subIndustry ? ` / ${form.subIndustry}` : ""}
          </p>
          <p>
            Model: {form.businessModel} ({form.customerSegment.toUpperCase()})
          </p>
          <p>
            Channels:{" "}
            {form.salesChannels.length > 0
              ? form.salesChannels.join(", ")
              : "Not provided"}
          </p>
          <p>
            Regions:{" "}
            {form.regions.length > 0 ? form.regions.join(", ") : "Not provided"}
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-1 text-sm text-slate-200 md:col-span-2">
            <span>Full name *</span>
            <input
              type="text"
              value={form.contactName}
              onChange={(event) => {
                setSubmitStatus(null);
                setForm((current) => ({
                  ...current,
                  contactName: event.target.value,
                }));
              }}
              className="h-11 w-full rounded-xl border border-white/20 bg-white/5 px-3 text-sm text-white"
              placeholder="Your full name"
            />
          </label>

          <label className="space-y-1 text-sm text-slate-200 md:col-span-2">
            <span>Email address *</span>
            <input
              type="email"
              value={form.contactEmail}
              onChange={(event) => {
                setSubmitStatus(null);
                setForm((current) => ({
                  ...current,
                  contactEmail: event.target.value,
                }));
              }}
              className="h-11 w-full rounded-xl border border-white/20 bg-white/5 px-3 text-sm text-white"
              placeholder="you@company.com"
            />
          </label>

          <label className="space-y-1 text-sm text-slate-200">
            <span>Password *</span>
            <input
              type="password"
              value={form.password}
              onChange={(event) => {
                setSubmitStatus(null);
                setForm((current) => ({
                  ...current,
                  password: event.target.value,
                }));
              }}
              className="h-11 w-full rounded-xl border border-white/20 bg-white/5 px-3 text-sm text-white"
              placeholder="Create password"
            />
          </label>

          <label className="space-y-1 text-sm text-slate-200">
            <span>Confirm password *</span>
            <input
              type="password"
              value={form.confirmPassword}
              onChange={(event) => {
                setSubmitStatus(null);
                setForm((current) => ({
                  ...current,
                  confirmPassword: event.target.value,
                }));
              }}
              className="h-11 w-full rounded-xl border border-white/20 bg-white/5 px-3 text-sm text-white"
              placeholder="Confirm password"
            />
          </label>
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
          <span>
            I confirm the onboarding information is accurate and I want this
            email/password to activate my customer account.
          </span>
        </label>

        {!isAccountStepComplete ? (
          <p className="text-sm text-slate-300">
            Finish account setup to submit: {missingAccountFields.join(", ")}.
          </p>
        ) : null}
        {submitStatus ? (
          <p className="text-sm text-red-300">{submitStatus}</p>
        ) : null}
      </div>
    );
  };

  const onContinue = async () => {
    if (!canContinue) {
      return;
    }

    if (currentStep === 5) {
      setSubmitting(true);
      setSubmitStatus(null);

      const createAccountResponse = await fetch("/api/auth/customer-account", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: normalizedContactEmail,
          password: form.password,
          fullName: form.contactName.trim(),
          packageTier: selectedPackageTier,
          onboarding: {
            businessTitle: form.businessTitle.trim(),
            businessSummary: form.businessSummary.trim(),
            primaryIndustry: form.primaryIndustry.trim(),
            subIndustry: form.subIndustry.trim() || null,
            businessModel: form.businessModel,
            customerSegment: form.customerSegment,
            salesChannels: form.salesChannels,
            inventoryModel: form.inventoryModel,
            fulfillmentModel: form.fulfillmentModel,
            annualRevenueBand: form.annualRevenueBand,
            monthlyOrderVolumeBand: form.monthlyOrderVolumeBand,
            companyType: form.companyType,
            employees: form.employees,
            country: form.country.trim(),
            city: form.city.trim(),
            inventoryHandling: form.inventoryHandling,
            regions: form.regions,
            regulated: form.regulated,
          },
        }),
      });

      const createAccountResult = (await createAccountResponse.json()) as {
        error?: string;
      };

      if (!createAccountResponse.ok) {
        setSubmitting(false);
        setSubmitStatus(
          createAccountResult.error ?? "Could not create your account.",
        );
        return;
      }

      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({
        email: normalizedContactEmail,
        password: form.password,
      });

      if (error) {
        setSubmitting(false);
        setSubmitStatus(error.message);
        return;
      }
      router.replace("/customer/dashboard");
      return;
    }

    setCurrentStep((step) => Math.min(step + 1, 5));
  };

  const onBack = () => {
    setCurrentStep((step) => Math.max(step - 1, 1));
  };

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
                ? submitting
                  ? "Creating account..."
                  : "Create account and submit onboarding"
                : "Continue"}
            </Button>
          </div>

          {!canContinue && currentStep === 3 ? (
            <p className="mt-3 text-sm text-slate-300">
              Continue is disabled until required fields are completed.
            </p>
          ) : null}
        </section>
      </div>
    </div>
  );
}
