"use client";

import { FormEvent, useMemo, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  MOCK_CUSTOMER_ID,
  MOCK_REQUEST_PRIORITIES,
  type MockRequest,
} from "@/features/mock/dashboard-data";
import { useCustomerJourneyStore } from "@/store/customer-journey-store";

function formatSuiteLabel(value: string) {
  if (value === "sales_ops") {
    return "Sales Ops";
  }

  if (value === "hr") {
    return "HR";
  }

  return value
    .split("_")
    .map((part) =>
      part.length > 0 ? part[0].toUpperCase() + part.slice(1) : part,
    )
    .join(" ");
}

function formatStatusLabel(value: string) {
  return value
    .split("_")
    .map((part) =>
      part.length > 0 ? part[0].toUpperCase() + part.slice(1) : part,
    )
    .join(" ");
}

export default function CustomerRequestsPage() {
  const [activeFilter, setActiveFilter] = useState<
    "all" | "open" | "cancelled" | "at_risk"
  >("all");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] =
    useState<(typeof MOCK_REQUEST_PRIORITIES)[number]>("medium");
  const [requests, setRequests] = useState<MockRequest[]>([]);

  const {
    packageTier,
    paid,
    onboardingCompleted,
    suiteRequests,
    markSuiteRequestViewed,
  } = useCustomerJourneyStore();

  const stats = useMemo(() => {
    const now = Date.now();
    const riskWindowMs = 24 * 60 * 60 * 1000;

    const openSuiteRequests = suiteRequests.filter(
      (item) => !["completed", "rejected"].includes(item.status),
    ).length;

    const suiteAtRisk = suiteRequests.filter((item) => {
      if (["completed", "rejected"].includes(item.status) || !item.slaDueAt) {
        return false;
      }

      const dueTime = new Date(item.slaDueAt).getTime();
      return Number.isFinite(dueTime) && dueTime - now <= riskWindowMs;
    }).length;

    const customAtRisk = requests.filter(
      (item) =>
        ["urgent", "high"].includes(item.priority) &&
        !["completed", "cancelled"].includes(item.status),
    ).length;

    return {
      total: requests.length + suiteRequests.length,
      open:
        requests.filter(
          (item) => !["completed", "cancelled"].includes(item.status),
        ).length + openSuiteRequests,
      cancelled: requests.filter((item) => item.status === "cancelled").length,
      atRisk: suiteAtRisk + customAtRisk,
    };
  }, [requests, suiteRequests]);

  const filteredSuiteRequests = useMemo(() => {
    if (activeFilter === "all") {
      return suiteRequests;
    }

    if (activeFilter === "open") {
      return suiteRequests.filter(
        (item) => !["completed", "rejected"].includes(item.status),
      );
    }

    if (activeFilter === "at_risk") {
      const now = Date.now();
      const riskWindowMs = 24 * 60 * 60 * 1000;

      return suiteRequests.filter((item) => {
        if (["completed", "rejected"].includes(item.status) || !item.slaDueAt) {
          return false;
        }

        const dueTime = new Date(item.slaDueAt).getTime();
        return Number.isFinite(dueTime) && dueTime - now <= riskWindowMs;
      });
    }

    return suiteRequests.filter((item) => item.status === "rejected");
  }, [activeFilter, suiteRequests]);

  const filteredCustomRequests = useMemo(() => {
    if (activeFilter === "all") {
      return requests;
    }

    if (activeFilter === "open") {
      return requests.filter(
        (item) => !["completed", "cancelled"].includes(item.status),
      );
    }

    if (activeFilter === "at_risk") {
      return requests.filter(
        (item) =>
          ["urgent", "high"].includes(item.priority) &&
          !["completed", "cancelled"].includes(item.status),
      );
    }

    return requests.filter((item) => item.status === "cancelled");
  }, [activeFilter, requests]);

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!title.trim()) {
      return;
    }

    const now = new Date().toISOString();
    const createdRequest: MockRequest = {
      id: `REQ-${Math.floor(Math.random() * 9000) + 1000}`,
      customer_id: MOCK_CUSTOMER_ID,
      partner_id: "partner-sales",
      title: title.trim(),
      description: description.trim() || "No description",
      status: "submitted",
      priority,
      created_at: now,
      updated_at: now,
    };

    setRequests((current) => [createdRequest, ...current]);
    setTitle("");
    setDescription("");
    setPriority("medium");
  };

  if (!packageTier || !paid || !onboardingCompleted) {
    return (
      <div className="space-y-6">
        <h2 className="text-3xl font-semibold text-white">Customer Requests</h2>

        <Card title="Complete Setup First">
          <div className="flex flex-wrap items-center gap-2 text-sm text-slate-200">
            <Badge>
              Package: {packageTier ? packageTier.toUpperCase() : "Missing"}
            </Badge>
            <Badge>Payment: {paid ? "Complete" : "Pending"}</Badge>
            <Badge>
              Onboarding: {onboardingCompleted ? "Complete" : "Pending"}
            </Badge>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              href="/customer/requests"
              className="inline-flex h-10 items-center justify-center rounded-xl border border-white/20 px-4 text-sm font-semibold text-white transition hover:bg-white/10"
            >
              Stay on requests
            </Link>
            <Link
              href="/customer/onboarding"
              className="inline-flex h-10 items-center justify-center rounded-xl bg-coral px-4 text-sm font-semibold text-white transition hover:brightness-110"
            >
              Open onboarding
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-3xl font-semibold text-white">Customer Requests</h2>
        <Badge>{stats.open} Open</Badge>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <button
          type="button"
          onClick={() => setActiveFilter("all")}
          className={`surface rounded-2xl p-5 text-left shadow-panel transition ${
            activeFilter === "all"
              ? "ring-2 ring-cyan-300/40"
              : "hover:ring-1 hover:ring-white/20"
          }`}
        >
          <p className="text-lg font-semibold text-white">Total</p>
          <p className="mt-4 text-3xl font-semibold text-white">
            {stats.total}
          </p>
        </button>

        <button
          type="button"
          onClick={() => setActiveFilter("open")}
          className={`surface rounded-2xl p-5 text-left shadow-panel transition ${
            activeFilter === "open"
              ? "ring-2 ring-cyan-300/40"
              : "hover:ring-1 hover:ring-white/20"
          }`}
        >
          <p className="text-lg font-semibold text-white">Open</p>
          <p className="mt-4 text-3xl font-semibold text-mint">{stats.open}</p>
        </button>

        <button
          type="button"
          onClick={() => setActiveFilter("cancelled")}
          className={`surface rounded-2xl p-5 text-left shadow-panel transition ${
            activeFilter === "cancelled"
              ? "ring-2 ring-cyan-300/40"
              : "hover:ring-1 hover:ring-white/20"
          }`}
        >
          <p className="text-lg font-semibold text-white">Cancelled</p>
          <p className="mt-4 text-3xl font-semibold text-red-300">
            {stats.cancelled}
          </p>
        </button>

        <button
          type="button"
          onClick={() => setActiveFilter("at_risk")}
          className={`surface rounded-2xl p-5 text-left shadow-panel transition ${
            activeFilter === "at_risk"
              ? "ring-2 ring-cyan-300/40"
              : "hover:ring-1 hover:ring-white/20"
          }`}
        >
          <p className="text-lg font-semibold text-white">At Risk</p>
          <p className="mt-4 text-3xl font-semibold text-amber-300">
            {stats.atRisk}
          </p>
        </button>
      </div>

      <Card title="Create Request">
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
                setPriority(
                  event.target
                    .value as (typeof MOCK_REQUEST_PRIORITIES)[number],
                )
              }
            >
              {MOCK_REQUEST_PRIORITIES.map((item) => (
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

      <Card title="Request List">
        <div className="space-y-3">
          {filteredSuiteRequests.map((item) => {
            const pendingDocs = item.requiredDocs.filter(
              (doc) => !item.receivedDocs.includes(doc),
            );
            const requestHref = `/customer/requests/${item.id}`;

            return (
              <a
                key={item.id}
                href={requestHref}
                onClick={() => markSuiteRequestViewed(item.id)}
                className="block rounded-xl border border-cyan-400/25 bg-cyan-500/5 p-4 transition hover:border-cyan-300/45"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-base font-semibold text-white">
                    {formatSuiteLabel(item.suite)} Suite Request
                  </h3>
                  <Badge className="capitalize">
                    {formatStatusLabel(item.status)}
                  </Badge>
                </div>
                <p className="mt-1 text-sm text-slate-200/90">{item.title}</p>
                <p className="mt-2 text-xs text-slate-300">
                  Pending docs:{" "}
                  {pendingDocs.length > 0 ? pendingDocs.join(", ") : "None"}
                </p>
              </a>
            );
          })}

          {filteredCustomRequests.length > 0 ? (
            <p className="pt-2 text-xs uppercase tracking-[0.12em] text-slate-300">
              Custom Requests
            </p>
          ) : null}

          {filteredCustomRequests.map((item) => {
            const requestHref = `/customer/requests/${item.id}?${new URLSearchParams(
              {
                kind: "custom",
                title: item.title,
                description: item.description,
                status: item.status,
                priority: item.priority,
                createdAt: item.created_at,
                updatedAt: item.updated_at,
              },
            ).toString()}`;

            return (
              <a
                key={item.id}
                href={requestHref}
                className="block rounded-xl border border-white/15 bg-white/5 p-4 transition hover:border-white/25"
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
              </a>
            );
          })}

          {filteredSuiteRequests.length === 0 &&
          filteredCustomRequests.length === 0 ? (
            <p className="text-sm text-slate-300">No requests available.</p>
          ) : null}
        </div>
      </Card>
    </div>
  );
}
