"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  MOCK_CUSTOMER_ID,
  MOCK_CUSTOMER_REQUESTS,
  MOCK_REQUEST_MESSAGES,
  type MockMessage,
} from "@/features/mock/dashboard-data";

export default function CustomerMessagesPage() {
  const [selectedRequestId, setSelectedRequestId] = useState(
    MOCK_CUSTOMER_REQUESTS[0]?.id ?? "",
  );
  const [messageBody, setMessageBody] = useState("");
  const [messagesByRequest, setMessagesByRequest] = useState(
    MOCK_REQUEST_MESSAGES,
  );

  const requests = MOCK_CUSTOMER_REQUESTS;

  useEffect(() => {
    if (!selectedRequestId && requests.length > 0) {
      setSelectedRequestId(requests[0].id);
    }
  }, [requests, selectedRequestId]);

  const selectedRequest = useMemo(
    () => requests.find((item) => item.id === selectedRequestId),
    [requests, selectedRequestId],
  );

  const selectedMessages = useMemo(
    () => messagesByRequest[selectedRequestId] ?? [],
    [messagesByRequest, selectedRequestId],
  );

  const onSend = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedRequestId || !messageBody.trim()) {
      return;
    }

    const newMessage: MockMessage = {
      id: `MSG-${Math.floor(Math.random() * 90000) + 10000}`,
      request_id: selectedRequestId,
      sender_id: MOCK_CUSTOMER_ID,
      sender_name: "You",
      body: messageBody.trim(),
      created_at: new Date().toISOString(),
    };

    setMessagesByRequest((current) => ({
      ...current,
      [selectedRequestId]: [...(current[selectedRequestId] ?? []), newMessage],
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
          <h2 className="text-3xl font-semibold text-white">
            Customer Messages
          </h2>
        </div>
        <Badge>Demo Threads</Badge>
      </div>

      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        <Card
          title="Threads"
          description="Requests become conversation channels."
        >
          <div className="mt-2 space-y-2">
            {requests.map((item) => (
              <button
                key={item.id}
                className={`w-full rounded-xl border px-3 py-2 text-left text-sm transition ${
                  item.id === selectedRequestId
                    ? "border-coral bg-coral/20 text-white"
                    : "border-white/15 bg-white/5 text-slate-100 hover:bg-white/10"
                }`}
                onClick={() => setSelectedRequestId(item.id)}
              >
                <p className="font-semibold">{item.title}</p>
                <p className="mt-1 text-xs capitalize text-slate-200/80">
                  {item.status.replaceAll("_", " ")}
                </p>
              </button>
            ))}
          </div>
        </Card>

        <Card
          title={selectedRequest ? selectedRequest.title : "Conversation"}
          description="Live request thread between customer and partner teams."
        >
          {!selectedRequestId ? (
            <p className="text-sm text-slate-300">
              Select a request to open messages.
            </p>
          ) : null}

          <div className="mt-2 max-h-96 space-y-2 overflow-y-auto rounded-xl border border-white/10 bg-black/15 p-3">
            {selectedMessages.map((item) => {
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
          </div>

          <form className="mt-3 flex gap-2" onSubmit={onSend}>
            <input
              className="h-11 w-full rounded-xl border border-white/20 bg-white/5 px-3 text-sm text-white placeholder:text-slate-300/70 focus:outline-none focus:ring-2 focus:ring-coral"
              placeholder="Type a message"
              value={messageBody}
              onChange={(event) => setMessageBody(event.target.value)}
              disabled={!selectedRequestId}
            />
            <Button type="submit" disabled={!selectedRequestId}>
              Send
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
