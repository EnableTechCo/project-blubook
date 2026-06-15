export function isPendingRequirement(status: string) {
  return status === "missing" || status === "rejected";
}

export function isPurchaseOrderRequirement(input: {
  title: string;
  evidenceType: string;
}) {
  const title = input.title.toLowerCase();
  const evidenceType = input.evidenceType.toLowerCase();
  return (
    title.includes("purchase order") ||
    title.includes("purchase-order") ||
    evidenceType.includes("purchase_order") ||
    (evidenceType.includes("purchase") && evidenceType.includes("order"))
  );
}
