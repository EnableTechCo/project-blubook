"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  CUSTOMER_SERVICE_BUNDLES,
  ServiceBundle,
} from "@/features/customer/bundles";

type CatalogMode = "navigate" | "select";

const toneClass: Record<ServiceBundle["tone"], string> = {
  slate: "border-slate-300/30",
  teal: "border-cyan-300/30",
  amber: "border-amber-300/30",
  indigo: "border-indigo-300/30",
};

export function AdminBundleCatalog({
  title,
  subtitle,
  mode = "navigate",
  actionLabel = "Configure Bundle",
  targetPath = "/customer/requests",
  onSelectBundle,
}: {
  title: string;
  subtitle: string;
  mode?: CatalogMode;
  actionLabel?: string;
  targetPath?: string;
  onSelectBundle?: (bundle: ServiceBundle) => void;
}) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const [packageForm, setPackageForm] = useState({
    title: "",
    category: "",
    description: "",
    price: "",
    billing: "",
    features: [""],
  });

  const handleAction = (bundle: ServiceBundle) => {
    if (mode === "select" && onSelectBundle) {
      onSelectBundle(bundle);
      return;
    }

    const destination = `${targetPath}?bundle=${bundle.id}`;
    window.location.assign(destination);
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setPackageForm((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handleFeatureChange = (index: number, value: string) => {
    setPackageForm((prev) => ({
      ...prev,
      features: prev.features.map((feature, i) =>
        i === index ? value : feature
      ),
    }));
  };

  const addFeatureField = () => {
    setPackageForm((prev) => ({
      ...prev,
      features: [...prev.features, ""],
    }));
  };

  const removeFeatureField = (index: number) => {
    setPackageForm((prev) => ({
      ...prev,
      features: prev.features.filter((_, i) => i !== index),
    }));
  };

  const handleCreatePackage = () => {
    console.log("Package Created:", packageForm);

    setIsModalOpen(false);

    setPackageForm({
      title: "",
      category: "",
      description: "",
      price: "",
      billing: "",
      features: [""],
    });
  };

  return (
    <>
      <section className="space-y-5">
        <div className="surface relative overflow-hidden rounded-2xl p-6 lg:p-8">
          <img
            src="/images/storefront/hero.svg"
            alt="Marketplace storefront"
            className="absolute inset-0 h-full w-full object-cover opacity-55"
          />

          <div className="absolute inset-0 bg-gradient-to-r from-black/65 via-black/40 to-black/20" />

          <div className="relative flex items-start justify-between gap-6">
            <div className="max-w-2xl space-y-3">
              <h3 className="text-4xl font-semibold leading-tight text-white">
                {title}
              </h3>

              <p className="text-sm text-slate-100/85">
                {subtitle}
              </p>
            </div>

            <Button onClick={() => setIsModalOpen(true)}>
              + Create a package
            </Button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {CUSTOMER_SERVICE_BUNDLES.map((bundle) => (
            <article
              key={bundle.id}
              className="surface flex h-full flex-col overflow-hidden rounded-2xl"
            >
              <div className={`relative border-b ${toneClass[bundle.tone]}`}>
                <img
                  src={bundle.image}
                  alt={bundle.title}
                  className="h-36 w-full object-cover"
                />

                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />

                <div className="absolute left-4 top-4">
                  <span className="rounded-full border border-white/30 bg-black/30 px-2 py-1 text-[10px] uppercase tracking-[0.12em] text-slate-100">
                    {bundle.category}
                  </span>
                </div>
              </div>

              <div className="flex flex-1 flex-col p-4">
                <h4 className="min-h-[56px] text-xl font-semibold text-white">
                  {bundle.title}
                </h4>

                <p className="mt-2 min-h-[54px] text-xs text-slate-100/85">
                  {bundle.description}
                </p>

                <ul className="flex-1 space-y-2 text-xs text-slate-200/85">
                  {bundle.features.map((item) => (
                    <li key={item}>• {item}</li>
                  ))}
                </ul>

                <div className="mt-4 space-y-3">
                  <div>
                    <p className="text-2xl font-semibold text-cyan-200">
                      {bundle.price}
                    </p>

                    <p className="text-[11px] uppercase tracking-[0.12em] text-slate-300/80">
                      {bundle.billing}
                    </p>
                  </div>

                  <Button
                    className="w-full"
                    onClick={() => handleAction(bundle)}
                  >
                    {actionLabel}
                  </Button>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="surface max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-white/10 p-6 shadow-2xl">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-2xl font-semibold text-white">
                  Create Package
                </h3>

                <p className="mt-1 text-sm text-slate-300">
                  Add a new customer service package.
                </p>
              </div>

              <button
                onClick={() => setIsModalOpen(false)}
                className="text-2xl text-slate-400 transition hover:text-white"
              >
                x
              </button>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm text-slate-300">
                  Package Title
                </label>

                <input
                  type="text"
                  name="title"
                  value={packageForm.title}
                  onChange={handleChange}
                  placeholder="Starter Support"
                  className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-white outline-none transition focus:border-cyan-400"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm text-slate-300">
                  Category
                </label>

                <input
                  type="text"
                  name="category"
                  value={packageForm.category}
                  onChange={handleChange}
                  placeholder="Support"
                  className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-white outline-none transition focus:border-cyan-400"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm text-slate-300">
                  Price
                </label>

                <input
                  type="text"
                  name="price"
                  value={packageForm.price}
                  onChange={handleChange}
                  placeholder="R2,500"
                  className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-white outline-none transition focus:border-cyan-400"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm text-slate-300">
                  Billing
                </label>

                <input
                  type="text"
                  name="billing"
                  value={packageForm.billing}
                  onChange={handleChange}
                  placeholder="Per month"
                  className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-white outline-none transition focus:border-cyan-400"
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <label className="text-sm text-slate-300">
                  Description
                </label>

                <textarea
                  name="description"
                  value={packageForm.description}
                  onChange={handleChange}
                  placeholder="Describe the package..."
                  rows={4}
                  className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-white outline-none transition focus:border-cyan-400"
                />
              </div>
            </div>

            <div className="space-y-2 md:col-span-2">
              <div className="flex items-center justify-between">
                <label className="text-sm text-slate-300">
                  Features
                </label>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addFeatureField}
                >
                  + Add Feature
                </Button>
              </div>

              <div className="space-y-3">
                {packageForm.features.map((feature, index) => (
                  <div key={index} className="flex gap-2">
                    <input
                      type="text"
                      value={feature}
                      onChange={(e) =>
                        handleFeatureChange(index, e.target.value)
                      }
                      placeholder={`Feature ${index + 1}`}
                      className="flex-1 rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-white outline-none transition focus:border-cyan-400"
                    />

                    {packageForm.features.length > 1 && (
                      <Button
                        type="button"
                        variant="destructive"
                        onClick={() => removeFeatureField(index)}
                      >
                        Remove
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={() => setIsModalOpen(false)}
              >
                Cancel
              </Button>

              <Button onClick={handleCreatePackage}>
                Create Package
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}