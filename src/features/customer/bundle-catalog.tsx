"use client";

import type { Route } from "next";
import Image from "next/image";
import { useRouter } from "next/navigation";
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

export function CustomerBundleCatalog({
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
  const router = useRouter();

  const handleAction = (bundle: ServiceBundle) => {
    if (mode === "select" && onSelectBundle) {
      onSelectBundle(bundle);
      return;
    }

    const destination = `${targetPath}?bundle=${bundle.id}`;
    router.push(destination as Route);
  };

  return (
    <section className="space-y-5">
      <div className="surface relative overflow-hidden rounded-2xl p-6 lg:p-8">
        <Image
          src="/images/storefront/hero.svg"
          alt="Marketplace storefront"
          fill
          sizes="(max-width: 1024px) 100vw, 1200px"
          className="object-cover opacity-55"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black/65 via-black/40 to-black/20" />
        <div className="relative max-w-2xl space-y-3">
          <p className="text-xs uppercase tracking-[0.2em] text-cyan-100/80">
            Service Storefront
          </p>
          <h3 className="text-4xl font-semibold leading-tight text-white">
            {title}
          </h3>
          <p className="text-sm text-slate-100/85">{subtitle}</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {CUSTOMER_SERVICE_BUNDLES.map((bundle) => (
          <article
            key={bundle.id}
            className="surface flex h-full flex-col overflow-hidden rounded-2xl"
          >
            <div className={`relative border-b ${toneClass[bundle.tone]}`}>
              <Image
                src={bundle.image}
                alt={bundle.title}
                fill
                sizes="(max-width: 768px) 100vw, 25vw"
                className="object-cover"
              />
              <div className="h-36 w-full" />
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
                <Button className="w-full" onClick={() => handleAction(bundle)}>
                  {actionLabel}
                </Button>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
