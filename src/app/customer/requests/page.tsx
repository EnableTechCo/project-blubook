"use client";

import { FormEvent, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { CustomerBundleCatalog } from "@/features/customer/bundle-catalog";
import { getBundleById, type ServiceBundle } from "@/features/customer/bundles";
import {
  MOCK_CUSTOMER_ID,
  MOCK_CUSTOMER_REQUESTS,
  type MockRequest,
} from "@/features/mock/dashboard-data";

const priorities = ["low", "medium", "high", "urgent"] as const;

export default function CustomerRequestsPage() {
  const searchParams = useSearchParams();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] =
    useState<(typeof priorities)[number]>("medium");
  const [requests, setRequests] = useState<MockRequest[]>(
    MOCK_CUSTOMER_REQUESTS,
  );

  const selectedBundle = useMemo(
    () => getBundleById(searchParams.get("bundle")),
    [searchParams],
  );

  const applyBundle = (bundle: ServiceBundle) => {
    setTitle(bundle.title);
    setDescription(
      `${bundle.description} Included: ${bundle.features.join(", ")}. Price: ${bundle.price} (${bundle.billing}).`,
    );
    setPriority("medium");
  };

  const stats = useMemo(() => {
    const items = requests;
    return {
      total: items.length,
      open: items.filter(
        (item) => !["completed", "cancelled"].includes(item.status),
      ).length,
      cancelled: items.filter((item) => item.status === "cancelled").length,
    };
  }, [requests]);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!title.trim()) {
      return;
    }

    const now = new Date().toISOString();
    setRequests((current) => [
      {
        id: `REQ-${Math.floor(Math.random() * 9000) + 1000}`,
        customer_id: MOCK_CUSTOMER_ID,
        partner_id: "partner-019",
        title: title.trim(),
        description: description.trim() || "No description",
        status: "submitted",
        priority,
        created_at: now,
        updated_at: now,
      },
      ...current,
    ]);
    setTitle("");
    setDescription("");
    setPriority("medium");
  };

  const cancelRequest = (requestId: string) => {
    setRequests((current) =>
      current.map((item) =>
        item.id === requestId
          ? {
              ...item,
              status: "cancelled",
              updated_at: new Date().toISOString(),
            }
          : item,
      ),
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm uppercase tracking-[0.18em] text-cyan-200/80">
            Phase 2
          </p>
          <h2 className="text-3xl font-semibold text-white">
            Customer Requests
          </h2>
        </div>
        <Badge>{stats.open} Open</Badge>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card title="Total" description="All customer requests">
          <p className="text-3xl font-semibold text-white">{stats.total}</p>
        </Card>
        <Card title="Open" description="Active requests">
          <p className="text-3xl font-semibold text-mint">{stats.open}</p>
        </Card>
        <Card title="Cancelled" description="Customer cancelled">
          <p className="text-3xl font-semibold text-red-300">
            {stats.cancelled}
          </p>
        </Card>
      </div>

      <CustomerBundleCatalog
        title="Service Bundles"
        subtitle="Click any bundle to prefill your request form below."
        mode="select"
        actionLabel="Use This Bundle"
        onSelectBundle={applyBundle}
      />

      {selectedBundle ? (
        <Card
          title="Bundle Selected"
          description="A bundle was selected from the storefront link."
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-slate-100">{selectedBundle.title}</p>
            <Button variant="ghost" onClick={() => applyBundle(selectedBundle)}>
              Prefill Form
            </Button>
          </div>
        </Card>
      ) : null}

      <Card
        title="Create Request"
        description="Submit a new service request with priority and context."
      >
        <form className="grid gap-3" onSubmit={onSubmit}>
          <Input
            placeholder="Request title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            maxLength={120}
            required
          />
          <textarea
            className="min-h-24 w-full rounded-xl border border-white/20 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-slate-300/60 focus:outline-none focus:ring-2 focus:ring-coral"
            placeholder="Describe what you need from the team"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            maxLength={500}
          />
          <div className="flex flex-wrap items-center gap-3">
            <select
              className="h-11 rounded-xl border border-white/20 bg-slate-900 px-3 text-sm text-white"
              value={priority}
              onChange={(event) =>
                setPriority(event.target.value as (typeof priorities)[number])
              }
            >
              {priorities.map((item) => (
                <option key={item} value={item}>
                  {item.toUpperCase()}
                </option>
              ))}
            </select>
            <Button type="submit" disabled={!title.trim()}>
              Create request
            </Button>
          </div>
        </form>
      </Card>

      <Card
        title="Request List"
        description="Extensive hardcoded feed of request states."
      >
        <div className="mt-3 space-y-3">
          {requests.map((item) => (
            <article
              key={item.id}
              className="rounded-xl border border-white/15 bg-white/5 p-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-base font-semibold text-white">
                  {item.title}
                </h3>
                <Badge className="capitalize">
                  {item.status.replaceAll("_", " ")}
                </Badge>
              </div>
              <p className="mt-1 text-sm text-slate-200/85">
                {item.description || "No description"}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-300">
                <span className="rounded-full bg-white/10 px-2 py-1 uppercase">
                  {item.priority}
                </span>
                <span>{new Date(item.created_at).toLocaleString()}</span>
              </div>
              {!["completed", "cancelled"].includes(item.status) ? (
                <div className="mt-3">
                  <Button
                    variant="danger"
                    onClick={() => cancelRequest(item.id)}
                  >
                    Cancel request
                  </Button>
                </div>
              ) : null}
            </article>
          ))}
          {requests.length === 0 ? (
            <p className="text-sm text-slate-300">
              No requests yet. Create your first request above.
            </p>
          ) : null}
        </div>
      </Card>
    </div>
  );
}
