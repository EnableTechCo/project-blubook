"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

const PACKAGE_CATALOG = [
  {
    id: "bronze",
    tier: "Bronze",
    badge: "Starter",
    price: "$499/mo",
    image:
      "https://images.unsplash.com/photo-1556740749-887f6717d7e4?auto=format&fit=crop&w=1600&q=80",
    summary:
      "Good fit for smaller teams that need structure without heavy process overhead.",
    highlights: [
      "Finance monthly close baseline",
      "Sales Ops purchase-order intake",
      "Legal and HR compliance essentials",
    ],
    sla: "Standard SLA windows",
    responseWindow: "First response within 8 business hours",
    first14Days: [
      "Suite kickoff and document checklist issued",
      "Finance and Sales Ops baseline workflows activated",
      "Initial compliance and HR setup review completed",
    ],
  },
  {
    id: "silver",
    tier: "Silver",
    badge: "Growth",
    price: "$999/mo",
    image:
      "https://images.unsplash.com/photo-1552664730-d307ca884978?auto=format&fit=crop&w=1600&q=80",
    summary:
      "Built for scaling companies that need tighter execution and reporting.",
    highlights: [
      "Order-to-cash orchestration",
      "Marketing campaign operations",
      "Broader legal and HR workflow coverage",
    ],
    sla: "Priority SLA windows",
    responseWindow: "First response within 4 business hours",
    first14Days: [
      "Cross-suite operating calendar configured",
      "Campaign operations + legal review flow enabled",
      "Monthly reporting pack and SLA dashboard initialized",
    ],
  },
  {
    id: "premium",
    tier: "Premium",
    badge: "Enterprise",
    price: "$1,799/mo",
    image:
      "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&w=1600&q=80",
    summary:
      "For multi-channel operators that need proactive governance and rapid response.",
    highlights: [
      "Advanced controls and board-level reporting",
      "Automated cross-suite handoffs",
      "Fastest SLA with proactive intervention",
    ],
    sla: "Highest priority SLA + AI alerts",
    responseWindow: "First response within 1 business hour",
    first14Days: [
      "Executive governance cadence established",
      "Predictive alerts and escalations enabled",
      "Sales-to-logistics handoff automation configured",
    ],
  },
] as const;

export default function HomePage() {
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setActiveIndex((index) => (index + 1) % PACKAGE_CATALOG.length);
    }, 4200);

    return () => window.clearTimeout(timer);
  }, [activeIndex]);

  useEffect(() => {
    PACKAGE_CATALOG.forEach((pkg) => {
      const image = new Image();
      image.src = pkg.image;
    });
  }, []);

  const activePackage = PACKAGE_CATALOG[activeIndex];

  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col px-6 py-12">
      <section className="surface relative overflow-hidden rounded-3xl p-7 md:p-9">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              "url('https://images.unsplash.com/photo-1559136555-9303baea8ebd?auto=format&fit=crop&w=2000&q=80')",
            backgroundPosition: "center",
            backgroundSize: "cover",
          }}
        />
        <div className="absolute inset-0 bg-black/45" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/92 via-black/80 to-black/62" />
        <div className="absolute inset-y-0 left-0 w-full bg-gradient-to-r from-black/95 via-black/82 to-transparent lg:w-[72%]" />

        <div
          className="relative z-10 max-w-3xl"
          style={{ textShadow: "0 3px 16px rgba(0, 0, 0, 0.78)" }}
        >
          <p className="text-xs uppercase tracking-[0.22em] text-cyan-100/85">
            Built For Operators Selling Real Products
          </p>
          <h1 className="mt-3 max-w-3xl text-4xl font-semibold leading-tight text-white md:text-5xl">
            You sell to your customers. BluBook runs the corporate machine
            behind you.
          </h1>
          <p className="mt-4 max-w-2xl text-sm text-slate-100/90 md:text-base">
            Pick a tier, pay, complete onboarding, then activate Finance, Sales
            Ops, Marketing, Legal, and HR as one managed workflow. When you
            upload a PO, Sales starts immediately and hands off to Logistics
            when ready.
          </p>

          <div className="mt-6 flex flex-wrap gap-2">
            <Link href="/customer/onboarding">
              <Button>Start Package Flow</Button>
            </Link>
            <Link href="/login">
              <Button variant="ghost">Login</Button>
            </Link>
          </div>
        </div>
      </section>

      <section className="mt-6 grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <article className="surface relative min-h-[380px] overflow-hidden rounded-2xl p-5">
          {PACKAGE_CATALOG.map((pkg, index) => (
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
          <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/45 to-black/20" />

          <div className="relative z-10">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h2 className="mt-1 text-3xl font-semibold text-white">
                  {activePackage.tier}
                </h2>
                <p className="mt-1 text-xs uppercase tracking-[0.16em] text-cyan-100/75">
                  {activePackage.badge}
                </p>
              </div>
            </div>

            <p className="mt-3 text-2xl font-semibold text-cyan-200">
              {activePackage.price}
            </p>
            <p className="mt-2 max-w-xl text-sm text-slate-100/90">
              {activePackage.summary}
            </p>
            <p className="mt-2 text-xs text-slate-200">{activePackage.sla}</p>

            <ul className="mt-3 space-y-1 text-xs text-slate-100/90">
              {activePackage.highlights.map((line) => (
                <li key={line}>- {line}</li>
              ))}
            </ul>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              {PACKAGE_CATALOG.map((item, index) => (
                <button
                  key={item.id}
                  aria-label={`View ${item.tier}`}
                  className={`h-2.5 w-9 rounded-full transition ${
                    index === activeIndex ? "bg-coral" : "bg-white/40"
                  }`}
                  onClick={() => setActiveIndex(index)}
                />
              ))}
              <Link
                href={`/customer/onboarding?tier=${activePackage.id}`}
                className="ml-auto"
              >
                <Button>Choose {activePackage.tier}</Button>
              </Link>
            </div>
          </div>
        </article>

        <article className="surface min-h-[380px] rounded-2xl p-5">
          <p className="text-xs uppercase tracking-[0.18em] text-cyan-200/80">
            Why This Tier Matters
          </p>
          <h3 className="mt-1 text-2xl font-semibold text-white">
            {activePackage.tier} Outcomes
          </h3>

          <div className="mt-4 rounded-xl border border-white/15 bg-white/5 p-3">
            <p className="text-xs uppercase tracking-[0.12em] text-slate-300">
              Response Commitment
            </p>
            <p className="mt-1 text-sm text-white">
              {activePackage.responseWindow}
            </p>
          </div>

          <ul className="mt-3 min-h-[168px] space-y-2 text-sm text-slate-100">
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
            Every tier includes Finance, Sales Ops, Marketing, Legal, and HR.
            Tier controls depth, speed, and automation.
          </p>
        </article>
      </section>
    </main>
  );
}
