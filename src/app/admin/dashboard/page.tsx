"use client";

import {
  Activity,
  BarChart3,
  BriefcaseBusiness,
  Package,
  Layers3,
} from "lucide-react";

// ── Real data from Enable Technologies Product Packages.xlsx ──────────────────

const METRICS = [
  {
    label: "Monthly revenue",
    hint: "Recurring subscription revenue",
    value: "R3,251,400",
    delta: "+12% this month",
  },
  {
    label: "Active clients",
    hint: "Businesses subscribed",
    value: "252",
    delta: "+18 new this week",
  },
  {
    label: "Packages",
    hint: "Packages currently offered",
    value: "5",
    delta: "Basic → Premium Plus",
  },
  {
    label: "Service providers",
    hint: "Active providers on platform",
    value: "16",
    delta: "8 service categories",
  },
];

const PACKAGES = [
  {
    name: "Basic",
    category: "IT Hosting · Financial Accounting · Marketing · Sales Ops",
    services: 4,
    subscribers: 32,
    revenue: "R144,000",
    providers: 6,
    growth: "+4%",
    color: "#94a3b8",
  },
  {
    name: "Basic Flex",
    category: "IT Hosting · Financial Accounting · HR · Marketing · Sales Ops",
    services: 5,
    subscribers: 28,
    revenue: "R173,600",
    providers: 6,
    growth: "+6%",
    color: "#4ade80",
  },
  {
    name: "Advanced",
    category: "IT Hosting · Financial Accounting · HR · Marketing · Post Sales · Sales Ops",
    services: 6,
    subscribers: 61,
    revenue: "R597,800",
    providers: 12,
    growth: "+11%",
    color: "#60a5fa",
  },
  {
    name: "Premium",
    category: "IT Hosting · Accounting · HR · Marketing · Post Sales · Sales Ops · Mgt Consulting · Office",
    services: 8,
    subscribers: 84,
    revenue: "R1,302,000",
    providers: 16,
    growth: "+18%",
    color: "#f59e0b",
  },
  {
    name: "Premium Plus",
    category: "All categories including Legal, Transformation & Personal Office",
    services: 9,
    subscribers: 47,
    revenue: "R1,034,000",
    providers: 16,
    growth: "+9%",
    color: "#a78bfa",
  },
];

const PROVIDERS = [
  {
    name: "Afrihost",
    services: "IT Hosting",
    packages: 5,
    clients: 252,
    sla: "99%",
    status: "active",
  },
  {
    name: "Domains.co.za",
    services: "IT Hosting",
    packages: 5,
    clients: 252,
    sla: "99%",
    status: "active",
  },
  {
    name: "SMTAX",
    services: "Financial Accounting",
    packages: 5,
    clients: 252,
    sla: "97%",
    status: "active",
  },
  {
    name: "The Bean Counter",
    services: "Financial Accounting",
    packages: 5,
    clients: 252,
    sla: "96%",
    status: "active",
  },
  {
    name: "MHRS",
    services: "Human Resources",
    packages: 4,
    clients: 220,
    sla: "96%",
    status: "active",
  },
  
];

const ACTIVITIES = [
  "Premium Plus subscribed by Acme Ltd",
  "Afrihost assigned to Advanced IT Hosting",
  "Invoice INV-1021 paid — R9,800",
  "Basic upgraded to Advanced by BlueWave Ltd",
  "New client registered: Sunrise Retail",
  "SMTAX SLA report submitted for May",
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function initials(name: string) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

// ── Component ────────────────────────────────────────────────────────────────

export default function AdminDashboardPage() {
  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-white">Dashboard</h1>
          <p className="mt-2 text-sm text-slate-300">
            Monitor your platform, providers, packages and business growth.
          </p>
        </div>
        <button className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm text-white hover:bg-white/10 transition">
          Generate Report
        </button>
      </div>

      {/* Metrics */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {METRICS.map((m) => (
          <div
            key={m.label}
            className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-sm"
          >
            <p className="text-xs uppercase tracking-[0.12em] text-slate-400">{m.label}</p>
            <p className="mt-1 text-[11px] text-slate-500">{m.hint}</p>
            <div className="mt-4 flex items-end justify-between">
              <h2 className="text-3xl font-semibold text-white">{m.value}</h2>
              <span className="text-xs text-emerald-300">{m.delta}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Main Grid */}
      <div className="grid gap-4 xl:grid-cols-3">

        {/* Left Side */}
        <div className="space-y-4 xl:col-span-2">

          {/* Package Performance */}
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-white">Package Performance</h3>
                <p className="mt-1 text-xs text-slate-400">
                  Client subscriptions, revenue and service coverage per tier.
                </p>
              </div>
              <button className="text-sm text-blue-400 hover:text-blue-300">
                Manage Packages
              </button>
            </div>

            <div className="space-y-3">
              {PACKAGES.map((pkg) => (
                <div
                  key={pkg.name}
                  className="rounded-xl border border-white/10 bg-white/[0.03] p-4"
                >
                  <div className="flex items-start gap-4">
                    <div
                      className="h-12 w-2 rounded-full flex-shrink-0"
                      style={{ background: pkg.color }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h4 className="text-sm font-semibold text-white">{pkg.name}</h4>
                          <p className="mt-1 text-xs text-slate-400 truncate">{pkg.category}</p>
                        </div>
                        <span className="flex-shrink-0 rounded-full bg-emerald-500/10 px-2 py-1 text-xs text-emerald-300 border border-emerald-500/20">
                          {pkg.growth}
                        </span>
                      </div>

                      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
                        <div>
                          <p className="text-xs text-slate-500">Service categories</p>
                          <p className="mt-1 text-sm font-medium text-white">{pkg.services}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-500">Subscribers</p>
                          <p className="mt-1 text-sm font-medium text-white">{pkg.subscribers}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-500">Revenue</p>
                          <p className="mt-1 text-sm font-medium text-white">{pkg.revenue}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-500">Providers</p>
                          <p className="mt-1 text-sm font-medium text-white">{pkg.providers}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Service Providers */}
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-white">Service Providers</h3>
                <p className="mt-1 text-xs text-slate-400">
                  Provider performance and SLA tracking across all categories.
                </p>
              </div>
              <button className="text-sm text-blue-400 hover:text-blue-300">
                View All
              </button>
            </div>
            <div className="space-y-3">
              {PROVIDERS.map((provider) => (
                <div
                  key={provider.name}
                  className="flex items-center gap-4 rounded-xl border border-white/10 bg-white/[0.03] p-4"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-700 text-xs font-medium text-slate-200 flex-shrink-0">
                    {initials(provider.name)}
                  </div>

                  <div className="flex-1 min-w-0">
                    <h4 className="truncate text-sm font-semibold text-white">{provider.name}</h4>
                    <p className="mt-1 text-xs text-slate-400">{provider.services}</p>
                  </div>

                  <div className="hidden md:block text-right flex-shrink-0">
                    <p className="text-xs text-slate-500">Packages</p>
                    <p className="mt-1 text-sm text-white font-medium">{provider.packages}</p>
                  </div>

                  <div className="hidden md:block text-right flex-shrink-0">
                    <p className="text-xs text-slate-500">SLA</p>
                    <p className="mt-1 text-sm text-emerald-300 font-medium">{provider.sla}</p>
                  </div>

                  <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-1 text-xs text-emerald-300 flex-shrink-0">
                    Active
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Side */}
        <div className="space-y-4">

          {/* Quick Actions */}
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <h3 className="text-lg font-semibold text-white">Quick Actions</h3>
            <div className="mt-4 space-y-2">
              {[
                { icon: Package, label: "Create Package" },
                { icon: BriefcaseBusiness, label: "Add Provider" },
                { icon: Layers3, label: "Add Service Category" },
                { icon: BarChart3, label: "View Reports" },
              ].map((action) => (
                <button
                  key={action.label}
                  className="flex w-full items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-left hover:bg-white/10 transition"
                >
                  <action.icon size={18} className="text-slate-300" />
                  <span className="text-sm text-white">{action.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Recent Activity */}
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <div className="flex items-center gap-2">
              <Activity size={18} className="text-slate-300" />
              <h3 className="text-lg font-semibold text-white">Recent Activity</h3>
            </div>
            <div className="mt-5 space-y-4">
              {ACTIVITIES.map((item, index) => (
                <div key={index} className="relative pl-5">
                  <div className="absolute left-0 top-1.5 h-2 w-2 rounded-full bg-blue-400" />
                  <p className="text-sm text-slate-300">{item}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Analytics Summary */}
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <div className="flex items-center gap-2">
              <BarChart3 size={18} className="text-slate-300" />
              <h3 className="text-lg font-semibold text-white">Analytics</h3>
            </div>
            <div className="mt-5 space-y-4">
              <div>
                <div className="flex items-center justify-between">
                  <p className="text-xs text-slate-400">Package retention</p>
                  <p className="text-xs text-white">92%</p>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
                  <div className="h-full w-[92%] rounded-full bg-emerald-400" />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between">
                  <p className="text-xs text-slate-400">SLA success rate</p>
                  <p className="text-xs text-white">97%</p>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
                  <div className="h-full w-[97%] rounded-full bg-blue-400" />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between">
                  <p className="text-xs text-slate-400">Revenue growth</p>
                  <p className="text-xs text-white">68%</p>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
                  <div className="h-full w-[68%] rounded-full bg-amber-400" />
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}