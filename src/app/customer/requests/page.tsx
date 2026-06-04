"use client";

import { FormEvent, useMemo, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useCustomerContext } from "@/hooks/use-customer-context";
import {
  createCustomerRequest,
  listCustomerRequests,
  type RequestRecord,
} from "@/services/requests.service";

const REQUEST_PRIORITIES = ["low", "medium", "high", "urgent"] as const;

function formatStatusLabel(value: string) {
  return value
    .split("_")
    .map((part) =>
      part.length > 0 ? part[0].toUpperCase() + part.slice(1) : part,
    )
    .join(" ");
}

export default function CustomerRequestsPage() {
  const queryClient = useQueryClient();
  const customerContext = useCustomerContext();
  const [activeFilter, setActiveFilter] = useState<
    "all" | "open" | "cancelled" | "at_risk"
  >("all");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] =
    useState<(typeof REQUEST_PRIORITIES)[number]>("medium");
  const [submitError, setSubmitError] = useState<string | null>(null);

  const requestsQuery = useQuery({
    queryKey: ["customer-requests", customerContext.data?.userId],
    enabled: Boolean(customerContext.data?.userId),
    queryFn: () => listCustomerRequests(customerContext.data!.userId),
  });

  const createRequestMutation = useMutation({
    mutationFn: createCustomerRequest,
    onSuccess: async () => {
      setTitle("");
      setDescription("");
      setPriority("medium");
      setSubmitError(null);
      await queryClient.invalidateQueries({
        queryKey: ["customer-requests", customerContext.data?.userId],
      });
    },
    onError: (error) => {
      setSubmitError(
        error instanceof Error ? error.message : "Could not create request.",
      );
    },
  });

  const requests = requestsQuery.data ?? [];

  const stats = useMemo(() => {
    return {
      total: requests.length,
      open: requests.filter(
        (item) => !["completed", "cancelled"].includes(item.status),
      ).length,
      cancelled: requests.filter((item) => item.status === "cancelled").length,
      atRisk: requests.filter(
        (item) =>
          ["urgent", "high"].includes(item.priority) &&
          !["completed", "cancelled"].includes(item.status),
      ).length,
    };
  }, [requests]);

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
    if (!title.trim() || !customerContext.data?.userId) {
      return;
    }

    createRequestMutation.mutate({
      customerId: customerContext.data.userId,
      title: title.trim(),
      description: description.trim() || undefined,
      priority,
    });
  };

  if (customerContext.isLoading) {
    return <p className="text-sm text-slate-300">Loading requests...</p>;
  }

  if (customerContext.isError || !customerContext.data) {
    return (
      <p className="text-sm text-red-300">
        Could not load your customer request workspace.
      </p>
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
                  event.target.value as (typeof REQUEST_PRIORITIES)[number],
                )
              }
            >
              {REQUEST_PRIORITIES.map((item) => (
                <option key={item} value={item}>
                  {item.toUpperCase()}
                </option>
              ))}
            </select>
            <Button
              type="submit"
              disabled={!title.trim() || createRequestMutation.isPending}
            >
              {createRequestMutation.isPending
                ? "Creating..."
                : "Create request"}
            </Button>
          </div>
          {submitError ? (
            <p className="text-sm text-red-300">{submitError}</p>
          ) : null}
        </form>
      </Card>

      <Card title="Request List">
        {requestsQuery.isLoading ? (
          <p className="text-sm text-slate-300">Loading requests...</p>
        ) : requestsQuery.isError ? (
          <p className="text-sm text-red-300">
            Could not load customer requests right now.
          </p>
        ) : (
          <div className="space-y-3">
            {filteredCustomRequests.map((item) => (
              <RequestListItem key={item.id} item={item} />
            ))}

            {filteredCustomRequests.length === 0 ? (
              <p className="text-sm text-slate-300">No requests available.</p>
            ) : null}
          </div>
        )}
      </Card>
    </div>
  );
}

function RequestListItem({ item }: { item: RequestRecord }) {
  return (
    <Link
      href={`/customer/requests/${item.id}`}
      className="block rounded-xl border border-white/15 bg-white/5 p-4 transition hover:border-white/25"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-base font-semibold text-white">{item.title}</h3>
        <Badge className="capitalize">{formatStatusLabel(item.status)}</Badge>
      </div>
      <p className="mt-1 text-sm text-slate-200/85">
        {item.description || "No description"}
      </p>
      <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-300">
        <Badge className="uppercase">{item.priority}</Badge>
        <span>Updated {new Date(item.updated_at).toLocaleString()}</span>
      </div>
    </Link>
  );
}
