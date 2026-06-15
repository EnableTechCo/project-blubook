import { createAdminClient } from "@/lib/supabase/admin";

const DEFAULT_SLA_TARGET_HOURS = 72;

type AdminClient = ReturnType<typeof createAdminClient>;

type TimelineEntryInput = {
  step: string;
  actor: string;
  message: string;
  at?: string;
  details?: Record<string, unknown>;
};

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? { ...(value as Record<string, unknown>) }
    : {};
}

export function readStringMetadata(metadata: unknown, key: string) {
  const value = asObject(metadata)[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}

export function readNumberMetadata(metadata: unknown, key: string) {
  const value = asObject(metadata)[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function withOrderLifecycleDefaults(
  metadata: unknown,
  input?: { startedAt?: string; targetHours?: number },
) {
  const base = asObject(metadata);
  const startedAt =
    readStringMetadata(base, "workflow_started_at") ??
    input?.startedAt ??
    new Date().toISOString();
  const slaTargetHours =
    readNumberMetadata(base, "sla_target_hours") ??
    input?.targetHours ??
    DEFAULT_SLA_TARGET_HOURS;
  const dueAt =
    readStringMetadata(base, "sla_due_at") ??
    new Date(
      new Date(startedAt).getTime() + slaTargetHours * 60 * 60 * 1000,
    ).toISOString();

  return {
    ...base,
    workflow_started_at: startedAt,
    sla_target_hours: slaTargetHours,
    sla_due_at: dueAt,
  };
}

export function appendOrderTimeline(
  metadata: unknown,
  input: TimelineEntryInput,
) {
  const base = asObject(metadata);
  const existingTimeline = Array.isArray(base.workflow_timeline)
    ? base.workflow_timeline.filter(
        (entry): entry is Record<string, unknown> =>
          Boolean(entry) && typeof entry === "object" && !Array.isArray(entry),
      )
    : [];

  const entry = {
    id: crypto.randomUUID(),
    step: input.step,
    actor: input.actor,
    message: input.message,
    at: input.at ?? new Date().toISOString(),
    details: input.details ?? {},
  };

  return {
    ...base,
    workflow_timeline: [...existingTimeline, entry].slice(-25),
  };
}

export function computeDeliveredOrderMetadata(
  metadata: unknown,
  input: { deliveredAt: string; deliveredTo: string },
) {
  const base = withOrderLifecycleDefaults(metadata, {
    startedAt: input.deliveredAt,
  });
  const targetHours =
    readNumberMetadata(base, "sla_target_hours") ?? DEFAULT_SLA_TARGET_HOURS;
  const dueAt =
    readStringMetadata(base, "sla_due_at") ??
    new Date(
      new Date(input.deliveredAt).getTime() + targetHours * 60 * 60 * 1000,
    ).toISOString();
  const slaStatus =
    new Date(input.deliveredAt).getTime() <= new Date(dueAt).getTime()
      ? "met"
      : "missed";

  return {
    ...base,
    delivered_at: input.deliveredAt,
    delivered_to: input.deliveredTo,
    sla_due_at: dueAt,
    sla_status: slaStatus,
  };
}

export async function resolveCustomerUserIds(
  admin: AdminClient,
  organizationId: string,
) {
  const { data } = await admin
    .from("user_profiles")
    .select("user_id")
    .eq("organization_id", organizationId)
    .eq("role", "customer");

  return Array.from(
    new Set((data ?? []).map((row) => row.user_id).filter(Boolean)),
  );
}

export async function resolveStaffAdminUserIds(
  admin: AdminClient,
  organizationId: string,
) {
  const { data } = await admin
    .from("user_profiles")
    .select("user_id")
    .eq("organization_id", organizationId)
    .in("role", ["staff", "admin"]);

  return Array.from(
    new Set((data ?? []).map((row) => row.user_id).filter(Boolean)),
  );
}

export async function resolvePartnerUserIds(
  admin: AdminClient,
  providerIds: string[],
) {
  if (providerIds.length === 0) {
    return [] as string[];
  }

  const { data: allPartnerOrganizations } = await admin
    .from("organizations")
    .select("id, metadata")
    .not("metadata->>service_partner_id", "is", null);

  const organizationIds = (allPartnerOrganizations ?? [])
    .filter((row) => {
      const metadata = asObject(row.metadata);
      const servicePartnerId = metadata.service_partner_id;
      return (
        typeof servicePartnerId === "string" &&
        providerIds.includes(servicePartnerId)
      );
    })
    .map((row) => row.id)
    .filter((value): value is string => Boolean(value));

  if (organizationIds.length === 0) {
    return [] as string[];
  }

  const { data } = await admin
    .from("organization_memberships")
    .select("user_id")
    .in("organization_id", organizationIds)
    .eq("status", "active")
    .eq("role", "partner");

  return Array.from(
    new Set((data ?? []).map((row) => row.user_id).filter(Boolean)),
  );
}

export async function insertNotifications(
  admin: AdminClient,
  notifications: Array<{
    userId: string;
    organizationId: string;
    message: string;
    metadata?: Record<string, unknown>;
  }>,
) {
  if (notifications.length === 0) {
    return;
  }

  await admin.from("notifications").insert(
    notifications.map((item) => ({
      user_id: item.userId,
      organization_id: item.organizationId,
      message: item.message,
      metadata: item.metadata ?? {},
    })),
  );
}
