"use client";

// ── Mock data ─────────────────────────────────────────────────────────────────

const PACKAGES = [
  { name: "Homekeeping Package", count: "5 services", orders: 38, color: "#4ade80" },
  { name: "Handyman & Repairs", count: "6 services", orders: 21, color: "#60a5fa" },
  { name: "Personal Care & Beauty", count: "7 services", orders: 29, color: "#f59e0b" },
];

const PROVIDERS = [
  { name: "Neo Holdings Ltd", type: "Homekeeping · Handyman", status: "active" },
  { name: "Kabelo Ndlovu", type: "Personal Care & Beauty", status: "active" },
  { name: "Thabo & Co. Repairs", type: "Handyman & Repairs", status: "active" },
  { name: "Mpho Pest Solutions", type: "Homekeeping", status: "pending" },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function initials(name: string) {
  return name.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase();
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AdminDashboardPage() {
  return (
    <div className="space-y-6">

      {/* Page header */}
      <div>
        <h2 className="text-3xl font-semibold text-white">Admin Dashboard</h2>
        <p className="mt-2 text-sm text-slate-200/85">
          Here's what's happening in your business today.
        </p>
      </div>

      {/* Metrics */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-2">
        {[
          { label: "Active packages", hint: "Packages on offer", value: 3, delta: "Homekeeping, Handyman, Beauty" },
          { label: "Service providers", hint: "Registered providers", value: 25, delta: "1 pending approval" },
        ].map((m) => (
          <div key={m.label} className="rounded-xl border border-white/15 bg-white/5 p-4">
            <p className="text-xs font-medium uppercase tracking-[0.08em] text-slate-400">{m.label}</p>
            <p className="text-[10px] text-slate-500 mt-0.5 mb-3">{m.hint}</p>
            <p className="text-3xl font-semibold text-white">{m.value}</p>
            <p className="mt-1 text-xs text-slate-300">{m.delta}</p>
          </div>
        ))}
      </div>

      {/* Packages + Providers */}
      <div className="grid gap-4 lg:grid-cols-2">

        <div className="rounded-xl border border-white/15 bg-white/5 p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm font-semibold text-white">Your packages</p>
              <p className="text-xs text-slate-400 mt-0.5">Packages currently on offer to clients.</p>
            </div>
            <button className="text-xs text-blue-400 hover:text-blue-300">Manage</button>
          </div>
          <div className="space-y-2">
            {PACKAGES.map((p) => (
              <div key={p.name} className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/5 p-3">
                <div className="w-2 h-8 rounded-full flex-shrink-0" style={{ background: p.color }} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white">{p.name}</p>
                  <p className="text-xs text-slate-400">{p.count}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-sm font-semibold text-white">{p.orders}</p>
                  <p className="text-[10px] text-slate-500">orders</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-white/15 bg-white/5 p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm font-semibold text-white">Service providers</p>
              <p className="text-xs text-slate-400 mt-0.5">Providers registered on the platform.</p>
            </div>
            <button className="text-xs text-blue-400 hover:text-blue-300">View all</button>
          </div>
          <div className="space-y-2">
            {PROVIDERS.map((p) => (
              <div key={p.name} className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/5 p-3">
                <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-xs font-medium text-slate-200 flex-shrink-0">
                  {initials(p.name)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white">{p.name}</p>
                  <p className="text-xs text-slate-400">{p.type}</p>
                </div>
                <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full flex-shrink-0 ${
                  p.status === "active"
                    ? "bg-green-500/20 text-green-300 border border-green-400/30"
                    : "bg-amber-500/20 text-amber-300 border border-amber-400/30"
                }`}>
                  {p.status === "active" ? "Active" : "Pending"}
                </span>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}