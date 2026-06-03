"use client";

import Link from "next/link";
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

function formatNotificationMessage(message: string) {
  return message
    .replace(/\bfinance\b/gi, "Finance")
    .replace(/\bsales ops\b/gi, "Sales Ops")
    .replace(/\bmarketing\b/gi, "Marketing")
    .replace(/\blegal\b/gi, "Legal")
    .replace(/\bhr\b/g, "HR")
    .replace(/\bhr\b/gi, "HR");
}

export default function CustomerMessagesPage() {
  const {
    packageTier,
    paid,
    onboardingCompleted,
    notifications,
    suiteRequests,
    markNotificationRead,
    uploadSuiteDocument,
  } = useCustomerJourneyStore();

  if (!packageTier || !paid || !onboardingCompleted) {
    return (
      <div className="space-y-6">
        <div>
          <p className="text-sm uppercase tracking-[0.18em] text-cyan-200/80">
            Access Gate
          </p>
          <h2 className="text-3xl font-semibold text-white">
            Customer Messages
          </h2>
        </div>

        <Card
          title="Complete Setup First"
          description="Notifications and suite messaging become active after package payment and onboarding submission."
        >
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
              Go to requests
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
      <div>
        <div>
          <h2 className="text-3xl font-semibold text-white">
            Customer Messages
          </h2>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-1">
        <Card
          title="Suite Notifications"
          description="Finance, Sales Ops, Marketing, Legal, and HR pings appear here."
        >
          <div className="space-y-2">
            {notifications.map((item) => (
              <button
                key={item.id}
                className={`w-full rounded-xl border px-3 py-2 text-left text-sm transition ${
                  item.read
                    ? "border-white/10 bg-white/5 text-slate-200"
                    : "border-coral/50 bg-coral/15 text-white"
                }`}
                onClick={() => markNotificationRead(item.id)}
              >
                <p>{formatNotificationMessage(item.message)}</p>
                <p className="mt-1 text-[11px] text-slate-300">
                  {new Date(item.createdAt).toLocaleString()}
                </p>
              </button>
            ))}
            {notifications.length === 0 ? (
              <p className="text-sm text-slate-300">No notifications yet.</p>
            ) : null}
          </div>
        </Card>

        <Card
          title="Document Requests"
          description="Upload requested docs to unblock provider workflows."
        >
          <div className="space-y-3">
            {suiteRequests.map((item) => {
              const nextDoc =
                item.requiredDocs.find(
                  (doc) => !item.receivedDocs.includes(doc),
                ) ?? item.requiredDocs[0];

              return (
                <div
                  key={item.id}
                  className="rounded-xl border border-white/15 bg-white/5 p-3"
                >
                  <p className="text-sm font-semibold text-white">
                    {formatSuiteLabel(item.suite)}
                  </p>
                  <p className="mt-1 text-xs text-slate-300">
                    Status: {formatStatusLabel(item.status)}
                  </p>
                  <p className="mt-1 text-xs text-slate-300">
                    Next required doc: {nextDoc}
                  </p>
                  <div className="mt-2">
                    <Button
                      onClick={() => uploadSuiteDocument(item.id, nextDoc)}
                    >
                      Upload {nextDoc}
                    </Button>
                  </div>
                </div>
              );
            })}
            {suiteRequests.length === 0 ? (
              <p className="text-sm text-slate-300">
                Complete onboarding to activate suite document requests.
              </p>
            ) : null}
          </div>
        </Card>
      </div>
    </div>
  );
}
