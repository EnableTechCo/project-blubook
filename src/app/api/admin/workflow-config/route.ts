import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { SALES_WORKFLOW_STATES } from "@/constants/sales-workflow-states";
import { LOGISTICS_WORKFLOW_STATES } from "@/constants/logistics-workflow-states";

const DEFAULT_SALES_ROLE = "sales";
const DEFAULT_LOGISTICS_ROLE = "logistics";
const ASSIGNEE_ROLES = ["sales", "logistics", "staff", "partner"] as const;

const transitionMapSchema = z.record(z.string(), z.array(z.string()));

const workflowConfigPatchSchema = z.object({
  transitions: z.object({
    sales: transitionMapSchema,
    logistics: transitionMapSchema,
  }),
  defaultAssignments: z.object({
    sales: z.enum(ASSIGNEE_ROLES),
    logistics: z.enum(ASSIGNEE_ROLES),
  }),
  guardrails: z.object({
    strictTransitionValidation: z.boolean(),
    requireReasonOnManualOverride: z.boolean(),
  }),
});

type TransitionMap = Record<string, string[]>;

type WorkflowConfig = {
  transitions: {
    sales: TransitionMap;
    logistics: TransitionMap;
  };
  defaultAssignments: {
    sales: string;
    logistics: string;
  };
  guardrails: {
    strictTransitionValidation: boolean;
    requireReasonOnManualOverride: boolean;
  };
  updatedAt: string;
  updatedBy: string | null;
};

type AdminAuth = {
  admin: ReturnType<typeof createAdminClient>;
  userId: string;
  organizationId: string;
};

function buildDefaultTransitions(states: readonly string[]): TransitionMap {
  return Object.fromEntries(
    states.map((state, index) => [
      state,
      index < states.length - 1 ? [states[index + 1]] : [],
    ]),
  );
}

function getDefaultConfig(updatedBy: string | null): WorkflowConfig {
  return {
    transitions: {
      sales: buildDefaultTransitions(SALES_WORKFLOW_STATES),
      logistics: buildDefaultTransitions(LOGISTICS_WORKFLOW_STATES),
    },
    defaultAssignments: {
      sales: DEFAULT_SALES_ROLE,
      logistics: DEFAULT_LOGISTICS_ROLE,
    },
    guardrails: {
      strictTransitionValidation: true,
      requireReasonOnManualOverride: true,
    },
    updatedAt: new Date().toISOString(),
    updatedBy,
  };
}

function toRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function sanitizeTransitions(
  raw: TransitionMap,
  allowedStates: readonly string[],
): TransitionMap {
  const allowedSet = new Set(allowedStates);
  const sanitized: TransitionMap = {};

  for (const state of allowedStates) {
    const nextStates = Array.isArray(raw[state]) ? raw[state] : [];
    const validTargets = Array.from(
      new Set(
        nextStates.filter((next) => allowedSet.has(next) && next !== state),
      ),
    );
    sanitized[state] = validTargets;
  }

  return sanitized;
}

function mergeConfig(
  candidate: Partial<WorkflowConfig> | null,
  fallbackUpdatedBy: string | null,
): WorkflowConfig {
  const base = getDefaultConfig(fallbackUpdatedBy);
  if (!candidate) {
    return base;
  }

  const salesTransitions =
    candidate.transitions?.sales &&
    typeof candidate.transitions.sales === "object"
      ? sanitizeTransitions(candidate.transitions.sales, SALES_WORKFLOW_STATES)
      : base.transitions.sales;

  const logisticsTransitions =
    candidate.transitions?.logistics &&
    typeof candidate.transitions.logistics === "object"
      ? sanitizeTransitions(
          candidate.transitions.logistics,
          LOGISTICS_WORKFLOW_STATES,
        )
      : base.transitions.logistics;

  const defaultAssignments = {
    sales: ASSIGNEE_ROLES.includes(
      candidate.defaultAssignments?.sales as (typeof ASSIGNEE_ROLES)[number],
    )
      ? (candidate.defaultAssignments?.sales as string)
      : base.defaultAssignments.sales,
    logistics: ASSIGNEE_ROLES.includes(
      candidate.defaultAssignments
        ?.logistics as (typeof ASSIGNEE_ROLES)[number],
    )
      ? (candidate.defaultAssignments?.logistics as string)
      : base.defaultAssignments.logistics,
  };

  return {
    transitions: {
      sales: salesTransitions,
      logistics: logisticsTransitions,
    },
    defaultAssignments,
    guardrails: {
      strictTransitionValidation:
        candidate.guardrails?.strictTransitionValidation ??
        base.guardrails.strictTransitionValidation,
      requireReasonOnManualOverride:
        candidate.guardrails?.requireReasonOnManualOverride ??
        base.guardrails.requireReasonOnManualOverride,
    },
    updatedAt: candidate.updatedAt ?? base.updatedAt,
    updatedBy: candidate.updatedBy ?? base.updatedBy,
  };
}

function validateTransitionMap(
  transitions: TransitionMap,
  allowedStates: readonly string[],
  label: string,
) {
  const allowedSet = new Set(allowedStates);
  const inputStates = Object.keys(transitions);

  for (const state of allowedStates) {
    if (!inputStates.includes(state)) {
      return `${label}: missing state "${state}" in transitions.`;
    }

    const targets = transitions[state] ?? [];
    for (const target of targets) {
      if (!allowedSet.has(target)) {
        return `${label}: invalid transition target "${target}" from "${state}".`;
      }
      if (target === state) {
        return `${label}: self-transition is not allowed for "${state}".`;
      }
    }
  }

  return null;
}

async function requireAdmin(): Promise<AdminAuth | { error: NextResponse }> {
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
    .select("role, organization_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!profile || profile.role !== "admin") {
    return {
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  let organizationId =
    typeof profile.organization_id === "string"
      ? profile.organization_id
      : null;

  if (!organizationId) {
    const { data: membership } = await admin
      .from("organization_memberships")
      .select("organization_id")
      .eq("user_id", user.id)
      .maybeSingle();

    organizationId = membership?.organization_id ?? null;
  }

  if (!organizationId) {
    return {
      error: NextResponse.json(
        { error: "No admin organization context found." },
        { status: 400 },
      ),
    };
  }

  return {
    admin,
    userId: user.id,
    organizationId,
  };
}

export async function GET() {
  try {
    const auth = await requireAdmin();
    if ("error" in auth) {
      return auth.error;
    }

    const { data: org, error } = await auth.admin
      .from("organizations")
      .select("id, metadata")
      .eq("id", auth.organizationId)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    if (!org) {
      return NextResponse.json(
        { error: "Organization not found." },
        { status: 404 },
      );
    }

    const metadata = toRecord(org.metadata);
    const stored = toRecord(
      metadata?.workflow_config,
    ) as Partial<WorkflowConfig> | null;

    const config = mergeConfig(stored, auth.userId);

    return NextResponse.json({
      organizationId: org.id,
      states: {
        sales: SALES_WORKFLOW_STATES,
        logistics: LOGISTICS_WORKFLOW_STATES,
      },
      assigneeRoles: ASSIGNEE_ROLES,
      config,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not load workflow config.",
      },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const auth = await requireAdmin();
    if ("error" in auth) {
      return auth.error;
    }

    const parsed = workflowConfigPatchSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid request." },
        { status: 400 },
      );
    }

    const input = parsed.data;

    const salesError = validateTransitionMap(
      input.transitions.sales,
      SALES_WORKFLOW_STATES,
      "sales",
    );
    if (salesError) {
      return NextResponse.json({ error: salesError }, { status: 400 });
    }

    const logisticsError = validateTransitionMap(
      input.transitions.logistics,
      LOGISTICS_WORKFLOW_STATES,
      "logistics",
    );
    if (logisticsError) {
      return NextResponse.json({ error: logisticsError }, { status: 400 });
    }

    const { data: org, error: orgError } = await auth.admin
      .from("organizations")
      .select("id, metadata")
      .eq("id", auth.organizationId)
      .maybeSingle();

    if (orgError) {
      return NextResponse.json({ error: orgError.message }, { status: 400 });
    }
    if (!org) {
      return NextResponse.json(
        { error: "Organization not found." },
        { status: 404 },
      );
    }

    const config: WorkflowConfig = {
      transitions: {
        sales: sanitizeTransitions(
          input.transitions.sales,
          SALES_WORKFLOW_STATES,
        ),
        logistics: sanitizeTransitions(
          input.transitions.logistics,
          LOGISTICS_WORKFLOW_STATES,
        ),
      },
      defaultAssignments: input.defaultAssignments,
      guardrails: input.guardrails,
      updatedAt: new Date().toISOString(),
      updatedBy: auth.userId,
    };

    const currentMetadata = toRecord(org.metadata) ?? {};
    const nextMetadata = {
      ...currentMetadata,
      workflow_config: config,
    };

    const { error: updateError } = await auth.admin
      .from("organizations")
      .update({ metadata: nextMetadata, updated_at: new Date().toISOString() })
      .eq("id", auth.organizationId);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 400 });
    }

    return NextResponse.json({
      organizationId: auth.organizationId,
      config,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not update workflow config.",
      },
      { status: 500 },
    );
  }
}
