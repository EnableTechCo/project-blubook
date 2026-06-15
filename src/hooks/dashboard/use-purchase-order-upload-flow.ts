import { useMemo } from "react";

type UploadFlowStage =
  | "idle"
  | "ensuring_requirement"
  | "uploading_file"
  | "starting_workflow"
  | "waiting_for_order"
  | "complete"
  | "error";

const stageToIndex: Record<UploadFlowStage, number> = {
  idle: 0,
  ensuring_requirement: 0,
  uploading_file: 1,
  starting_workflow: 2,
  waiting_for_order: 3,
  complete: 4,
  error: 1,
};

export function usePurchaseOrderUploadFlow(stage: UploadFlowStage) {
  return useMemo(() => ({ currentIndex: stageToIndex[stage] ?? 0 }), [stage]);
}
