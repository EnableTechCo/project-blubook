// ── Types ─────────────────────────────────────────────────────────────────────

export interface MessageRecord {
  id: string;
  body: string;
  created_at: string;
  sender_id: string;
}

export interface RequestContext {
  title: string;
  status: string;
  priority: string;
  description: string | null;
}

// ── Summary ───────────────────────────────────────────────────────────────────
// TODO: replace this function body with a real LLM API call.
// Expected interface:
//   POST /api/ai/messages/summarize
//   body: { messages: MessageRecord[], request: RequestContext }
//   response: { summary: string }

export function generateSummary(
  messages: MessageRecord[],
  request: RequestContext,
): string {
  if (messages.length === 0) {
    return `No messages on this ${request.title} request yet.`;
  }

  const first = messages[0]!;
  const latest = messages[messages.length - 1]!;
  const unresolved = deriveOpenItems(request.status);

  const parts: string[] = [
    `Thread on "${request.title}" (${humanStatus(request.status)}, ${request.priority} priority).`,
    `${messages.length} message${messages.length === 1 ? "" : "s"} exchanged.`,
    `Started ${timeAgo(first.created_at)}.`,
  ];

  if (messages.length > 1) {
    const preview = latest.body.slice(0, 120).trim();
    parts.push(
      `Latest: "${preview}${latest.body.length > 120 ? "…" : ""}"`,
    );
  }

  if (unresolved) {
    parts.push(`Open item: ${unresolved}`);
  }

  return parts.join(" ");
}

// ── Suggested replies ─────────────────────────────────────────────────────────
// TODO: replace this function body with a real LLM API call.
// Expected interface:
//   POST /api/ai/messages/suggest-replies
//   body: { messages: MessageRecord[], request: RequestContext, role: string }
//   response: { suggestions: string[] }

export function generateSuggestedReplies(
  _messages: MessageRecord[],
  request: RequestContext,
  role: string,
): string[] {
  const status = request.status;

  if (role === "partner") {
    return partnerReplies(status);
  }

  return customerReplies(status);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function customerReplies(status: string): string[] {
  switch (status) {
    case "pending":
    case "submitted":
      return [
        "Could you give me an update on where this stands?",
        "Please let me know if you need any additional information from me.",
        "I wanted to follow up — is there anything holding this up?",
      ];
    case "in_progress":
      return [
        "Thank you for the update. Please keep me posted.",
        "Understood. Let me know if there's anything you need from my side.",
        "Sounds good — I'll be standing by.",
      ];
    case "rejected":
    case "cancelled":
      return [
        "Could you clarify what needs to be corrected?",
        "Thank you for the feedback. I'll make the necessary changes and resubmit.",
      ];
    case "completed":
    case "approved":
      return [
        "Thank you — everything looks good on my end.",
        "Appreciated, I'll follow up if anything else comes up.",
      ];
    default:
      return [
        "Please let me know if there are any updates.",
        "Happy to provide any additional information if needed.",
      ];
  }
}

function partnerReplies(status: string): string[] {
  switch (status) {
    case "pending":
    case "submitted":
      return [
        "We've received this and are reviewing it now.",
        "We'll be in touch once the review is complete.",
      ];
    case "in_progress":
      return [
        "We're actively working on this — we'll update you shortly.",
        "Progress is on track. We'll notify you of any changes.",
      ];
    case "rejected":
      return [
        "Please review the feedback and resubmit when ready.",
        "Let us know if you have questions about the requested changes.",
      ];
    case "completed":
    case "approved":
      return [
        "This has been completed. Please confirm everything is in order.",
        "All done on our end — let us know if you need anything else.",
      ];
    default:
      return [
        "We'll review this and get back to you.",
        "Please don't hesitate to reach out if you have questions.",
      ];
  }
}

function humanStatus(status: string): string {
  return status.replace(/_/g, " ");
}

function deriveOpenItems(status: string): string | null {
  switch (status) {
    case "pending":
      return "Awaiting initial review.";
    case "submitted":
      return "Awaiting partner response.";
    case "in_progress":
      return "Work in progress — no action required yet.";
    case "rejected":
      return "Changes requested — review partner feedback.";
    default:
      return null;
  }
}

function timeAgo(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime();
  const days = Math.floor(diff / 86_400_000);
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  const weeks = Math.floor(days / 7);
  if (weeks === 1) return "1 week ago";
  if (weeks < 5) return `${weeks} weeks ago`;
  const months = Math.floor(days / 30);
  return `${months} month${months === 1 ? "" : "s"} ago`;
}
