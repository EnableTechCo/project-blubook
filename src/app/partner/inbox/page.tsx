"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  MOCK_CUSTOMER_REQUESTS,
  type MockRequest,
} from "@/features/mock/dashboard-data";

export default function PartnerInboxPage() {
  const [inbox, setInbox] = useState<MockRequest[]>(MOCK_CUSTOMER_REQUESTS);

  const setStatus = (requestId: string, status: MockRequest["status"]) => {
    setInbox((current) =>
      current.map((item) =>
        item.id === requestId
          ? { ...item, status, updated_at: new Date().toISOString() }
          : item,
      ),
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm uppercase tracking-[0.18em] text-cyan-200/80">
            Phase 2
          </p>
          <h2 className="text-3xl font-semibold text-white">Partner Inbox</h2>
        </div>
        <Badge>{inbox.length} Assigned</Badge>
      </div>

      <Card
        title="Assigned Requests"
        description="Hardcoded action queue with status controls for partner-owned work."
      >
        <div className="mt-3 space-y-3">
          {inbox.map((item) => (
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
              <p className="mt-2 text-sm text-slate-200/85">
                {item.description || "No description"}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  variant="ghost"
                  onClick={() => setStatus(item.id, "in_progress")}
                >
                  Mark In Progress
                </Button>
                <Button onClick={() => setStatus(item.id, "completed")}>
                  Mark Complete
                </Button>
                <Button
                  variant="danger"
                  onClick={() => setStatus(item.id, "rejected")}
                >
                  Reject
                </Button>
              </div>
            </article>
          ))}

          {inbox.length === 0 ? (
            <p className="text-sm text-slate-300">
              No assigned requests found.
            </p>
          ) : null}
        </div>
      </Card>
    </div>
  );
}
