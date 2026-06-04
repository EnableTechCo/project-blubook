import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

type BuildInvoicePdfInput = {
  invoiceNumber: string;
  customerName: string;
  packageName: string;
  currencyCode: string;
  totalCents: number;
  issuedDate: string;
  dueDate: string;
};

function formatMoney(currencyCode: string, cents: number) {
  const amount = new Intl.NumberFormat("en-ZA", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.max(0, cents) / 100);

  if (currencyCode.toUpperCase() === "ZAR") {
    return `R${amount}`;
  }

  return `${currencyCode.toUpperCase()} ${amount}`;
}

export async function buildInvoicePdf(input: BuildInvoicePdfInput) {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595.28, 841.89]);
  const width = page.getWidth();
  const height = page.getHeight();

  const fontRegular = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);

  page.drawRectangle({
    x: 0,
    y: height - 130,
    width,
    height: 130,
    color: rgb(0.05, 0.09, 0.17),
  });

  page.drawText("BluBook", {
    x: 48,
    y: height - 58,
    size: 28,
    font: fontBold,
    color: rgb(0.34, 0.88, 0.95),
  });

  page.drawText("Invoice", {
    x: width - 150,
    y: height - 56,
    size: 26,
    font: fontBold,
    color: rgb(1, 1, 1),
  });

  page.drawText(`Invoice #: ${input.invoiceNumber}`, {
    x: 48,
    y: height - 175,
    size: 13,
    font: fontBold,
    color: rgb(0.11, 0.13, 0.18),
  });

  page.drawText(`Issued: ${input.issuedDate}`, {
    x: 48,
    y: height - 198,
    size: 11,
    font: fontRegular,
    color: rgb(0.2, 0.23, 0.29),
  });

  page.drawText(`Due: ${input.dueDate}`, {
    x: 48,
    y: height - 217,
    size: 11,
    font: fontRegular,
    color: rgb(0.2, 0.23, 0.29),
  });

  page.drawText(`Bill To: ${input.customerName}`, {
    x: 48,
    y: height - 256,
    size: 12,
    font: fontBold,
    color: rgb(0.11, 0.13, 0.18),
  });

  page.drawRectangle({
    x: 48,
    y: height - 430,
    width: width - 96,
    height: 150,
    borderWidth: 1,
    borderColor: rgb(0.88, 0.9, 0.95),
    color: rgb(0.98, 0.99, 1),
  });

  page.drawText("Description", {
    x: 62,
    y: height - 305,
    size: 11,
    font: fontBold,
    color: rgb(0.23, 0.25, 0.31),
  });

  page.drawText("Amount", {
    x: width - 160,
    y: height - 305,
    size: 11,
    font: fontBold,
    color: rgb(0.23, 0.25, 0.31),
  });

  page.drawLine({
    start: { x: 60, y: height - 316 },
    end: { x: width - 60, y: height - 316 },
    thickness: 1,
    color: rgb(0.87, 0.89, 0.94),
  });

  page.drawText(`${input.packageName} subscription`, {
    x: 62,
    y: height - 346,
    size: 12,
    font: fontRegular,
    color: rgb(0.11, 0.13, 0.18),
  });

  page.drawText(formatMoney(input.currencyCode, input.totalCents), {
    x: width - 160,
    y: height - 346,
    size: 12,
    font: fontBold,
    color: rgb(0.11, 0.13, 0.18),
  });

  page.drawLine({
    start: { x: 60, y: height - 382 },
    end: { x: width - 60, y: height - 382 },
    thickness: 1,
    color: rgb(0.87, 0.89, 0.94),
  });

  page.drawText("Total Due", {
    x: width - 240,
    y: height - 405,
    size: 12,
    font: fontBold,
    color: rgb(0.11, 0.13, 0.18),
  });

  page.drawText(formatMoney(input.currencyCode, input.totalCents), {
    x: width - 160,
    y: height - 405,
    size: 14,
    font: fontBold,
    color: rgb(0.04, 0.65, 0.78),
  });

  page.drawText("Thank you for choosing BluBook.", {
    x: 48,
    y: 90,
    size: 11,
    font: fontRegular,
    color: rgb(0.25, 0.28, 0.34),
  });

  page.drawText("This invoice was generated electronically.", {
    x: 48,
    y: 72,
    size: 10,
    font: fontRegular,
    color: rgb(0.45, 0.49, 0.56),
  });

  const bytes = await pdf.save();
  return Buffer.from(bytes).toString("base64");
}
