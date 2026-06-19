import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

type AdminAuth = {
  admin: ReturnType<typeof createAdminClient>;
};

type AuditLogEntry = {
  id: string;
  module: "routing" | "onboarding";
  action: string;
  at: string;
  actorUserId: string | null;
  actorName: string | null;
  actorEmail: string | null;
  organizationId: string | null;
  entityType: string;
  entityId: string;
  severity: "low" | "medium" | "high";
  status: string;
  summary: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  metadata: Record<string, unknown>;
};

type AutomationDecisionRow = {
  id: string;
  organization_id: string;
  profile_id: string | null;
  source: string;
  recommended_priority: string | null;
  recommended_stream: string | null;
  recommendation_json: Record<string, unknown> | null;
  explanation: string | null;
  status: string;
  created_at: string;
};

type AutomationOverrideRow = {
  id: string;
  decision_id: string;
  overridden_by: string | null;
  previous_priority: string | null;
  new_priority: string | null;
  reason: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

type OnboardingAnomalyRow = {
  id: string;
  organization_id: string;
  onboarding_submission_id: string;
  profile_id: string;
  anomaly_type: string;
  reason: string;
  severity: "low" | "medium" | "high";
  status: "pending_review" | "reviewed" | "dismissed";
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
};

type UserProfileLookupRow = {
  user_id: string;
  full_name: string | null;
  email: string;
};

async function requireAdminOrStaff(): Promise<
  AdminAuth | { error: NextResponse }
> {
  const server = await createServerClient();
  const {
    data: { user },
  } = await server.auth.getUser();

  if (!user) {
    return {
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("user_profiles")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!profile || !["admin", "staff"].includes(profile.role)) {
    return {
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  return { admin };
}

function normalizePagination(
  inputPage: string | null,
  inputLimit: string | null,
) {
  const pageNumber = Number(inputPage ?? "1");
  const limitNumber = Number(inputLimit ?? "20");

  const page = Number.isFinite(pageNumber) && pageNumber > 0 ? pageNumber : 1;
  const limit =
    Number.isFinite(limitNumber) && limitNumber > 0
      ? Math.min(Math.floor(limitNumber), 100)
      : 20;

  return { page, limit };
}

function maskEmail(email: string | null) {
  if (!email || !email.includes("@")) {
    return email;
  }

  const [name, domain] = email.split("@");
  if (!name || !domain) {
    return email;
  }

  const visible = name.slice(0, 2);
  return `${visible}${"*".repeat(Math.max(name.length - 2, 1))}@${domain}`;
}

function maskSensitive(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(maskSensitive);
  }

  if (!value || typeof value !== "object") {
    if (typeof value === "string" && value.includes("@")) {
      return maskEmail(value);
    }
    return value;
  }

  const result: Record<string, unknown> = {};
  for (const [key, nextValue] of Object.entries(value)) {
    const lower = key.toLowerCase();
    const shouldMask =
      lower.includes("token") ||
      lower.includes("secret") ||
      lower.includes("password") ||
      lower.includes("api_key") ||
      lower.includes("key") ||
      lower.includes("email") ||
      lower.includes("phone");

    if (shouldMask) {
      result[key] = "[masked]";
      continue;
    }

    result[key] = maskSensitive(nextValue);
  }

  return result;
}

function getPrioritySeverity(value: string | null): "low" | "medium" | "high" {
  const normalized = (value ?? "").toLowerCase();
  if (normalized === "critical" || normalized === "strategic") {
    return "high";
  }
  if (normalized === "high") {
    return "medium";
  }
  return "low";
}

function toRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return value as Record<string, unknown>;
}

export async function GET(request: Request) {
  try {
    const auth = await requireAdminOrStaff();
    if ("error" in auth) {
      return auth.error;
    }

    const { searchParams } = new URL(request.url);
    const moduleFilter = (searchParams.get("module") ?? "all").toLowerCase();
    const actionFilter = (searchParams.get("action") ?? "all").toLowerCase();
    const actorFilter = searchParams.get("actor") ?? "all";
    const statusFilter = (searchParams.get("status") ?? "all").toLowerCase();
    const fromDate = searchParams.get("from");
    const toDate = searchParams.get("to");
    const query = (searchParams.get("q") ?? "").trim().toLowerCase();
    const { page, limit } = normalizePagination(
      searchParams.get("page"),
      searchParams.get("limit"),
    );

    const [decisionResult, overrideResult, anomalyResult] = await Promise.all([
      auth.admin
        .from("automation_decisions")
        .select(
          "id, organization_id, profile_id, source, recommended_priority, recommended_stream, recommendation_json, explanation, status, created_at",
        )
        .order("created_at", { ascending: false })
        .limit(300),
      auth.admin
        .from("automation_overrides")
        .select(
          "id, decision_id, overridden_by, previous_priority, new_priority, reason, metadata, created_at",
        )
        .order("created_at", { ascending: false })
        .limit(300),
      auth.admin
        .from("onboarding_anomaly_alerts")
        .select(
          "id, organization_id, onboarding_submission_id, profile_id, anomaly_type, reason, severity, status, reviewed_by, reviewed_at, created_at",
        )
        .order("created_at", { ascending: false })
        .limit(300),
    ]);

    if (decisionResult.error) {
      return NextResponse.json(
        { error: decisionResult.error.message },
        { status: 500 },
      );
    }
    if (overrideResult.error) {
      return NextResponse.json(
        { error: overrideResult.error.message },
        { status: 500 },
      );
    }
    if (anomalyResult.error) {
      return NextResponse.json(
        { error: anomalyResult.error.message },
        { status: 500 },
      );
    }

    const decisionRows =
      ((decisionResult.data ?? []) as unknown as AutomationDecisionRow[]) ?? [];
    const overrideRows =
      ((overrideResult.data ?? []) as unknown as AutomationOverrideRow[]) ?? [];
    const anomalyRows =
      ((anomalyResult.data ?? []) as unknown as OnboardingAnomalyRow[]) ?? [];

    const decisionsById = new Map(decisionRows.map((row) => [row.id, row]));

    const actorIds = Array.from(
      new Set([
        ...decisionRows.map((row) => row.profile_id).filter(Boolean),
        ...overrideRows.map((row) => row.overridden_by).filter(Boolean),
        ...anomalyRows.map((row) => row.profile_id).filter(Boolean),
        ...anomalyRows.map((row) => row.reviewed_by).filter(Boolean),
      ] as string[]),
    );

    let actorByUserId = new Map<string, UserProfileLookupRow>();
    if (actorIds.length > 0) {
      const { data: profileRows, error: profileError } = await auth.admin
        .from("user_profiles")
        .select("user_id, full_name, email")
        .in("user_id", actorIds);

      if (profileError) {
        return NextResponse.json(
          { error: profileError.message },
          { status: 500 },
        );
      }

      actorByUserId = new Map(
        ((profileRows ?? []) as unknown as UserProfileLookupRow[]).map(
          (row) => [row.user_id, row],
        ),
      );
    }

    const decisionLogs: AuditLogEntry[] = decisionRows.map((row) => {
      const actor = row.profile_id ? actorByUserId.get(row.profile_id) : null;
      const recJson = toRecord(row.recommendation_json);
      const stream =
        typeof row.recommended_stream === "string"
          ? row.recommended_stream
          : null;

      return {
        id: `decision:${row.id}`,
        module: "routing",
        action: "routing.recommendation.created",
        at: row.created_at,
        actorUserId: row.profile_id,
        actorName: actor?.full_name ?? null,
        actorEmail: maskEmail(actor?.email ?? null),
        organizationId: row.organization_id,
        entityType: "automation_decision",
        entityId: row.id,
        severity: getPrioritySeverity(row.recommended_priority),
        status: row.status,
        summary:
          row.explanation ??
          `Recommendation created for ${stream ?? "unknown stream"}.`,
        before: null,
        after: {
          source: row.source,
          priority: row.recommended_priority,
          stream,
          recommendation: maskSensitive(recJson),
        },
        metadata: {
          source: row.source,
          stream,
        },
      };
    });

    const overrideLogs: AuditLogEntry[] = overrideRows.map((row) => {
      const actor = row.overridden_by
        ? actorByUserId.get(row.overridden_by)
        : null;
      const decision = decisionsById.get(row.decision_id);
      const meta = toRecord(row.metadata);

      return {
        id: `override:${row.id}`,
        module: "routing",
        action: "routing.recommendation.overridden",
        at: row.created_at,
        actorUserId: row.overridden_by,
        actorName: actor?.full_name ?? null,
        actorEmail: maskEmail(actor?.email ?? null),
        organizationId: decision?.organization_id ?? null,
        entityType: "automation_decision",
        entityId: row.decision_id,
        severity: getPrioritySeverity(row.new_priority),
        status: "overridden",
        summary: row.reason,
        before: {
          priority: row.previous_priority,
          partnerId: meta.previous_partner_id ?? null,
          partnerName: meta.previous_partner_name ?? null,
        },
        after: {
          priority: row.new_priority,
          partnerId: meta.new_partner_id ?? null,
          partnerName: meta.new_partner_name ?? null,
        },
        metadata: maskSensitive(meta) as Record<string, unknown>,
      };
    });

    const anomalyLogs: AuditLogEntry[] = anomalyRows.flatMap((row) => {
      const createdActor = actorByUserId.get(row.profile_id);
      const createdEntry: AuditLogEntry = {
        id: `anomaly:${row.id}:created`,
        module: "onboarding",
        action: "onboarding.anomaly.flagged",
        at: row.created_at,
        actorUserId: row.profile_id,
        actorName: createdActor?.full_name ?? null,
        actorEmail: maskEmail(createdActor?.email ?? null),
        organizationId: row.organization_id,
        entityType: "onboarding_submission",
        entityId: row.onboarding_submission_id,
        severity: row.severity,
        status: "pending_review",
        summary: row.reason,
        before: null,
        after: {
          anomalyType: row.anomaly_type,
          severity: row.severity,
          status: row.status,
        },
        metadata: {
          anomalyType: row.anomaly_type,
        },
      };

      if (
        (row.status === "reviewed" || row.status === "dismissed") &&
        row.reviewed_at
      ) {
        const reviewedActor = row.reviewed_by
          ? actorByUserId.get(row.reviewed_by)
          : null;

        const reviewedEntry: AuditLogEntry = {
          id: `anomaly:${row.id}:reviewed`,
          module: "onboarding",
          action:
            row.status === "dismissed"
              ? "onboarding.anomaly.dismissed"
              : "onboarding.anomaly.reviewed",
          at: row.reviewed_at,
          actorUserId: row.reviewed_by,
          actorName: reviewedActor?.full_name ?? null,
          actorEmail: maskEmail(reviewedActor?.email ?? null),
          organizationId: row.organization_id,
          entityType: "onboarding_submission",
          entityId: row.onboarding_submission_id,
          severity: row.severity,
          status: row.status,
          summary:
            row.status === "dismissed"
              ? "Anomaly dismissed after review."
              : "Anomaly reviewed and acknowledged.",
          before: {
            status: "pending_review",
          },
          after: {
            status: row.status,
          },
          metadata: {
            anomalyType: row.anomaly_type,
          },
        };

        return [createdEntry, reviewedEntry];
      }

      return [createdEntry];
    });

    const allLogs = [...decisionLogs, ...overrideLogs, ...anomalyLogs].sort(
      (a, b) => new Date(b.at).getTime() - new Date(a.at).getTime(),
    );

    const filtered = allLogs.filter((log) => {
      if (moduleFilter !== "all" && log.module !== moduleFilter) {
        return false;
      }
      if (actionFilter !== "all" && log.action !== actionFilter) {
        return false;
      }
      if (actorFilter !== "all" && log.actorUserId !== actorFilter) {
        return false;
      }
      if (statusFilter !== "all" && log.status.toLowerCase() !== statusFilter) {
        return false;
      }

      if (fromDate) {
        const fromAt = new Date(fromDate).getTime();
        if (Number.isFinite(fromAt) && new Date(log.at).getTime() < fromAt) {
          return false;
        }
      }

      if (toDate) {
        const toAt = new Date(toDate).getTime();
        if (Number.isFinite(toAt) && new Date(log.at).getTime() > toAt) {
          return false;
        }
      }

      if (query) {
        const haystack = [
          log.summary,
          log.action,
          log.module,
          log.entityType,
          log.entityId,
          log.actorName ?? "",
          log.actorEmail ?? "",
        ]
          .join(" ")
          .toLowerCase();

        if (!haystack.includes(query)) {
          return false;
        }
      }

      return true;
    });

    const total = filtered.length;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const normalizedPage = Math.min(page, totalPages);
    const start = (normalizedPage - 1) * limit;
    const logs = filtered.slice(start, start + limit);

    const byModule = filtered.reduce<Record<string, number>>((acc, log) => {
      acc[log.module] = (acc[log.module] ?? 0) + 1;
      return acc;
    }, {});

    const bySeverity = filtered.reduce<Record<string, number>>((acc, log) => {
      acc[log.severity] = (acc[log.severity] ?? 0) + 1;
      return acc;
    }, {});

    const actorOptions = Array.from(
      new Set(
        filtered
          .filter((log) => Boolean(log.actorUserId))
          .map((log) =>
            JSON.stringify({
              userId: log.actorUserId,
              name: log.actorName ?? log.actorEmail ?? log.actorUserId,
            }),
          ),
      ),
    )
      .map((encoded) => JSON.parse(encoded) as { userId: string; name: string })
      .sort((a, b) => a.name.localeCompare(b.name));

    const actionOptions = Array.from(
      new Set(allLogs.map((log) => log.action)),
    ).sort();

    return NextResponse.json({
      filters: {
        module: moduleFilter,
        action: actionFilter,
        actor: actorFilter,
        status: statusFilter,
        from: fromDate,
        to: toDate,
        q: query,
      },
      options: {
        modules: ["routing", "onboarding"],
        actions: actionOptions,
        actors: actorOptions,
        statuses: [
          "pending",
          "accepted",
          "dismissed",
          "overridden",
          "pending_review",
          "reviewed",
        ],
      },
      metrics: {
        total,
        byModule,
        bySeverity,
      },
      pagination: {
        page: normalizedPage,
        limit,
        total,
        totalPages,
      },
      logs,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Could not load audit logs.",
      },
      { status: 500 },
    );
  }
}
