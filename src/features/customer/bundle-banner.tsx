"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { CUSTOMER_SERVICE_BUNDLES } from "@/features/customer/bundles";

export function CustomerBundleBanner() {
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setActiveIndex((index) => (index + 1) % CUSTOMER_SERVICE_BUNDLES.length);
    }, 4000);

    return () => window.clearInterval(timer);
  }, []);

  const active = CUSTOMER_SERVICE_BUNDLES[activeIndex];

  return (
    <section className="surface relative overflow-hidden rounded-2xl">
      <Image
        src={active.image}
        alt={active.title}
        fill
        sizes="(max-width: 768px) 100vw, 1200px"
        className="object-cover"
      />
      <div className="absolute inset-0 bg-gradient-to-r from-black/75 via-black/45 to-black/20" />

      <div className="absolute inset-0 flex flex-col justify-between p-6 md:p-8">
        <div className="max-w-2xl space-y-2">
          <p className="text-xs uppercase tracking-[0.2em] text-cyan-100/80">
            Bundle Spotlight
          </p>
          <h3 className="text-3xl font-semibold leading-tight text-white md:text-4xl">
            {active.title}
          </h3>
          <p className="text-sm text-slate-100/90">{active.description}</p>
          <p className="text-sm font-semibold text-cyan-200">
            {active.price} • {active.billing}
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-2">
            {CUSTOMER_SERVICE_BUNDLES.map((bundle, index) => (
              <button
                key={bundle.id}
                aria-label={`Show ${bundle.title}`}
                className={`h-2.5 w-8 rounded-full transition ${
                  index === activeIndex ? "bg-coral" : "bg-white/40"
                }`}
                onClick={() => setActiveIndex(index)}
              />
            ))}
          </div>

          <div className="flex gap-2">
            <button
              className="rounded-xl border border-white/35 bg-black/35 px-3 py-2 text-xs text-white"
              onClick={() =>
                setActiveIndex(
                  (index) =>
                    (index - 1 + CUSTOMER_SERVICE_BUNDLES.length) %
                    CUSTOMER_SERVICE_BUNDLES.length,
                )
              }
            >
              Prev
            </button>
            <button
              className="rounded-xl border border-white/35 bg-black/35 px-3 py-2 text-xs text-white"
              onClick={() =>
                setActiveIndex(
                  (index) => (index + 1) % CUSTOMER_SERVICE_BUNDLES.length,
                )
              }
            >
              Next
            </button>
            <Link href={`/customer/requests?bundle=${active.id}`}>
              <Button>Configure Bundle</Button>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
