import type { SupabaseClient } from "@supabase/supabase-js";

export async function validateInvoiceTotals(
  invoiceId: string,
  admin: SupabaseClient,
): Promise<{ valid: true } | { valid: false; error: string }> {
  const { data: invoice, error: invoiceError } = await admin
    .from("invoices")
    .select("id, subtotal_cents, tax_cents, total_cents")
    .eq("id", invoiceId)
    .single();

  if (invoiceError || !invoice) {
    return { valid: false, error: "Invoice not found." };
  }

  const { data: lineItems, error: lineError } = await admin
    .from("invoice_line_items")
    .select("line_total_cents")
    .eq("invoice_id", invoiceId);

  if (lineError) {
    return { valid: false, error: `Could not fetch line items: ${lineError.message}` };
  }

  const computedSubtotal = (lineItems ?? []).reduce(
    (sum, row) => sum + (row.line_total_cents as number),
    0,
  );

  if (computedSubtotal !== invoice.subtotal_cents) {
    return {
      valid: false,
      error: `Invoice subtotal (${invoice.subtotal_cents}) does not match line item sum (${computedSubtotal}). Partial update prevented.`,
    };
  }

  const computedTotal = invoice.subtotal_cents + invoice.tax_cents;
  if (computedTotal !== invoice.total_cents) {
    return {
      valid: false,
      error: `Invoice total (${invoice.total_cents}) does not match subtotal + tax (${computedTotal}). Partial update prevented.`,
    };
  }

  return { valid: true };
}
