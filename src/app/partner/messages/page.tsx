import { PhaseWorkspace } from "@/features/operations/phase-workspace";

export default function PartnerMessagesPage() {
  return (
    <PhaseWorkspace
      phase="Phase 2"
      title="Partner Messages"
      subtitle="Realtime communication with customers and internal staff."
      metrics={[
        { label: "Active Threads", value: "18", hint: "Open conversations" },
        { label: "Unread", value: "6", hint: "Pending responses" },
        { label: "Avg Reply", value: "12m", hint: "Partner response time" },
        { label: "Attachments", value: "42", hint: "Shared this week" },
      ]}
      streams={[
        {
          title: "Realtime Layer",
          items: [
            "Presence channels for active participants",
            "Read receipts and delivery states",
            "Typing indicators for faster coordination",
          ],
        },
        {
          title: "Governance",
          items: [
            "RLS-scoped thread visibility",
            "Attachment policy checks",
            "Message audit metadata retention",
          ],
        },
      ]}
    />
  );
}
