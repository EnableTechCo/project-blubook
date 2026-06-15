export function logPartnerDashboardDiagnostics(input: {
  tag: string;
  payload: unknown;
}) {
  if (process.env.NODE_ENV === "production") {
    return;
  }

  console.debug(input.tag, input.payload);
}
