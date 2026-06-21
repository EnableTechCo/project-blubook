"use client";

import { FormEvent, useMemo, useState, useEffect } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { SelectMenu } from "@/components/ui/select-menu";
import { useCustomerContext } from "@/hooks/use-customer-context";
import {
  useCreateCustomerRequestMutation,
  useGetCustomerRequestsQuery,
} from "@/store/redux/api/customer-api";
import { type RequestRecord } from "@/services/requests.service";

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
  const customerContext = useCustomerContext();
  const customerId = customerContext.data?.userId ?? "";
  const [activeFilter, setActiveFilter] = useState<
    "all" | "open" | "cancelled" | "at_risk"
  >("all");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] =
    useState<(typeof REQUEST_PRIORITIES)[number]>("medium");
  const [submitError, setSubmitError] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState("");
  type SortOption = "newest" | "oldest" | "priority";
  const [sortBy, setSortBy] = useState<SortOption>("newest");
  const [currentPage, setCurrentPage] = useState(1);

  const PAGE_SIZE = 10;

  const requestsQuery = useGetCustomerRequestsQuery(customerId, {
    skip: !customerId,
  });
  const [createRequest, createRequestMutation] =
    useCreateCustomerRequestMutation();

  const requests = useMemo<RequestRecord[]>(() => {
    return Array.isArray(requestsQuery.data) ? requestsQuery.data : [];
  }, [requestsQuery.data]);

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

  const processedRequests = useMemo(() => {
    let result = [...requests];

    // Filtering
    if (activeFilter === "open") {
      result = result.filter(
        (item) => !["completed", "cancelled"].includes(item.status),
      );
    }

    if (activeFilter === "cancelled") {
      result = result.filter((item) => item.status === "cancelled");
    }

    if (activeFilter === "at_risk") {
      result = result.filter(
        (item) =>
          ["urgent", "high"].includes(item.priority) &&
          !["completed", "cancelled"].includes(item.status),
      );
    }

    // Searchin
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();

      result = result.filter(
        (item) =>
          item.title.toLowerCase().includes(q) ||
          item.description?.toLowerCase().includes(q) ||
          item.status.toLowerCase().includes(q),
      );
    }

    // Sorting
    const priorityRank = {
      urgent: 4,
      high: 3,
      medium: 2,
      low: 1,
    } as const;

    result.sort((a, b) => {
      if (sortBy === "oldest") {
        return (
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );
      }

      if (sortBy === "priority") {
        return (
          priorityRank[b.priority as keyof typeof priorityRank] -
          priorityRank[a.priority as keyof typeof priorityRank]
        );
      }

      // newest default
      return (
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    });

    return result;
  }, [requests, activeFilter, searchTerm, sortBy]);

  const paginatedRequests = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return processedRequests.slice(start, start + PAGE_SIZE);
  }, [processedRequests, currentPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [activeFilter, searchTerm, sortBy, requestsQuery.data]);

  useEffect(() => {
    const maxPage = Math.max(
      1,
      Math.ceil(processedRequests.length / PAGE_SIZE),
    );

    setCurrentPage((prev) => Math.min(prev, maxPage));
  }, [processedRequests.length]);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!title.trim() || !customerId) {
      return;
    }

    try {
      await createRequest({
        customerId,
        title: title.trim(),
        description: description.trim() || undefined,
        priority,
      }).unwrap();
      setTitle("");
      setDescription("");
      setPriority("medium");
      setSubmitError(null);
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : "Could not create request.",
      );
    }
  };

  if (customerContext.isLoading) {
    return (
      <p className="text-sm text-slate-600 dark:text-slate-300">
        Loading requests...
      </p>
    );
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
        <h2 className="text-3xl font-semibold text-slate-900 dark:text-white">
          Customer Requests
        </h2>
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
          <p className="text-lg font-semibold text-slate-900 dark:text-white">
            Total
          </p>
          <p className="mt-4 text-3xl font-semibold text-slate-900 dark:text-white">
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
          <p className="text-lg font-semibold text-slate-900 dark:text-white">
            Open
          </p>
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
          <p className="text-lg font-semibold text-slate-900 dark:text-white">
            Cancelled
          </p>
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
          <p className="text-lg font-semibold text-slate-900 dark:text-white">
            At Risk
          </p>
          <p className="mt-4 text-3xl font-semibold text-slate-300">
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
            className="min-h-24 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-coral dark:border-white/20 dark:bg-white/5 dark:text-white dark:placeholder:text-slate-300/60"
            placeholder="Describe what you need from the team"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            maxLength={500}
          />
          <div className="flex flex-wrap items-center gap-3">
            <SelectMenu
              value={priority}
              onChange={(nextValue) =>
                setPriority(nextValue as (typeof REQUEST_PRIORITIES)[number])
              }
              options={REQUEST_PRIORITIES.map((item) => ({
                value: item,
                label: item.toUpperCase(),
              }))}
              className="min-w-[180px]"
            />
            <Button
              type="submit"
              disabled={!title.trim() || createRequestMutation.isLoading}
            >
              {createRequestMutation.isLoading
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
        <div className="flex flex-wrap gap-3 mb-4">
          <Input
            placeholder="Search requests..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />

          <SelectMenu
            value={sortBy}
            onChange={(nextValue) => setSortBy(nextValue as SortOption)}
            options={[
              { value: "newest", label: "Newest" },
              { value: "oldest", label: "Oldest" },
              { value: "priority", label: "Priority" },
            ]}
            className="min-w-[180px]"
          />
        </div>
        {requestsQuery.isLoading ? (
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Loading requests...
          </p>
        ) : requestsQuery.isError ? (
          <p className="text-sm text-red-300">
            Could not load customer requests right now.
          </p>
        ) : (
          <div className="space-y-3">
            {paginatedRequests.map((item) => (
              <RequestListItem key={item.id} item={item} />
            ))}

            {requests.length === 0 ? (
              <p className="text-sm text-slate-600 dark:text-slate-300">
                No requests available.
              </p>
            ) : processedRequests.length === 0 ? (
              <p className="text-sm text-slate-600 dark:text-slate-300">
                No matching results.
              </p>
            ) : null}

            {processedRequests.length >= 0 && (
              <div className="mt-4 flex flex-col items-center gap-3 border-t border-slate-300 pt-4 dark:border-white/10">
                <p className="text-sm text-slate-600 text-center dark:text-slate-300">
                  Showing {(currentPage - 1) * PAGE_SIZE + 1} -{" "}
                  {Math.min(currentPage * PAGE_SIZE, processedRequests.length)}{" "}
                  of {processedRequests.length}
                </p>

                <div className="flex items-center gap-3">
                  <Button
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  >
                    Prev
                  </Button>

                  <span className="px-2 text-sm text-slate-900 dark:text-white">
                    {currentPage} /{" "}
                    {Math.max(
                      1,
                      Math.ceil(processedRequests.length / PAGE_SIZE),
                    )}
                  </span>

                  <Button
                    disabled={
                      currentPage >=
                      Math.ceil(processedRequests.length / PAGE_SIZE)
                    }
                    onClick={() => setCurrentPage((p) => p + 1)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
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
      className="block rounded-xl border border-slate-300 bg-slate-50 p-4 transition hover:border-slate-400 dark:border-white/15 dark:bg-white/5 dark:hover:border-white/25"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-base font-semibold text-slate-900 dark:text-white">
          {item.title}
        </h3>
        <Badge className="capitalize">{formatStatusLabel(item.status)}</Badge>
      </div>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-200/85">
        {item.description || "No description"}
      </p>
      <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-600 dark:text-slate-300">
        <Badge className="uppercase">{item.priority}</Badge>
        <span>Updated {new Date(item.updated_at).toLocaleString()}</span>
      </div>
    </Link>
  );
}
