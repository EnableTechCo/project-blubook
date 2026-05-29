import { PhaseWorkspace } from "@/features/operations/phase-workspace";
import { WorkflowPipeline } from "@/features/operations/workflow-pipeline";
import { SALES_WORKFLOW_STATES } from "@/constants/workflow-states";

export default function SalesOrdersPage() {
  return (
    <div className="space-y-6">
      <PhaseWorkspace
        phase="Phase 3"
        title="Sales Orders"
        subtitle="Customer purchase orders through validation and workflow transitions."
        metrics={[
          { label: "PO Received", value: "28", hint: "Current queue" },
          { label: "Validated", value: "21", hint: "Ready for reservation" },
          { label: "Reserved", value: "19", hint: "Inventory locked" },
          { label: "Shipped", value: "12", hint: "Completed flow" },
        ]}
        streams={[
          {
            title: "Order Governance",
            items: [
              "Customer PO intake with schema checks",
              "Validation rules and exception review",
              "Automatic work-order generation trigger",
            ],
          },
          {
            title: "Execution Handoff",
            items: [
              "Inventory reservation linkage",
              "Pick ticket and manufacturing queue sync",
              "Shipment handoff status broadcast",
            ],
          },
        ]}
      />
      <WorkflowPipeline
        title="Sales Lifecycle"
        states={SALES_WORKFLOW_STATES}
      />
    </div>
  );
}
