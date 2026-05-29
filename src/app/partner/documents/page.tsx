"use client";

import { DocumentManager } from "@/features/documents/document-manager";
import { MOCK_PARTNER_DOCUMENTS } from "@/features/mock/dashboard-data";

export default function PartnerDocumentsPage() {
  return (
    <DocumentManager
      title="Partner Documents"
      description="Extensive hardcoded partner artifact library for demo workflows."
      bucket="partner-documents"
      prefix="partners/partner-019"
      mockDocuments={MOCK_PARTNER_DOCUMENTS}
    />
  );
}
