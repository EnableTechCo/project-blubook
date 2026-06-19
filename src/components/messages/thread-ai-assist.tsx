"use client";

import { useState } from "react";
import { SparklesIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  generateSummary,
  generateSuggestedReplies,
  type MessageRecord,
  type RequestContext,
} from "@/features/ai/message-intelligence";
import { cn } from "@/lib/utils";

const MIN_MESSAGES_FOR_SUMMARY = 3;

interface ThreadAiAssistProps {
  messages: MessageRecord[];
  request: RequestContext;
  role: string;
  onInsertReply: (text: string) => void;
}

export function ThreadAiAssist({
  messages,
  request,
  role,
  onInsertReply,
}: ThreadAiAssistProps) {
  const [summary, setSummary] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);

  const canSummarize = messages.length >= MIN_MESSAGES_FOR_SUMMARY;
  const hasSuggestions = suggestions.length > 0;

  // Simulates async latency — swap the setTimeout body for a real fetch() call
  // when the AI endpoint is ready.
  const handleSummarize = () => {
    setSummaryLoading(true);
    setSummary(null);
    setTimeout(() => {
      setSummary(generateSummary(messages, request));
      setSummaryLoading(false);
    }, 700);
  };

  const handleSuggestReplies = () => {
    setSuggestionsLoading(true);
    setSuggestions([]);
    setTimeout(() => {
      setSuggestions(generateSuggestedReplies(messages, request, role));
      setSuggestionsLoading(false);
    }, 700);
  };

  const handleInsert = (text: string) => {
    onInsertReply(text);
    setSuggestions([]);
  };

  return (
    <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-white/10 dark:bg-white/5">
      <div className="flex flex-wrap items-center gap-2">
        <SparklesIcon className="h-3.5 w-3.5 text-cyan-600 dark:text-cyan-400" />
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
          AI Assist
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {canSummarize ? (
          <Button
            type="button"
            variant="ghost"
            disabled={summaryLoading}
            onClick={handleSummarize}
            className="h-7 px-2.5 text-xs"
          >
            {summaryLoading ? "Summarizing…" : "Summarize thread"}
          </Button>
        ) : null}

        <Button
          type="button"
          variant="ghost"
          disabled={suggestionsLoading}
          onClick={handleSuggestReplies}
          className="h-7 px-2.5 text-xs"
        >
          {suggestionsLoading ? "Generating…" : "Suggest replies"}
        </Button>
      </div>

      {summary ? (
        <div className="relative rounded-lg border border-cyan-200 bg-cyan-50 p-3 dark:border-cyan-400/20 dark:bg-cyan-400/5">
          <button
            type="button"
            aria-label="Dismiss summary"
            className="absolute right-2 top-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            onClick={() => setSummary(null)}
          >
            ✕
          </button>
          <p className="pr-5 text-xs font-semibold uppercase tracking-wide text-cyan-700 dark:text-cyan-300">
            Summary
          </p>
          <p className="mt-1 text-sm text-slate-700 dark:text-slate-200">
            {summary}
          </p>
        </div>
      ) : null}

      {hasSuggestions ? (
        <div className="space-y-1.5">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Click a suggestion to insert it:
          </p>
          <div className="flex flex-col gap-1.5">
            {suggestions.map((text) => (
              <button
                key={text}
                type="button"
                onClick={() => handleInsert(text)}
                className={cn(
                  "rounded-lg border px-3 py-2 text-left text-sm transition",
                  "border-slate-300 bg-white hover:border-cyan-400 hover:bg-cyan-50",
                  "dark:border-white/15 dark:bg-white/5 dark:hover:border-cyan-400/40 dark:hover:bg-cyan-400/10",
                  "text-slate-800 dark:text-slate-100",
                )}
              >
                {text}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
