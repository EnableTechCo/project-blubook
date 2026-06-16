"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

export type LandingPackage = {
  id: string;
  tier: string;
  badge: string;
  price: string;
  image: string;
  summary: string;
  highlights: string[];
  sla: string;
  responseWindow: string;
  first14Days: string[];
};

export function HomePageClient({ packages }: { packages: LandingPackage[] }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [packageModalOpen, setPackageModalOpen] = useState(false);

  useEffect(() => {
    if (!packages.length) {
      return;
    }

    const timer = window.setTimeout(() => {
      setActiveIndex((index) => (index + 1) % packages.length);
    }, 4200);

    return () => window.clearTimeout(timer);
  }, [activeIndex, packages.length]);

  useEffect(() => {
    packages.forEach((pkg) => {
      const image = new Image();
      image.src = pkg.image;
    });
  }, [packages]);

  const activePackage = packages[activeIndex] ?? packages[0];

  if (!activePackage) {
    return (
      <main className="mx-auto flex h-[100dvh] max-w-6xl flex-col overflow-y-auto px-6 py-6 lg:overflow-hidden">
        <section className="surface rounded-3xl p-7 md:p-9">
          <h1 className="text-3xl font-semibold text-white">BluBook</h1>
          <p className="mt-3 text-sm text-slate-200">
            No packages are available yet.
          </p>
        </section>
      </main>
    );
  }

  return (
    <main className="mx-auto flex h-[100dvh] max-w-6xl flex-col overflow-y-auto px-6 py-5 lg:overflow-hidden">
      <section className="surface relative overflow-hidden rounded-3xl p-5 md:p-6">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              "url('https://images.unsplash.com/photo-1559136555-9303baea8ebd?auto=format&fit=crop&w=2000&q=80')",
            backgroundPosition: "center",
            backgroundSize: "cover",
          }}
        />
        <div className="absolute inset-0 bg-black/75" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/92 via-black/80 to-black/62" />
        <div className="absolute inset-y-0 left-0 w-full bg-gradient-to-r from-black/95 via-black/82 to-transparent lg:w-[72%]" />

        <div className="relative z-10 max-w-3xl">
          <h1 className="mt-3 max-w-3xl text-4xl font-semibold text-white md:text-5xl">
            You sell to your customers. BluBook runs the corporate machine
            behind you.
          </h1>
          <p className="mt-4 max-w-2xl text-sm text-white md:text-base">
            Pick a package, complete onboarding, and activate the service
            streams your business needs now. Coverage can expand over time as
            your operating model grows.
          </p>

          <div className="mt-6 flex flex-wrap gap-2">
            <Button onClick={() => setPackageModalOpen(true)}>
              View Packages
            </Button>
            <Link href="/login">
              <Button className="text-white" variant="ghost">
                Login
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <section className="mt-4 grid gap-4 lg:min-h-0 lg:flex-1 lg:grid-cols-[1.6fr_1fr]">
        <article className="surface relative min-h-[360px] overflow-hidden rounded-2xl p-4 md:p-5 lg:h-full lg:min-h-0">
          {packages.map((pkg, index) => (
            <div
              key={pkg.id}
              className={`absolute inset-0 transition-opacity duration-700 ease-out ${
                index === activeIndex ? "opacity-100" : "opacity-0"
              }`}
              style={{
                backgroundImage: `url('${pkg.image}')`,
                backgroundPosition: "center",
                backgroundSize: "cover",
              }}
            />
          ))}
          <div className="absolute inset-0 bg-black/75" />

          <div className="relative z-10 flex h-full flex-col">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h2 className="mt-1 text-3xl font-semibold text-white">
                  {activePackage.tier}
                </h2>
              </div>
            </div>

            <p className="mt-3 text-2xl font-semibold text-[#f97316]">
              {activePackage.price}
            </p>
            <p className="mt-2 max-w-xl text-sm text-white">
              {activePackage.summary}
            </p>
            <p className="mt-2 text-xs text-white">{activePackage.sla}</p>

            <ul className="mt-3 space-y-1 overflow-auto pr-1 text-xs text-white lg:max-h-40">
              {activePackage.highlights.map((line) => (
                <li key={line}>- {line}</li>
              ))}
            </ul>

            <div className="mt-auto flex flex-wrap items-center gap-2 pt-4">
              {packages.map((item, index) => (
                <button
                  key={item.id}
                  type="button"
                  aria-label={`View ${item.tier}`}
                  className={`h-2.5 w-9 rounded-full transition ${
                    index === activeIndex ? "bg-coral" : "bg-white/40"
                  }`}
                  onClick={() => setActiveIndex(index)}
                />
              ))}
              <Link
                href={`/onboarding?tier=${activePackage.id}`}
                className="ml-auto"
              >
                <Button>Choose {activePackage.tier}</Button>
              </Link>
            </div>
          </div>
        </article>

        <article className="surface min-h-[360px] rounded-2xl p-4 md:p-5 lg:flex lg:h-full lg:min-h-0 lg:flex-col lg:overflow-hidden">
          <p className="text-xs uppercase tracking-[0.18em] text-cyan-200/80">
            Why This Tier Matters
          </p>
          <h3 className="mt-1 text-2xl font-semibold text-slate-300">
            {activePackage.tier} Outcomes
          </h3>

          <div className="mt-4 rounded-xl border border-white/15 bg-white/5 p-3">
            <p className="text-xs uppercase tracking-[0.12em] text-slate-300">
              Response Commitment
            </p>
            <p className="mt-1 text-sm text-slate-300">
              {activePackage.responseWindow}
            </p>
          </div>

          <ul className="mt-3 min-h-[168px] space-y-2 text-sm text-slate-100 lg:min-h-0 lg:flex-1 lg:overflow-auto lg:pr-1">
            {activePackage.first14Days.map((item) => (
              <li
                key={item}
                className="rounded-xl border border-white/15 bg-white/5 px-3 py-2"
              >
                {item}
              </li>
            ))}
          </ul>

          <p className="mt-3 text-xs text-slate-300">
            Package scopes are configurable and can expand as your business
            grows.
          </p>
        </article>
      </section>

      {packageModalOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4"
          role="dialog"
          aria-modal="true"
          aria-label="Select package"
          onClick={() => setPackageModalOpen(false)}
        >
          <div
            className="surface max-h-[90dvh] w-full max-w-4xl overflow-y-auto rounded-2xl border border-white/20 p-5"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.16em] text-cyan-200/80">
                  Choose Your Package
                </p>
                <h2 className="mt-1 text-2xl font-semibold text-white">
                  Start onboarding from your selected tier
                </h2>
              </div>
              <Button
                variant="ghost"
                onClick={() => setPackageModalOpen(false)}
              >
                Close
              </Button>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-3">
              {packages.map((pkg) => (
                <article
                  key={pkg.id}
                  className="rounded-xl border border-white/15 bg-white/5 p-4"
                >
                  <p className="text-xs uppercase tracking-[0.14em] text-cyan-200/80">
                    {pkg.badge}
                  </p>
                  <h3 className="mt-1 text-xl font-semibold text-white">
                    {pkg.tier}
                  </h3>
                  <p className="mt-1 text-sm font-semibold text-cyan-200">
                    {pkg.price}
                  </p>
                  <p className="mt-2 text-sm text-slate-200">{pkg.summary}</p>

                  <Link
                    href={`/onboarding?tier=${pkg.id}`}
                    className="mt-4 inline-flex"
                    onClick={() => setPackageModalOpen(false)}
                  >
                    <Button>Start {pkg.tier}</Button>
                  </Link>
                </article>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
