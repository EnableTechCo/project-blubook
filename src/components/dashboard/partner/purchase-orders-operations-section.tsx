import type { ReactNode } from "react";
import { WorkflowOpsSectionShell } from "@/components/ui/workflow-ops-section-shell";

export function PurchaseOrdersOperationsSection({
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
      tone="amber"
      title={title}
      description={description}
    >
      {children}
    </WorkflowOpsSectionShell>
  );
}
