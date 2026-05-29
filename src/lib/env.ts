const requiredPublic = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
] as const;

export function assertPublicEnv() {
  const missing = requiredPublic.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(
      `Missing required public environment variables: ${missing.join(", ")}`,
    );
  }
}
