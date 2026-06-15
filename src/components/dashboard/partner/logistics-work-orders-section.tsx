import type { ReactNode } from "react";
import { WorkflowOpsSectionShell } from "@/components/ui/workflow-ops-section-shell";

export function LogisticsWorkOrdersSection({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <WorkflowOpsSectionShell
      tone="cyan"
      title={title}
      description={description}
    >
      {children}
    </WorkflowOpsSectionShell>
  );
}
