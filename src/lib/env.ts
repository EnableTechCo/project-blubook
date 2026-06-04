const requiredPublic = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
] as const;

const requiredCustomerOnboardingServer = ["SUPABASE_SERVICE_ROLE_KEY"] as const;
const requiredEmailServer = ["RESEND_API_KEY", "RESEND_FROM_EMAIL"] as const;

export function assertPublicEnv() {
  const missing = requiredPublic.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(
      `Missing required public environment variables: ${missing.join(", ")}`,
    );
  }
}

export function assertCustomerOnboardingServerEnv() {
  const missing = requiredCustomerOnboardingServer.filter(
    (key) => !process.env[key],
  );
  if (missing.length > 0) {
    throw new Error(
      `Missing required server environment variables: ${missing.join(", ")}`,
    );
  }
}

export function assertEmailServerEnv() {
  const missing = requiredEmailServer.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(
      `Missing required email environment variables: ${missing.join(", ")}`,
    );
  }
}
