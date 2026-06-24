import path from "node:path";
import { readFile } from "node:fs/promises";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertEmailServerEnv } from "@/lib/env";
import { EMAIL_TEMPLATES, type EmailTemplateKey } from "@/emails/templates";
import { buildInvoicePdf } from "@/lib/email/invoice-pdf";

type QueueEmailInput = {
  templateKey: EmailTemplateKey;
  toEmail: string;
  organizationId?: string | null;
  invoiceId?: string | null;
  invitationId?: string | null;
  subjectFallback: string;
  payload?: Record<string, unknown>;
};

type OutboundEmailRow = {
  id: string;
  template_key: EmailTemplateKey;
  to_email: string;
  subject: string;
  payload: Record<string, unknown> | null;
};

type ResendAttachment = {
  filename: string;
  content: string;
};

const TEMPLATE_FILE_BY_KEY: Record<EmailTemplateKey, string> = {
  "customer-onboarding-complete": "customer-onboarding-complete.html",
  "partner-invite": "partner-invite.html",
  "admin-invite": "admin-invite.html",
  "sales-po-received": "sales-po-received.html",
  "order-delivery-complete": "order-delivery-complete.html",
  "customer-po-submitted": "customer-po-submitted.html",
  "sales-po-accepted": "sales-po-accepted.html",
  "logistics-partner-ready": "logistics-partner-ready.html",
};

async function loadHtmlTemplate(templateKey: EmailTemplateKey) {
  const fileName = TEMPLATE_FILE_BY_KEY[templateKey];
  if (!fileName) {
    throw new Error(`No HTML template file registered for ${templateKey}.`);
  }

  const filePath = path.join(
    process.cwd(),
    "src",
    "emails",
    "templates",
    fileName,
  );

  return readFile(filePath, "utf8");
}

function applyTemplate(template: string, payload: Record<string, unknown>) {
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key) => {
    const value = payload[key];
    return value === undefined || value === null ? "" : String(value);
  });
}

async function sendWithResend(
  to: string,
  subject: string,
  html: string,
  text: string | null,
  attachments?: ResendAttachment[],
) {
  assertEmailServerEnv();

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.RESEND_FROM_EMAIL,
      to: [to],
      subject,
      html,
      text: text ?? undefined,
      attachments:
        attachments && attachments.length > 0 ? attachments : undefined,
    }),
  });

  const result = (await response.json().catch(() => ({}))) as {
    id?: string;
    message?: string;
    name?: string;
  };

  if (!response.ok) {
    throw new Error(result.message ?? result.name ?? "Resend delivery failed.");
  }

  return result.id ?? null;
}

function getString(
  payload: Record<string, unknown>,
  key: string,
  fallback = "",
) {
  const value = payload[key];
  return value === undefined || value === null ? fallback : String(value);
}

function getInteger(
  payload: Record<string, unknown>,
  key: string,
  fallback = 0,
) {
  const value = payload[key];
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.round(value);
  }

  if (typeof value === "string") {
    const parsed = Number.parseInt(value, 10);
    return Number.isNaN(parsed) ? fallback : parsed;
  }

  return fallback;
}

async function buildEmailAttachments(
  templateKey: EmailTemplateKey,
  payload: Record<string, unknown>,
) {
  if (templateKey !== "customer-onboarding-complete") {
    return [] as ResendAttachment[];
  }

  const invoiceNumber = getString(payload, "invoice_number", "invoice");
  const customerName = getString(payload, "customer_name", "Customer");
  const packageName = getString(payload, "package_name", "Subscription");
  const currencyCode = getString(payload, "currency_code", "ZAR");
  const totalCents = getInteger(payload, "total_cents", 0);
  const issuedDate = getString(
    payload,
    "issued_date",
    new Date().toLocaleDateString("en-ZA"),
  );
  const dueDate = getString(payload, "due_date", issuedDate);

  const pdfBase64 = await buildInvoicePdf({
    invoiceNumber,
    customerName,
    packageName,
    currencyCode,
    totalCents,
    issuedDate,
    dueDate,
  });

  return [
    {
      filename: `${invoiceNumber}.pdf`,
      content: pdfBase64,
    },
  ] as ResendAttachment[];
}

export async function queueEmail(input: QueueEmailInput) {
  const admin = createAdminClient();
  const template = EMAIL_TEMPLATES[input.templateKey];

  if (!template) {
    throw new Error(`Template not found: ${input.templateKey}`);
  }

  const payload = input.payload ?? {};
  const subject = applyTemplate(template.subject, payload);

  const { data, error } = await admin
    .from("outbound_emails")
    .insert({
      template_key: input.templateKey,
      organization_id: input.organizationId ?? null,
      invitation_id: input.invitationId ?? null,
      invoice_id: input.invoiceId ?? null,
      to_email: input.toEmail,
      subject: subject || input.subjectFallback,
      status: "queued",
      payload,
    })
    .select("id")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Could not queue outbound email.");
  }

  return data.id;
}

export async function dispatchQueuedEmails(limit = 20) {
  const admin = createAdminClient();
  const { data: queued, error: queueError } = await admin
    .from("outbound_emails")
    .select("id, template_key, to_email, subject, payload")
    .eq("status", "queued")
    .order("queued_at", { ascending: true })
    .limit(limit);

  if (queueError) {
    throw new Error(queueError.message);
  }

  const queuedRows = (queued ?? []) as OutboundEmailRow[];
  if (!queuedRows.length) {
    return { attempted: 0, sent: 0, failed: 0 };
  }

  let sent = 0;
  let failed = 0;

  for (const email of queuedRows) {
    try {
      const payload = email.payload ?? {};
      const template = EMAIL_TEMPLATES[email.template_key];

      if (!template) {
        throw new Error("Email template not found.");
      }

      const htmlTemplate = await loadHtmlTemplate(email.template_key);
      const htmlBody = applyTemplate(htmlTemplate, payload);
      const textBody = template.text
        ? applyTemplate(template.text, payload)
        : null;
      const attachments = await buildEmailAttachments(
        email.template_key,
        payload,
      );

      const messageId = await sendWithResend(
        email.to_email,
        email.subject,
        htmlBody,
        textBody,
        attachments,
      );

      await admin
        .from("outbound_emails")
        .update({
          status: "sent",
          provider: "resend",
          provider_message_id: messageId,
          sent_at: new Date().toISOString(),
          error_message: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", email.id);

      sent += 1;
    } catch (error) {
      await admin
        .from("outbound_emails")
        .update({
          status: "failed",
          error_message:
            error instanceof Error ? error.message : "Email dispatch failed.",
          updated_at: new Date().toISOString(),
        })
        .eq("id", email.id);

      failed += 1;
    }
  }

  return { attempted: queuedRows.length, sent, failed };
}
