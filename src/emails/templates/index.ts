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
} as const;

export type EmailTemplateKey = keyof typeof EMAIL_TEMPLATES;
