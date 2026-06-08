export interface PartnerUploadFileType {
  key: string;
  stream: string;
  label: string;
  evidenceType: "document" | "credential" | "declaration";
}

// Keep this aligned with requirement templates seeded in customer requirements migrations.
export const PARTNER_UPLOAD_FILE_TYPES: PartnerUploadFileType[] = [
  {
    key: "it-hosting-company-registration",
    stream: "IT Hosting",
    label: "Company registration documents",
    evidenceType: "document",
  },
  {
    key: "it-hosting-domain-ownership",
    stream: "IT Hosting",
    label: "Domain ownership proof",
    evidenceType: "document",
  },
  {
    key: "it-hosting-dns-access",
    stream: "IT Hosting",
    label: "DNS and hosting access handover",
    evidenceType: "credential",
  },
  {
    key: "provider-afrihost-migration-window",
    stream: "IT Hosting",
    label: "Hosting migration window approval",
    evidenceType: "declaration",
  },
  {
    key: "financial-tax-registration",
    stream: "Financial Accounting",
    label: "Tax and VAT registration",
    evidenceType: "document",
  },
  {
    key: "financial-bank-statements",
    stream: "Financial Accounting",
    label: "Latest bank statements",
    evidenceType: "document",
  },
  {
    key: "financial-ledger-export",
    stream: "Financial Accounting",
    label: "Ledger and trial balance export",
    evidenceType: "document",
  },
  {
    key: "provider-smtax-vat-history",
    stream: "Financial Accounting",
    label: "VAT filing history",
    evidenceType: "document",
  },
  {
    key: "hr-employee-register",
    stream: "Human Resources",
    label: "Employee register",
    evidenceType: "document",
  },
  {
    key: "hr-contract-pack",
    stream: "Human Resources",
    label: "Employment contract pack",
    evidenceType: "document",
  },
  {
    key: "hr-payroll-compliance",
    stream: "Human Resources",
    label: "Payroll compliance records",
    evidenceType: "document",
  },
  {
    key: "marketing-brand-assets",
    stream: "Marketing",
    label: "Brand identity assets",
    evidenceType: "document",
  },
  {
    key: "marketing-channel-access",
    stream: "Marketing",
    label: "Channel access credentials",
    evidenceType: "credential",
  },
  {
    key: "marketing-approval-matrix",
    stream: "Marketing",
    label: "Content approval matrix",
    evidenceType: "declaration",
  },
  {
    key: "support-sla-matrix",
    stream: "Post Sales Support",
    label: "Support SLA matrix",
    evidenceType: "document",
  },
  {
    key: "support-escalation-contacts",
    stream: "Post Sales Support",
    label: "Escalation contact list",
    evidenceType: "document",
  },
  {
    key: "support-knowledge-base",
    stream: "Post Sales Support",
    label: "Knowledge base and scripts",
    evidenceType: "document",
  },
  {
    key: "provider-callforce-call-handbook",
    stream: "Post Sales Support",
    label: "Call handling handbook",
    evidenceType: "document",
  },
  {
    key: "shipping-label",
    stream: "Logistics",
    label: "Shipping label",
    evidenceType: "document",
  },
  {
    key: "proof-of-delivery",
    stream: "Logistics",
    label: "Proof of delivery",
    evidenceType: "document",
  },
  {
    key: "salesops-product-pricing",
    stream: "Sales Ops",
    label: "Product and pricing master",
    evidenceType: "document",
  },
  {
    key: "salesops-approval-matrix",
    stream: "Sales Ops",
    label: "Quote and discount approvals",
    evidenceType: "document",
  },
  {
    key: "salesops-crm-pipeline",
    stream: "Sales Ops",
    label: "CRM pipeline definitions",
    evidenceType: "document",
  },
  {
    key: "provider-wns-forecast-template",
    stream: "Sales Ops",
    label: "Forecast template and cadence",
    evidenceType: "document",
  },
  {
    key: "legal-contract-templates",
    stream: "Legal",
    label: "Contract template set",
    evidenceType: "document",
  },
  {
    key: "legal-governance-register",
    stream: "Legal",
    label: "Governance and compliance register",
    evidenceType: "document",
  },
  {
    key: "consulting-kpi-baseline",
    stream: "Mgt Consulting",
    label: "KPI baseline pack",
    evidenceType: "document",
  },
  {
    key: "consulting-process-maps",
    stream: "Mgt Consulting",
    label: "Process maps",
    evidenceType: "document",
  },
  {
    key: "office-authorized-users",
    stream: "Office",
    label: "Authorized user list",
    evidenceType: "document",
  },
  {
    key: "office-health-safety",
    stream: "Office",
    label: "Health and safety declarations",
    evidenceType: "declaration",
  },
];
