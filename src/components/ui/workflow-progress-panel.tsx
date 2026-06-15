import type { ComponentProps } from "react";
import { WorkflowProgress } from "@/components/ui/workflow-progress";

export function WorkflowProgressPanel(
  props: ComponentProps<typeof WorkflowProgress>,
) {
  return <WorkflowProgress {...props} />;
}
