"use client";

import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useCustomerJourneyStore } from "@/store/customer-journey-store";

export default function PartnerInboxPage() {
  const {
    suiteRequests,
    partnerNotifications,
    remindSuiteDocument,
    reviewSuiteRequest,
    markPartnerNotificationRead,
  } = useCustomerJourneyStore();

  const grouped = useMemo(() => {
    const map = new Map<string, typeof suiteRequests>();
    suiteRequests.forEach((request) => {
      const key = request.suite;
      map.set(key, [...(map.get(key) ?? []), request]);
    });
    return map;
  }, [suiteRequests]);

  const providers = ["finance", "sales_ops", "marketing", "legal", "hr"];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm uppercase tracking-[0.18em] text-cyan-200/80">
            Phase 2
          </p>
          <h2 className="text-3xl font-semibold text-white">Partner Inbox</h2>
        </div>
        <Badge>{providers.length} Service Providers</Badge>
      </div>

      <Card
        title="Default Provider Queues"
        description="By default there are five providers, one for each corporate suite."
      >
        <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {providers.map((suite) => {
            const queue = grouped.get(suite) ?? [];
            return (
              <article
                key={suite}
                className="rounded-xl border border-white/15 bg-white/5 p-4"
              >
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-base font-semibold capitalize text-white">
                    {suite.replaceAll("_", " ")} Provider
                  </h3>
                  <Badge>{queue.length} items</Badge>
                </div>

                {queue.length > 0 ? (
                  <div className="mt-2 space-y-2">
                    {queue.map((item) => (
                      <div
                        key={item.id}
                        className="rounded-lg border border-white/10 p-2"
                      >
                        <p className="text-sm text-white capitalize">
                          {item.title}
                        </p>
                        <p className="mt-1 text-xs text-slate-300">
                          Status: {item.status.replaceAll("_", " ")}
                        </p>
                        <p className="mt-1 text-xs text-slate-300">
                          Decision: {item.partnerDecision}
                        </p>
                        <p className="mt-1 text-xs text-slate-300">
                          SLA: {item.slaTargetHours}h
                        </p>
                        <p className="mt-1 text-xs text-slate-300">
                          PO required: {item.poRequired ? "Yes" : "No"}
                        </p>
                        <p className="mt-1 text-xs text-slate-300">
                          Required docs: {item.requiredDocs.join(", ")}
                        </p>
                        <p className="mt-1 text-xs text-slate-300">
                          Services: {item.serviceOfferings.join(" | ")}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <Button
                            onClick={() =>
                              reviewSuiteRequest(item.id, "accepted")
                            }
                            disabled={item.partnerDecision === "accepted"}
                          >
                            Accept
                          </Button>
                          <Button
                            variant="danger"
                            onClick={() =>
                              reviewSuiteRequest(item.id, "rejected")
                            }
                            disabled={item.partnerDecision === "rejected"}
                          >
                            Reject
                          </Button>
                          <Button
                            variant="ghost"
                            onClick={() =>
                              remindSuiteDocument(
                                item.suite,
                                item.requiredDocs[item.receivedDocs.length] ??
                                  item.requiredDocs[0],
                              )
                            }
                          >
                            Request Customer Docs
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-2 text-sm text-slate-300">
                    No activated work yet. Customer must complete onboarding
                    first.
                  </p>
                )}
              </article>
            );
          })}
        </div>
      </Card>

      <Card
        title="Partner Notifications"
        description="Automatic alerts for new requests, customer uploads, and SLA starts."
      >
        <div className="space-y-2">
          {partnerNotifications.map((item) => (
            <button
              key={item.id}
              className={`w-full rounded-xl border px-3 py-2 text-left text-sm transition ${
                item.read
                  ? "border-white/10 bg-white/5 text-slate-200"
                  : "border-cyan-300/40 bg-cyan-400/10 text-white"
              }`}
              onClick={() => markPartnerNotificationRead(item.id)}
            >
              <p>{item.message}</p>
              <p className="mt-1 text-[11px] text-slate-300">
                {new Date(item.createdAt).toLocaleString()}
              </p>
            </button>
          ))}
          {partnerNotifications.length === 0 ? (
            <p className="text-sm text-slate-300">
              No partner notifications yet.
            </p>
          ) : null}
        </div>
      </Card>
    </div>
  );
}
