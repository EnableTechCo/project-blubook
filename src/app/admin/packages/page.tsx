import { AdminBundleCatalog } from "@/features/admin/admin-bundle-catalog";
import { PhaseWorkspace } from "@/features/operations/phase-workspace";

export default function AdminWorkflowsPage() {
  return (
    <div>
      <div className="py-10">
        <PhaseWorkspace
          phase="Phase 4"
          title="Package Management"
          subtitle="Create, organize and maintain service packages that customers can browse and request."
          metrics={[
            {
              label: "Packages",
              value: "4",
              hint: "Created service offerings",
            },
          ]}
          streams={[
            {
              title: "Package Configuration",
              items: [
                "Create and edit service packages",
                "Define package descriptions",
                "Configure pricing and billing cycles",
              ],
            },
            {
              title: "Service Bundling",
              items: [
                "Add package features",
                "Group related services together",
                "Maintain package offerings",
              ],
            },
          ]}
        />
      </div>
      
      <AdminBundleCatalog
        title="Service Bundles"
        subtitle=""
        mode="select"
        actionLabel="Edit Bundle"
      />
    </div>
    
  );
}
