"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useCustomerContext } from "@/hooks/use-customer-context";
import {
  listRequestMessages,
  sendRequestMessage,
} from "@/services/messages.service";
import { getCustomerRequestById } from "@/services/requests.service";

function formatStatusLabel(value: string) {
  return value
    .split("_")
    .map((part) =>
      part.length > 0 ? part[0].toUpperCase() + part.slice(1) : part,
    )
    .join(" ");
}

export default function CustomerRequestDetailPage() {
  const queryClient = useQueryClient();
  const customerContext = useCustomerContext();
  const params = useParams<{ id: string }>();
  const requestId = params?.id ?? "";
  const [messageBody, setMessageBody] = useState("");
  const [messageError, setMessageError] = useState<string | null>(null);

  const requestQuery = useQuery({
    queryKey: ["customer-request", customerContext.data?.userId, requestId],
    enabled: Boolean(customerContext.data?.userId && requestId),
    queryFn: () =>
      getCustomerRequestById({
        customerId: customerContext.data!.userId,
        requestId,
      }),
  });

  const messagesQuery = useQuery({
    queryKey: ["request-messages", requestId],
    enabled: Boolean(requestId),
    queryFn: () => listRequestMessages(requestId),
  });

  const sendMessageMutation = useMutation({
    mutationFn: sendRequestMessage,
    onSuccess: async () => {
      setMessageBody("");
      setMessageError(null);
      await queryClient.invalidateQueries({
        queryKey: ["request-messages", requestId],
      });
    },
    onError: (error) => {
      setMessageError(
        error instanceof Error ? error.message : "Could not send message.",
      );
    },
  });

  const onSubmitMessage = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!customerContext.data?.userId || !messageBody.trim()) {
      return;
    }

    sendMessageMutation.mutate({
      requestId,
      senderId: customerContext.data.userId,
      body: messageBody.trim(),
    });
  };

  if (customerContext.isLoading || requestQuery.isLoading) {
    return <p className="text-sm text-slate-300">Loading request...</p>;
  }

  if (customerContext.isError || !customerContext.data) {
    return (
      <p className="text-sm text-red-300">
        Could not resolve your customer context.
      </p>
    );
  }

  const request = requestQuery.data ?? null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-3xl font-semibold text-white">Request Detail</h2>
        {request ? (
          <Badge className="capitalize">
            {formatStatusLabel(request.status)}
          </Badge>
        ) : null}
      </div>

      {request ? (
        <Card title="Request Overview">
          <div className="space-y-3 text-sm text-slate-100">
            <p className="text-lg font-semibold text-white">{request.title}</p>
            <div className="flex flex-wrap gap-2 text-xs text-slate-300">
              <Badge className="capitalize">
                {formatStatusLabel(request.status)}
              </Badge>
              <Badge className="uppercase">{request.priority}</Badge>
            </div>
            <p>{request.description || "No description"}</p>
            <p className="text-xs text-slate-300">
              Created: {new Date(request.created_at).toLocaleString()}
            </p>
            <p className="text-xs text-slate-300">
              Updated: {new Date(request.updated_at).toLocaleString()}
            </p>
            <Link href="/customer/documents" className="inline-flex">
              <Button>Open documents</Button>
            </Link>
          </div>
        </Card>
      ) : (
        <Card title="Request not found">
          <p className="text-sm text-slate-300">
            This request could not be loaded.
          </p>
        </Card>
      )}

      <Card title="Messages">
        <form className="space-y-3" onSubmit={onSubmitMessage}>
          <textarea
            className="min-h-24 w-full rounded-xl border border-white/20 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-slate-300/60 focus:outline-none focus:ring-2 focus:ring-coral"
            placeholder="Ask a question or add an update"
            value={messageBody}
            onChange={(event) => setMessageBody(event.target.value)}
            maxLength={1000}
          />
          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="submit"
              disabled={!messageBody.trim() || sendMessageMutation.isPending}
            >
              {sendMessageMutation.isPending ? "Sending..." : "Send message"}
            </Button>
            {messageError ? (
              <p className="text-sm text-red-300">{messageError}</p>
            ) : null}
          </div>
        </form>

        <div className="mt-4 space-y-3">
          {messagesQuery.isLoading ? (
            <p className="text-sm text-slate-300">Loading messages...</p>
          ) : messagesQuery.isError ? (
            <p className="text-sm text-red-300">
              Could not load request messages.
            </p>
          ) : messagesQuery.data && messagesQuery.data.length > 0 ? (
            messagesQuery.data.map((message) => (
              <div
                key={message.id}
                className="rounded-xl border border-white/15 bg-white/5 p-3"
              >
                <p className="text-sm text-white">{message.body}</p>
                <p className="mt-1 text-xs text-slate-300">
                  {new Date(message.created_at).toLocaleString()}
                </p>
              </div>
            ))
          ) : (
            <p className="text-sm text-slate-300">
              No messages on this request yet.
            </p>
          )}
        </div>
      </Card>

      <div>
        <Link href="/customer/requests">
          <Button variant="ghost">Back to requests</Button>
        </Link>
      </div>
    </div>
  );
}
