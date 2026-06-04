"use client";

import { DocumentManager } from "@/features/documents/document-manager";
import { CustomerRequirementsChecklist } from "@/features/documents/customer-requirements-checklist";
import { useCustomerContext } from "@/hooks/use-customer-context";

export default function CustomerDocumentsPage() {
  const customerContext = useCustomerContext();

  if (customerContext.isLoading) {
    return <p className="text-sm text-slate-300">Loading documents...</p>;
  }

  if (customerContext.isError || !customerContext.data) {
    return (
      <p className="text-sm text-red-300">
        Could not load your document workspace right now.
      </p>
    );
  }

  const bucket =
    process.env.NEXT_PUBLIC_CUSTOMER_DOCUMENTS_BUCKET?.trim() || "documents";
  const prefix = `organizations/${customerContext.data.organizationId}/customers/${customerContext.data.userId}`;

  return (
    <div className="space-y-6">
      <CustomerRequirementsChecklist
        organizationId={customerContext.data.organizationId}
        bucket={bucket}
        prefix={prefix}
      />
      <DocumentManager
        title="Customer Documents"
        description="Centralized document workspace for customer operations."
        bucket={bucket}
        prefix={prefix}
      />
    </div>
  );
}
