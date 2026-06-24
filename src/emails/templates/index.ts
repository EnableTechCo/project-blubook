export const EMAIL_TEMPLATES = {
  "customer-onboarding-complete": {
    subject: "Welcome to BluBook, {{customer_name}}",
    text: "Your {{package_name}} onboarding is complete. Invoice {{invoice_number}} is attached and available in Billing.",
  },
  "partner-invite": {
    subject: "Activate your BluBook Partner access",
    text: "Hello {{invited_name}}, activate your BluBook Partner access using this secure link: {{invite_link}}",
  },
  "admin-invite": {
    subject: "Activate your BluBook Admin access",
    text: "Hello {{invited_name}}, activate your BluBook Admin access using this secure link: {{invite_link}}",
  },
  "sales-po-received": {
    subject: "Purchase Order Received - {{po_number}}",
    text: "Hello {{customer_name}}, your Purchase Order {{po_number}} has been received.",
  },
  "order-delivery-complete": {
    subject: "Order Delivered - {{order_id}}",
    text: "Hello {{customer_name}}, your order {{order_id}} has been completed.",
  }
  "customer-po-submitted": {
    subject: "We've Received Your Purchase Order! — {{po_number}}",
    text: "Hello {{customer_name}}, your PO {{po_number}} is locked in. The relevant BluBook partners are getting to work! ",
  },
  "sales-po-accepted": {
    subject: "INTERNAL CONFIRMATION: PO Accepted — {{po_number}}",
    text: "Team, Purchase Order {{po_number}} for {{customer_name}} has been officially accepted.",
  },
  "logistics-partner-ready": {
    subject: "Consignment Action Required: PO Ready for Dispatch — {{po_number}}",
    text: "Hello {{partner_name}}, a new purchase order ({{po_number}}) is ready for logistics processing.",
  }
} as const;

export type EmailTemplateKey = keyof typeof EMAIL_TEMPLATES;