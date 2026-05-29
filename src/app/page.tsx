import Link from "next/link";
import type { Route } from "next";
import { Button } from "@/components/ui/button";

const portals = [
  { label: "Customer", href: "/customer/dashboard" as Route },
  { label: "Partner", href: "/partner/dashboard" as Route },
  { label: "Staff", href: "/staff/dashboard" as Route },
  { label: "Admin", href: "/admin/dashboard" as Route },
] as const;

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col justify-center px-6 py-20">
      <p className="text-sm uppercase tracking-[0.22em] text-cyan-200/80">
        Operational Ecosystem
      </p>
      <h1 className="mt-3 max-w-3xl text-5xl font-semibold leading-tight text-white">
        BluBook unifies customer, partner, sales and logistics workflows in one
        command surface.
      </h1>
      <p className="mt-5 max-w-2xl text-lg text-slate-200/85">
        This scaffold ships with role-based portals, Supabase auth wiring, and
        phased module routing to keep implementation plug and play.
      </p>

      <div className="mt-10 flex flex-wrap gap-3">
        <Link href="/login">
          <Button>Open Login</Button>
        </Link>
        <Link href="/register">
          <Button variant="ghost">Create Account</Button>
        </Link>
      </div>

      <section className="mt-16 grid gap-3 md:grid-cols-2">
        {portals.map((portal) => (
          <Link
            key={portal.href}
            href={portal.href}
            className="surface rounded-2xl p-5 text-white transition hover:translate-y-[-3px]"
          >
            <p className="text-sm text-slate-200">Enter</p>
            <h2 className="mt-1 text-2xl font-semibold">
              {portal.label} Portal
            </h2>
          </Link>
        ))}
      </section>
    </main>
  );
}
