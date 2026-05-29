"use client";

import { DocumentManager } from "@/features/documents/document-manager";
import { MOCK_CUSTOMER_DOCUMENTS } from "@/features/mock/dashboard-data";

export default function CustomerDocumentsPage() {
  return (
    <DocumentManager
      title="Customer Documents"
      description="Extensive hardcoded document library for customer operations demos."
      bucket="customer-documents"
      prefix="customers/cust-001"
      mockDocuments={MOCK_CUSTOMER_DOCUMENTS}
    />
  );
}
