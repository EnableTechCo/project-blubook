import Link from "next/link";
import type { Route } from "next";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

interface DashboardModule {
  id: string;
  title: string;
  subtitle: string;
  href: Route;
  cta: string;
}

export function DashboardHero({
  title,
  subtitle,
  image,
  actionLabel,
  actionHref,
}: {
  title: string;
  subtitle: string;
  image: string;
  actionLabel: string;
  actionHref: Route;
}) {
  return (
    <section className="surface relative overflow-hidden rounded-2xl p-6 lg:p-8">
      <Image
        src={image}
        alt="Dashboard hero"
        fill
        sizes="(max-width: 1024px) 100vw, 1200px"
        className="object-cover opacity-35"
      />
      <div className="absolute inset-0 bg-gradient-to-r from-black/65 via-black/35 to-black/20" />
      <div className="relative flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-2xl">
          <p className="text-xs uppercase tracking-[0.2em] text-cyan-100/80">
            Operational Overview
          </p>
          <h2 className="mt-2 text-4xl font-semibold leading-tight text-white">
            {title}
          </h2>
          <p className="mt-2 text-sm text-slate-100/85">{subtitle}</p>
        </div>
        <Link href={actionHref}>
          <Button>{actionLabel}</Button>
        </Link>
      </div>
    </section>
  );
}

export function DashboardModuleGrid({
  title,
  modules,
}: {
  title: string;
  modules: DashboardModule[];
}) {
  return (
    <Card title={title} description="Reusable module actions">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {modules.map((module) => (
          <article
            key={module.id}
            className="rounded-xl border border-white/15 bg-white/5 p-4"
          >
            <h3 className="text-base font-semibold text-white">
              {module.title}
            </h3>
            <p className="mt-1 min-h-[40px] text-xs text-slate-200/85">
              {module.subtitle}
            </p>
            <div className="mt-3">
              <Link href={module.href}>
                <Button variant="ghost" className="w-full">
                  {module.cta}
                </Button>
              </Link>
            </div>
          </article>
        ))}
      </div>
    </Card>
  );
}

export function DashboardFeed({
  title,
  items,
}: {
  title: string;
  items: Array<{ id: string; label: string; meta: string; status: string }>;
}) {
  return (
    <Card title={title} description="Mock operational events">
      <div className="space-y-2">
        {items.map((item) => (
          <div
            key={item.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2"
          >
            <div>
              <p className="text-sm text-white">{item.label}</p>
              <p className="text-xs text-slate-300">{item.meta}</p>
            </div>
            <span className="rounded-full bg-white/10 px-2 py-1 text-xs text-slate-100">
              {item.status}
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
}
