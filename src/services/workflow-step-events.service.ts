import { createAdminClient } from "@/lib/supabase/admin";
import {
  WORKFLOW_STEP_CONTRACT,
  buildAudienceStepView,
  type WorkflowAudienceRole,
  type WorkflowStepOwner,
} from "@/lib/workflow/workflow-step-contract";

export type { WorkflowAudienceRole };
export { buildAudienceStepView };

export type WorkflowStepEventRow = {
  id: string;
  order_id: string;
  step_key: string;
  step_owner: WorkflowStepOwner;
  actor_type: "staff" | "sales" | "logistics" | "customer" | "system";
  actor_id: string | null;
  source: string;
  proof_url: string | null;
  proof_type: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

export type RecordStepEventInput = {
  orderId: string;
  stepKey: string;
  actorType: WorkflowStepEventRow["actor_type"];
  actorId?: string | null;
  source: string;
  proofUrl?: string | null;
  proofType?: string | null;
  metadata?: Record<string, unknown>;
};

/**
 * Fetch all recorded step events for an order, ordered by insertion time.
 * Returns an array of completed step keys in order of completion.
 */
export async function getStepEventsForOrder(
  orderId: string,
): Promise<WorkflowStepEventRow[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("order_workflow_step_events")
    .select("*")
    .eq("order_id", orderId)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(
      `Failed to fetch step events for order ${orderId}: ${error.message}`,
    );
  }

  return (data ?? []) as WorkflowStepEventRow[];
}

/**
 * Returns only the step keys that have been explicitly completed for an order.
 */
export async function getCompletedStepKeysForOrder(
  orderId: string,
): Promise<string[]> {
  const rows = await getStepEventsForOrder(orderId);
  return rows.map((row) => row.step_key);
}

/**
 * Record a completed workflow step event.
 * Throws if the step_key is not in the canonical contract.
 * Throws if the step has already been recorded (unique constraint violation surfaced as clear error).
 */
export async function recordStepEvent(
  input: RecordStepEventInput,
): Promise<WorkflowStepEventRow> {
  const contractStep = WORKFLOW_STEP_CONTRACT.find(
    (s) => s.key === input.stepKey,
  );

  if (!contractStep) {
    throw new Error(
      `Unknown step key "${input.stepKey}". Must be a key in WORKFLOW_STEP_CONTRACT.`,
    );
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("order_workflow_step_events")
    .insert({
      order_id: input.orderId,
      step_key: input.stepKey,
      step_owner: contractStep.owner,
      actor_type: input.actorType,
      actor_id: input.actorId ?? null,
      source: input.source,
      proof_url: input.proofUrl ?? null,
      proof_type: input.proofType ?? null,
      metadata: input.metadata ?? {},
    })
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      throw new Error(
        `Step "${input.stepKey}" has already been recorded for order ${input.orderId}.`,
      );
    }
    throw new Error(`Failed to record step event: ${error.message}`);
  }

  return data as WorkflowStepEventRow;
}

/**
 * Derive the current active step key (first incomplete step visible to the audience).
 */
export function getActiveStepKey(input: {
  audience: WorkflowAudienceRole;
  completedStepKeys: string[];
}): string | null {
  const steps = buildAudienceStepView(input);
  return steps.find((s) => !s.completed)?.key ?? null;
}

// ─── Step Inputs ─────────────────────────────────────────────────────────────

export type WorkflowStepInputRow = {
  id: string;
  order_id: string;
  step_key: string;
  input_data: Record<string, unknown>;
  actor_notes: string | null;
  created_at: string;
  updated_at: string;
};

export type UpsertStepInputInput = {
  orderId: string;
  stepKey: string;
  inputData: Record<string, unknown>;
  actorNotes?: string | null;
};

/**
 * Upsert structured input data for a workflow step.
 * Validates that stepKey exists in the contract.
 * Validates that all required inputFields keys are present.
 */
export async function upsertStepInput(
  input: UpsertStepInputInput,
): Promise<WorkflowStepInputRow> {
  const contractStep = WORKFLOW_STEP_CONTRACT.find(
    (s) => s.key === input.stepKey,
  );

  if (!contractStep) {
    throw new Error(
      `Unknown step key "${input.stepKey}". Must be a key in WORKFLOW_STEP_CONTRACT.`,
    );
  }

  const requiredFields = contractStep.inputFields.filter((f) => f.required);
  const missingRequired = requiredFields.filter(
    (f) =>
      input.inputData[f.key] === undefined ||
      input.inputData[f.key] === null ||
      input.inputData[f.key] === "",
  );

  if (missingRequired.length > 0) {
    throw new Error(
      `Missing required input fields for step "${input.stepKey}": ${missingRequired.map((f) => f.key).join(", ")}.`,
    );
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("order_workflow_step_inputs")
    .upsert(
      {
        order_id: input.orderId,
        step_key: input.stepKey,
        input_data: input.inputData,
        actor_notes: input.actorNotes ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "order_id,step_key" },
    )
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to upsert step input: ${error.message}`);
  }

  return data as WorkflowStepInputRow;
}

/**
 * Get the stored input data for a specific step on an order.
 * Returns null if no input has been recorded yet.
 */
export async function getStepInput(
  orderId: string,
  stepKey: string,
): Promise<WorkflowStepInputRow | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("order_workflow_step_inputs")
    .select("*")
    .eq("order_id", orderId)
    .eq("step_key", stepKey)
    .maybeSingle();

  if (error) {
    throw new Error(
      `Failed to fetch step input for order ${orderId} step ${stepKey}: ${error.message}`,
    );
  }

  return (data as WorkflowStepInputRow | null) ?? null;
}

/**
 * Get all step inputs for an order, keyed by step_key.
 */
export async function getAllStepInputsForOrder(
  orderId: string,
): Promise<Record<string, WorkflowStepInputRow>> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("order_workflow_step_inputs")
    .select("*")
    .eq("order_id", orderId)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(
      `Failed to fetch step inputs for order ${orderId}: ${error.message}`,
    );
  }

  const result: Record<string, WorkflowStepInputRow> = {};
  for (const row of (data ?? []) as WorkflowStepInputRow[]) {
    result[row.step_key] = row;
  }
  return result;
}
