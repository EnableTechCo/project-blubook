"use client";

import { useState } from "react";
import { DocumentManager } from "@/features/documents/document-manager";
import { CustomerRequirementsChecklist } from "@/features/documents/customer-requirements-checklist";
import { useCustomerContext } from "@/hooks/use-customer-context";

export default function CustomerDocumentsPage() {
  const customerContext = useCustomerContext();
  const [showUploadPanel, setShowUploadPanel] = useState(false);

  if (customerContext.isLoading) {
    return (
      <p className="text-sm text-slate-600 dark:text-slate-300">
        Loading documents...
      </p>
    );
  }

  if (customerContext.isError || !customerContext.data) {
    return (
      <p className="text-sm text-red-700 dark:text-red-300">
        Could not load your document workspace right now.
      </p>
    );
  }

  const bucket =
    process.env.NEXT_PUBLIC_CUSTOMER_DOCUMENTS_BUCKET?.trim() || "documents";
  const prefix = `organizations/${customerContext.data.organizationId}/customers/${customerContext.data.userId}`;

  return (
    <div className="space-y-6">
      <section aria-label="Required documents">
        <div className="mb-2">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            Required Documents
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Track required uploads and see what is still missing.
          </p>
        </div>

        <CustomerRequirementsChecklist
          organizationId={customerContext.data.organizationId}
          bucket={bucket}
          prefix={prefix}
          onToggleUploadPanel={() => setShowUploadPanel((current) => !current)}
          isUploadPanelOpen={showUploadPanel}
          uploadPanel={
            <DocumentManager
              title="Upload"
              description="Upload and store files securely in your workspace."
              bucket={bucket}
              prefix={prefix}
              groupingMode="admin-groups"
              organizationId={customerContext.data.organizationId}
              showUploadSection
              showDocumentsSection={false}
              hideWorkspaceHeader
            />
          }
        />
      </section>

      <section aria-label="Uploaded documents">
        <div className="mb-2">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            Your Documents
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            View and manage the files you uploaded.
          </p>
        </div>
        <DocumentManager
          title="Your Documents"
          description="View and manage your uploaded files."
          bucket={bucket}
          prefix={prefix}
          groupingMode="admin-groups"
          organizationId={customerContext.data.organizationId}
          showUploadSection={false}
          showDocumentsSection
          hideWorkspaceHeader
          showBucketBadge={false}
        />
      </section>
    </div>
  );
}
