"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

// ─── Types (mirror the /api/admin/catalog response) ─────────────────────────

type Service = { id: string; key: string; name: string; is_active: boolean };
type Item = {
  id: string;
  service_id: string;
  item_key: string;
  label: string;
  description: string | null;
  is_active: boolean;
};
type Dependency = {
  id: string;
  catalog_item_id: string;
  depends_on_item_id: string;
};
type PackageService = { id: string; package_id: string; service_id: string };
type ServicePackage = { id: string; code: string; name: string };

type CatalogPayload = {
  services: Service[];
  items: Item[];
  dependencies: Dependency[];
  packageServices: PackageService[];
  packages: ServicePackage[];
};

const EMPTY: CatalogPayload = {
  services: [],
  items: [],
  dependencies: [],
  packageServices: [],
  packages: [],
};

const inputClass =
  "h-9 rounded-lg border border-white/20 bg-white/5 px-3 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-cyan-300/50";

export default function AdminCatalogPage() {
  const [data, setData] = useState<CatalogPayload>(EMPTY);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch("/api/admin/catalog", { credentials: "include" });
      const body = (await res.json()) as CatalogPayload & { error?: string };
      if (!res.ok) throw new Error(body.error ?? "Could not load the catalog.");
      setData({
        services: body.services ?? [],
        items: body.items ?? [],
        dependencies: body.dependencies ?? [],
        packageServices: body.packageServices ?? [],
        packages: body.packages ?? [],
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load the catalog.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Wraps a mutation: run it, surface errors, reload on success.
  const mutate = useCallback(
    async (fn: () => Promise<Response>) => {
      if (busy) return;
      setBusy(true);
      setError(null);
      try {
        const res = await fn();
        if (!res.ok) {
          const body = (await res.json().catch(() => null)) as {
            error?: string;
          } | null;
          throw new Error(body?.error ?? "Action failed.");
        }
        await load();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Action failed.");
      } finally {
        setBusy(false);
      }
    },
    [busy, load],
  );

  // ── Lookups ───────────────────────────────────────────────────────────────
  const itemsByService = useMemo(() => {
    const map = new Map<string, Item[]>();
    for (const item of data.items) {
      const list = map.get(item.service_id) ?? [];
      list.push(item);
      map.set(item.service_id, list);
    }
    return map;
  }, [data.items]);

  const itemById = useMemo(() => {
    const map = new Map<string, Item>();
    for (const item of data.items) map.set(item.id, item);
    return map;
  }, [data.items]);

  const serviceById = useMemo(() => {
    const map = new Map<string, Service>();
    for (const s of data.services) map.set(s.id, s);
    return map;
  }, [data.services]);

  const serviceIdsByPackage = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const link of data.packageServices) {
      const set = map.get(link.package_id) ?? new Set<string>();
      set.add(link.service_id);
      map.set(link.package_id, set);
    }
    return map;
  }, [data.packageServices]);

  const packageServiceLinkId = useMemo(() => {
    const map = new Map<string, string>(); // `${pkg}:${svc}` -> link id
    for (const link of data.packageServices) {
      map.set(`${link.package_id}:${link.service_id}`, link.id);
    }
    return map;
  }, [data.packageServices]);

  if (isLoading) {
    return <p className="text-sm text-slate-300">Loading catalog…</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-3xl font-semibold text-white">Service Catalog</h2>
          <p className="mt-2 text-sm text-slate-200/85">
            Manage the services, work-order items, dependencies, and which
            services each package includes.
          </p>
        </div>
        <Badge>Catalog Config</Badge>
      </div>

      {error ? (
        <p className="rounded-lg border border-red-300/40 bg-red-500/10 px-3 py-2 text-sm text-red-100">
          {error}
        </p>
      ) : null}

      <ServicesAndItems
        services={data.services}
        itemsByService={itemsByService}
        busy={busy}
        mutate={mutate}
      />

      <Dependencies
        items={data.items}
        dependencies={data.dependencies}
        itemById={itemById}
        serviceById={serviceById}
        busy={busy}
        mutate={mutate}
      />

      <PackageServices
        packages={data.packages}
        services={data.services}
        serviceIdsByPackage={serviceIdsByPackage}
        packageServiceLinkId={packageServiceLinkId}
        busy={busy}
        mutate={mutate}
      />
    </div>
  );
}

// ─── Section: Services & Items ──────────────────────────────────────────────

function ServicesAndItems({
  services,
  itemsByService,
  busy,
  mutate,
}: {
  services: Service[];
  itemsByService: Map<string, Item[]>;
  busy: boolean;
  mutate: (fn: () => Promise<Response>) => Promise<void>;
}) {
  const [newLabelByService, setNewLabelByService] = useState<
    Record<string, string>
  >({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  const addItem = (serviceId: string) => {
    const label = (newLabelByService[serviceId] ?? "").trim();
    if (!label) return;
    void mutate(() =>
      fetch("/api/admin/catalog/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ serviceId, label }),
      }),
    ).then(() =>
      setNewLabelByService((prev) => ({ ...prev, [serviceId]: "" })),
    );
  };

  const toggleActive = (item: Item) =>
    void mutate(() =>
      fetch(`/api/admin/catalog/items/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ isActive: !item.is_active }),
      }),
    );

  const saveRename = (item: Item) => {
    const label = editValue.trim();
    if (!label || label === item.label) {
      setEditingId(null);
      return;
    }
    void mutate(() =>
      fetch(`/api/admin/catalog/items/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ label }),
      }),
    ).then(() => setEditingId(null));
  };

  return (
    <Card
      title="Services & Work-Order Items"
      description="Each service exposes a menu of work-order items. item_key is fixed once created."
    >
      <div className="space-y-5">
        {services.map((service) => {
          const items = itemsByService.get(service.id) ?? [];
          return (
            <div
              key={service.id}
              className="rounded-xl border border-white/10 bg-white/5 p-4"
            >
              <div className="mb-3 flex items-center gap-2">
                <span className="text-sm font-semibold text-white">
                  {service.name}
                </span>
                {!service.is_active ? (
                  <span className="rounded-full border border-slate-500/30 bg-slate-500/10 px-2 py-0.5 text-[10px] uppercase text-slate-400">
                    inactive
                  </span>
                ) : null}
                <span className="text-xs text-slate-500">
                  {items.length} item{items.length === 1 ? "" : "s"}
                </span>
              </div>

              <div className="space-y-1.5">
                {items.map((item) => (
                  <div
                    key={item.id}
                    className="flex flex-wrap items-center gap-2 text-sm"
                  >
                    {editingId === item.id ? (
                      <>
                        <input
                          className={`${inputClass} flex-1`}
                          value={editValue}
                          autoFocus
                          onChange={(e) => setEditValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") saveRename(item);
                            if (e.key === "Escape") setEditingId(null);
                          }}
                        />
                        <Button
                          className="h-8 px-3 text-xs"
                          disabled={busy}
                          onClick={() => saveRename(item)}
                        >
                          Save
                        </Button>
                        <Button
                          variant="ghost"
                          className="h-8 px-3 text-xs"
                          onClick={() => setEditingId(null)}
                        >
                          Cancel
                        </Button>
                      </>
                    ) : (
                      <>
                        <span
                          className={
                            item.is_active
                              ? "text-slate-100"
                              : "text-slate-500 line-through"
                          }
                        >
                          {item.label}
                        </span>
                        <code className="rounded bg-white/5 px-1.5 py-0.5 text-[11px] text-slate-400">
                          {item.item_key}
                        </code>
                        <span className="ml-auto flex gap-1">
                          <Button
                            variant="ghost"
                            className="h-7 px-2 text-xs text-slate-300"
                            disabled={busy}
                            onClick={() => {
                              setEditingId(item.id);
                              setEditValue(item.label);
                            }}
                          >
                            Rename
                          </Button>
                          <Button
                            variant="ghost"
                            className="h-7 px-2 text-xs text-slate-300"
                            disabled={busy}
                            onClick={() => toggleActive(item)}
                          >
                            {item.is_active ? "Deactivate" : "Activate"}
                          </Button>
                        </span>
                      </>
                    )}
                  </div>
                ))}
                {items.length === 0 ? (
                  <p className="text-xs text-slate-500">No items yet.</p>
                ) : null}
              </div>

              <div className="mt-3 flex gap-2">
                <input
                  className={`${inputClass} flex-1`}
                  placeholder={`Add an item to ${service.name}…`}
                  value={newLabelByService[service.id] ?? ""}
                  onChange={(e) =>
                    setNewLabelByService((prev) => ({
                      ...prev,
                      [service.id]: e.target.value,
                    }))
                  }
                  onKeyDown={(e) => {
                    if (e.key === "Enter") addItem(service.id);
                  }}
                />
                <Button
                  className="h-9 px-4 text-xs"
                  disabled={busy || !(newLabelByService[service.id] ?? "").trim()}
                  onClick={() => addItem(service.id)}
                >
                  Add
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

// ─── Section: Dependencies ──────────────────────────────────────────────────

function Dependencies({
  items,
  dependencies,
  itemById,
  serviceById,
  busy,
  mutate,
}: {
  items: Item[];
  dependencies: Dependency[];
  itemById: Map<string, Item>;
  serviceById: Map<string, Service>;
  busy: boolean;
  mutate: (fn: () => Promise<Response>) => Promise<void>;
}) {
  const [fromId, setFromId] = useState("");
  const [toId, setToId] = useState("");

  const label = (id: string) => {
    const item = itemById.get(id);
    if (!item) return id;
    const svc = serviceById.get(item.service_id);
    return `${svc?.name ?? "?"} · ${item.label}`;
  };

  const activeItems = items.filter((i) => i.is_active);

  const addEdge = () => {
    if (!fromId || !toId) return;
    void mutate(() =>
      fetch("/api/admin/catalog/dependencies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ catalogItemId: fromId, dependsOnItemId: toId }),
      }),
    ).then(() => {
      setFromId("");
      setToId("");
    });
  };

  const removeEdge = (id: string) =>
    void mutate(() =>
      fetch(`/api/admin/catalog/dependencies/${id}`, {
        method: "DELETE",
        credentials: "include",
      }),
    );

  return (
    <Card
      title="Dependencies"
      description="An item that depends on another can only start once its prerequisite completes. Cycles are rejected."
    >
      <div className="space-y-3">
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-xs text-slate-300">
            Item
            <select
              className={`${inputClass} mt-1 block w-56`}
              value={fromId}
              onChange={(e) => setFromId(e.target.value)}
            >
              <option value="">Select item…</option>
              {activeItems.map((i) => (
                <option key={i.id} value={i.id}>
                  {label(i.id)}
                </option>
              ))}
            </select>
          </label>
          <span className="pb-2 text-xs text-slate-400">depends on</span>
          <label className="text-xs text-slate-300">
            Prerequisite
            <select
              className={`${inputClass} mt-1 block w-56`}
              value={toId}
              onChange={(e) => setToId(e.target.value)}
            >
              <option value="">Select prerequisite…</option>
              {activeItems
                .filter((i) => i.id !== fromId)
                .map((i) => (
                  <option key={i.id} value={i.id}>
                    {label(i.id)}
                  </option>
                ))}
            </select>
          </label>
          <Button
            className="h-9 px-4 text-xs"
            disabled={busy || !fromId || !toId}
            onClick={addEdge}
          >
            Add dependency
          </Button>
        </div>

        <div className="space-y-1.5">
          {dependencies.map((dep) => (
            <div
              key={dep.id}
              className="flex flex-wrap items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm"
            >
              <span className="text-slate-100">{label(dep.catalog_item_id)}</span>
              <span className="text-xs text-slate-400">depends on</span>
              <span className="text-slate-100">
                {label(dep.depends_on_item_id)}
              </span>
              <Button
                variant="ghost"
                className="ml-auto h-7 px-2 text-xs text-slate-400 hover:text-white"
                disabled={busy}
                onClick={() => removeEdge(dep.id)}
              >
                Remove
              </Button>
            </div>
          ))}
          {dependencies.length === 0 ? (
            <p className="text-xs text-slate-500">No dependencies defined.</p>
          ) : null}
        </div>
      </div>
    </Card>
  );
}

// ─── Section: Package ↔ Services ────────────────────────────────────────────

function PackageServices({
  packages,
  services,
  serviceIdsByPackage,
  packageServiceLinkId,
  busy,
  mutate,
}: {
  packages: ServicePackage[];
  services: Service[];
  serviceIdsByPackage: Map<string, Set<string>>;
  packageServiceLinkId: Map<string, string>;
  busy: boolean;
  mutate: (fn: () => Promise<Response>) => Promise<void>;
}) {
  const [addServiceByPackage, setAddServiceByPackage] = useState<
    Record<string, string>
  >({});

  const addService = (packageId: string) => {
    const serviceId = addServiceByPackage[packageId];
    if (!serviceId) return;
    void mutate(() =>
      fetch("/api/admin/catalog/package-services", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ packageId, serviceId }),
      }),
    ).then(() =>
      setAddServiceByPackage((prev) => ({ ...prev, [packageId]: "" })),
    );
  };

  const removeService = (packageId: string, serviceId: string) => {
    const linkId = packageServiceLinkId.get(`${packageId}:${serviceId}`);
    if (!linkId) return;
    void mutate(() =>
      fetch(`/api/admin/catalog/package-services/${linkId}`, {
        method: "DELETE",
        credentials: "include",
      }),
    );
  };

  const serviceName = (id: string) =>
    services.find((s) => s.id === id)?.name ?? id;

  return (
    <Card
      title="Package Services"
      description="Which services each package includes. Customers on a package can request work orders from these services."
    >
      <div className="space-y-4">
        {packages.map((pkg) => {
          const included = serviceIdsByPackage.get(pkg.id) ?? new Set<string>();
          const available = services.filter(
            (s) => s.is_active && !included.has(s.id),
          );
          return (
            <div
              key={pkg.id}
              className="rounded-xl border border-white/10 bg-white/5 p-4"
            >
              <div className="mb-2 flex items-center gap-2">
                <span className="text-sm font-semibold text-white">
                  {pkg.name}
                </span>
                <code className="rounded bg-white/5 px-1.5 py-0.5 text-[11px] text-slate-400">
                  {pkg.code}
                </code>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {[...included].map((serviceId) => (
                  <span
                    key={serviceId}
                    className="inline-flex items-center gap-1.5 rounded-full border border-cyan-400/30 bg-cyan-500/10 px-2.5 py-1 text-xs text-cyan-100"
                  >
                    {serviceName(serviceId)}
                    <button
                      type="button"
                      className="text-cyan-300/70 hover:text-white disabled:opacity-50"
                      disabled={busy}
                      onClick={() => removeService(pkg.id, serviceId)}
                      aria-label={`Remove ${serviceName(serviceId)}`}
                    >
                      ×
                    </button>
                  </span>
                ))}
                {included.size === 0 ? (
                  <span className="text-xs text-slate-500">
                    No services on this package.
                  </span>
                ) : null}
              </div>

              {available.length > 0 ? (
                <div className="mt-3 flex gap-2">
                  <select
                    className={`${inputClass} w-56`}
                    value={addServiceByPackage[pkg.id] ?? ""}
                    onChange={(e) =>
                      setAddServiceByPackage((prev) => ({
                        ...prev,
                        [pkg.id]: e.target.value,
                      }))
                    }
                  >
                    <option value="">Add a service…</option>
                    {available.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                  <Button
                    className="h-9 px-4 text-xs"
                    disabled={busy || !addServiceByPackage[pkg.id]}
                    onClick={() => addService(pkg.id)}
                  >
                    Add
                  </Button>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </Card>
  );
}
