"use client";

import Link from "next/link";
import { useEffect, useMemo } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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

export default function CustomerRequestDetailPage() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const requestId = params?.id ?? "";

  const { suiteRequests, uploadSuiteDocument, markSuiteRequestViewed } =
    useCustomerJourneyStore();

  const suiteRequest = useMemo(
    () => suiteRequests.find((item) => item.id === requestId) ?? null,
    [suiteRequests, requestId],
  );

  useEffect(() => {
    if (suiteRequest) {
      markSuiteRequestViewed(suiteRequest.id);
    }
  }, [suiteRequest, markSuiteRequestViewed]);

  const isCustomRequest = searchParams.get("kind") === "custom";
  const customRequest = isCustomRequest
    ? {
        title: searchParams.get("title") ?? "Custom Request",
        description: searchParams.get("description") ?? "No description",
        status: searchParams.get("status") ?? "submitted",
        priority: searchParams.get("priority") ?? "medium",
        createdAt: searchParams.get("createdAt"),
        updatedAt: searchParams.get("updatedAt"),
      }
    : null;

  const pendingDocs = suiteRequest
    ? suiteRequest.requiredDocs.filter(
        (doc) => !suiteRequest.receivedDocs.includes(doc),
      )
    : [];
  const nextDoc = pendingDocs[0];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-3xl font-semibold text-white">Request Detail</h2>
        {suiteRequest ? (
          <Badge className="capitalize">
            {formatStatusLabel(suiteRequest.status)}
          </Badge>
        ) : customRequest ? (
          <Badge className="capitalize">
            {formatStatusLabel(customRequest.status)}
          </Badge>
        ) : null}
      </div>

      {suiteRequest ? (
        <Card title="Suite Request">
          <div className="space-y-3 text-sm text-slate-100">
            <p className="text-lg font-semibold text-white">
              {formatSuiteLabel(suiteRequest.suite)}
            </p>
            <p>{suiteRequest.title}</p>
            <div className="flex flex-wrap gap-2 text-xs text-slate-300">
              <Badge className="capitalize">
                {formatStatusLabel(suiteRequest.status)}
              </Badge>
              <Badge className="capitalize">
                Partner: {suiteRequest.partnerDecision}
              </Badge>
              <Badge>SLA: {suiteRequest.slaTargetHours}h</Badge>
              <Badge className="uppercase">{suiteRequest.priority}</Badge>
            </div>
            <p className="text-xs text-slate-300">
              Services: {suiteRequest.serviceOfferings.join(" | ")}
            </p>
            <p className="text-xs text-slate-300">
              Required docs: {suiteRequest.requiredDocs.join(", ")}
            </p>
            <p className="text-xs text-slate-300">
              Pending docs:{" "}
              {pendingDocs.length > 0 ? pendingDocs.join(", ") : "None"}
            </p>
            <div>
              <Button
                onClick={() => {
                  if (!nextDoc) {
                    return;
                  }
                  uploadSuiteDocument(suiteRequest.id, nextDoc);
                }}
                disabled={!nextDoc}
              >
                {nextDoc ? `Upload ${nextDoc}` : "All docs uploaded"}
              </Button>
            </div>
            {suiteRequest.slaDueAt ? (
              <p className="text-xs text-cyan-200">
                SLA due: {new Date(suiteRequest.slaDueAt).toLocaleString()}
              </p>
            ) : null}
          </div>
        </Card>
      ) : customRequest ? (
        <Card title="Custom Request">
          <div className="space-y-3 text-sm text-slate-100">
            <p className="text-lg font-semibold text-white">
              {customRequest.title}
            </p>
            <div className="flex flex-wrap gap-2 text-xs text-slate-300">
              <Badge className="capitalize">
                {formatStatusLabel(customRequest.status)}
              </Badge>
              <Badge className="uppercase">{customRequest.priority}</Badge>
            </div>
            <p>{customRequest.description}</p>
            {customRequest.createdAt ? (
              <p className="text-xs text-slate-300">
                Created: {new Date(customRequest.createdAt).toLocaleString()}
              </p>
            ) : null}
            {customRequest.updatedAt ? (
              <p className="text-xs text-slate-300">
                Updated: {new Date(customRequest.updatedAt).toLocaleString()}
              </p>
            ) : null}
          </div>
        </Card>
      ) : (
        <Card title="Request not found">
          <p className="text-sm text-slate-300">
            This request could not be loaded.
          </p>
        </Card>
      )}

      <div>
        <Link href="/customer/requests">
          <Button variant="ghost">Back to requests</Button>
        </Link>
      </div>
    </div>
  );
}
