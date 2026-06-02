"use client";

import { FormEvent, useMemo, useState } from "react";
import { MessageSquare, X } from "lucide-react";
import type { MockAiPrompt } from "@/features/mock/dashboard-data";

interface DashboardChatbotProps {
  roleLabel: string;
  prompts?: MockAiPrompt[];
}

interface ChatMessage {
  id: string;
  role: "assistant" | "user";
  text: string;
  createdAt: string;
}

const DEFAULT_PROMPTS = [
  "Show SLA risks for my team",
  "Summarize workflow status",
  "Draft a customer update",
] as const;

function createMessage(role: "assistant" | "user", text: string): ChatMessage {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    role,
    text,
    createdAt: new Date().toISOString(),
  };
}

function buildReply(prompt: string, roleLabel: string): string {
  const normalized = prompt.toLowerCase();

  if (normalized.includes("sla") || normalized.includes("risk")) {
    return `${roleLabel}: Highest risk items are concentrated in urgent and high-priority work. Start with the top 2 blocked items and assign owners for the next 2 hours.`;
  }

  if (
    normalized.includes("workflow") ||
    normalized.includes("status") ||
    normalized.includes("summary") ||
    normalized.includes("digest")
  ) {
    return `${roleLabel}: Workflow summary is healthy overall, with a small blocked queue requiring follow-up. Suggested action is to clear blocked items first, then review in-progress handoffs.`;
  }

  if (
    normalized.includes("draft") ||
    normalized.includes("reply") ||
    normalized.includes("update")
  ) {
    return "Draft update: We are actively tracking your request, current work remains in progress, and the next milestone is scheduled within this cycle. We will share another update after the checkpoint completes.";
  }

  return "I can help with SLA risks, workflow summaries, and draft updates. Try one of the starter prompts below.";
}

export function DashboardChatbot({
  roleLabel,
  prompts = [],
}: DashboardChatbotProps) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([
    createMessage(
      "assistant",
      `${roleLabel} assistant is ready. Ask a question and I will reply with a basic mock answer.`,
    ),
  ]);

  const starterPrompts = useMemo(() => {
    const fromPack = prompts.map((item) => item.prompt);
    const merged = [...fromPack, ...DEFAULT_PROMPTS];
    return Array.from(new Set(merged)).slice(0, 3);
  }, [prompts]);

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const prompt = input.trim();
    if (!prompt) {
      return;
    }

    const userMessage = createMessage("user", prompt);
    const assistantMessage = createMessage(
      "assistant",
      buildReply(prompt, roleLabel),
    );
    setMessages((current) => [...current, userMessage, assistantMessage]);
    setInput("");
  };

  return (
    <>
      {open ? (
        <section className="fixed bottom-24 right-4 z-50 w-[min(30rem,calc(100vw-2rem))] rounded-2xl border border-white/15 bg-ink/95 p-4 shadow-panel backdrop-blur">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-white">Ops Copilot</p>
              <p className="mt-0.5 text-xs text-slate-300">
                {roleLabel} assistant for quick mock answers.
              </p>
            </div>
            <button
              type="button"
              aria-label="Close chatbot"
              onClick={() => setOpen(false)}
              className="rounded-lg border border-white/15 bg-white/5 p-1.5 text-slate-200 hover:bg-white/10"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {starterPrompts.map((prompt) => (
              <button
                key={prompt}
                type="button"
                className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs text-slate-100 transition hover:bg-white/10"
                onClick={() => setInput(prompt)}
              >
                {prompt}
              </button>
            ))}
          </div>

          <div className="mt-3 max-h-64 space-y-2 overflow-y-auto rounded-xl border border-white/10 bg-black/20 p-3">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`max-w-[92%] rounded-xl px-3 py-2 text-sm ${
                  message.role === "assistant"
                    ? "bg-teal-500/20 text-teal-100"
                    : "ml-auto bg-coral/85 text-white"
                }`}
              >
                <p>{message.text}</p>
                <p className="mt-1 text-[11px] text-slate-100/70">
                  {new Date(message.createdAt).toLocaleTimeString()}
                </p>
              </div>
            ))}
          </div>

          <form className="mt-3 flex gap-2" onSubmit={onSubmit}>
            <input
              className="h-11 w-full rounded-xl border border-white/20 bg-white/5 px-3 text-sm text-white placeholder:text-slate-300/70 focus:outline-none focus:ring-2 focus:ring-teal-400"
              placeholder="Ask Ops Copilot"
              value={input}
              onChange={(event) => setInput(event.target.value)}
            />
            <button
              type="submit"
              className="h-11 rounded-xl bg-teal-500 px-4 text-sm font-medium text-white transition hover:bg-teal-400"
            >
              Ask
            </button>
          </form>
        </section>
      ) : null}

      <button
        type="button"
        aria-label="Open chatbot"
        onClick={() => setOpen((value) => !value)}
        className="fixed bottom-5 right-4 z-50 inline-flex h-14 items-center gap-2 rounded-full border border-white/15 bg-teal-500 px-4 text-sm font-semibold text-white shadow-panel transition hover:bg-teal-400"
      >
        <MessageSquare className="h-4 w-4" />
        Copilot
      </button>
    </>
  );
}
