"use client";

import { FormEvent, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  MOCK_CUSTOMER_ID,
  MOCK_CUSTOMER_REQUESTS,
  MOCK_REQUEST_MESSAGES,
  type MockMessage,
} from "@/features/mock/dashboard-data";

export default function CustomerRequestDetailPage() {
  const params = useParams<{ id: string }>();
  const requestId = params?.id ?? "";
  const [messageBody, setMessageBody] = useState("");
  const [messagesByRequest, setMessagesByRequest] = useState(
    MOCK_REQUEST_MESSAGES,
  );

  const request = useMemo(
    () => MOCK_CUSTOMER_REQUESTS.find((item) => item.id === requestId),
    [requestId],
  );

  const messages = useMemo(
    () => messagesByRequest[requestId] ?? [],
    [messagesByRequest, requestId],
  );

  const timeline = useMemo(() => {
    const req = request;
    if (!req) {
      return [] as Array<{
        label: string;
        at: string;
        tone: "neutral" | "accent";
      }>;
    }

    const events = [
      {
        label: "Request created",
        at: req.created_at,
        tone: "neutral" as const,
      },
      {
        label: `Status updated to ${req.status.replaceAll("_", " ")}`,
        at: req.updated_at,
        tone: "accent" as const,
      },
    ];

    return events.sort(
      (a, b) => new Date(a.at).getTime() - new Date(b.at).getTime(),
    );
  }, [request]);

  const onSend = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!requestId || !messageBody.trim()) {
      return;
    }

    const newMessage: MockMessage = {
      id: `MSG-${Math.floor(Math.random() * 90000) + 10000}`,
      request_id: requestId,
      sender_id: MOCK_CUSTOMER_ID,
      sender_name: "You",
      body: messageBody.trim(),
      created_at: new Date().toISOString(),
    };

    setMessagesByRequest((current) => ({
      ...current,
      [requestId]: [...(current[requestId] ?? []), newMessage],
    }));
    setMessageBody("");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm uppercase tracking-[0.18em] text-cyan-200/80">
            Phase 2
          </p>
          <h2 className="text-3xl font-semibold text-white">Request Detail</h2>
        </div>
        {request ? (
          <Badge className="capitalize">
            {request.status.replaceAll("_", " ")}
          </Badge>
        ) : null}
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.2fr_1fr]">
        <Card
          title="Request Overview"
          description="Hardcoded status, ownership and priority context."
        >
          {request ? (
            <div className="space-y-2 text-sm text-slate-100/90">
              <p className="text-base font-semibold text-white">
                {request.title}
              </p>
              <p>{request.description || "No description provided."}</p>
              <div className="flex flex-wrap gap-2 pt-1 text-xs text-slate-300">
                <span className="rounded-full bg-white/10 px-2 py-1 uppercase">
                  {request.priority}
                </span>
                <span>
                  Created {new Date(request.created_at).toLocaleString()}
                </span>
                <span>
                  Updated {new Date(request.updated_at).toLocaleString()}
                </span>
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-300">
              Request not found in demo dataset.
            </p>
          )}
        </Card>

        <Card
          title="Timeline"
          description="State transition history for this request."
        >
          <div className="space-y-3">
            {timeline.map((item, index) => (
              <div key={`${item.label}-${index}`} className="flex gap-3">
                <div
                  className={`mt-1 h-2.5 w-2.5 rounded-full ${
                    item.tone === "accent" ? "bg-coral" : "bg-white/60"
                  }`}
                />
                <div>
                  <p className="text-sm text-white">{item.label}</p>
                  <p className="text-xs text-slate-300">
                    {new Date(item.at).toLocaleString()}
                  </p>
                </div>
              </div>
            ))}
            {timeline.length === 0 ? (
              <p className="text-sm text-slate-300">No timeline events.</p>
            ) : null}
          </div>
        </Card>
      </div>

      <Card
        title="Conversation"
        description="Request-specific thread with partner and support teams."
      >
        <div className="max-h-80 space-y-2 overflow-y-auto rounded-xl border border-white/10 bg-black/15 p-3">
          {messages.map((item) => {
            const mine = item.sender_id === MOCK_CUSTOMER_ID;
            return (
              <div
                key={item.id}
                className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${
                  mine
                    ? "ml-auto bg-coral/85 text-white"
                    : "bg-white/10 text-slate-100"
                }`}
              >
                <p>{item.body}</p>
                <p className="mt-1 text-[11px] text-slate-100/70">
                  {new Date(item.created_at).toLocaleString()}
                </p>
              </div>
            );
          })}
          {messages.length === 0 ? (
            <p className="text-sm text-slate-300">No messages yet.</p>
          ) : null}
        </div>

        <form className="mt-3 flex gap-2" onSubmit={onSend}>
          <input
            className="h-11 w-full rounded-xl border border-white/20 bg-white/5 px-3 text-sm text-white placeholder:text-slate-300/70 focus:outline-none focus:ring-2 focus:ring-coral"
            placeholder="Send an update"
            value={messageBody}
            onChange={(event) => setMessageBody(event.target.value)}
          />
          <Button type="submit">Send</Button>
        </form>
      </Card>
    </div>
  );
}
