import { PhaseWorkspace } from "@/features/operations/phase-workspace";
import { WORKSPACE_CONTENT } from "@/constants/workspace-content";
import { LogisticsShipmentsClient } from "./logistics-shipments-client";

export default function LogisticsShipmentsPage() {
  const workspace = WORKSPACE_CONTENT.logisticsShipments;

  return (
    <div className="space-y-6">
      <PhaseWorkspace
        phase={workspace.phase}
        title={workspace.title}
        subtitle={workspace.subtitle}
        metrics={workspace.metrics}
        streams={workspace.streams}
      />
      <LogisticsShipmentsClient />
    </div>
  );
}
