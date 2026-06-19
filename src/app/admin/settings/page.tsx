"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SelectMenu } from "@/components/ui/select-menu";

type WorkflowConfigPayload = {
  organizationId: string;
  states: {
    sales: string[];
    logistics: string[];
  };
  assigneeRoles: string[];
  config: {
    transitions: {
      sales: Record<string, string[]>;
      logistics: Record<string, string[]>;
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
};

type EditableConfig = WorkflowConfigPayload["config"];

function transitionRows(
  states: string[],
  transitions: Record<string, string[]>,
  onChange: (state: string, value: string) => void,
) {
  return (
    <div className="space-y-2">
      {states.map((state) => (
        <div key={state} className="grid gap-2 md:grid-cols-[220px,1fr]">
          <p className="text-xs text-slate-300">{state}</p>
          <input
            className="h-9 w-full rounded-lg border border-white/20 bg-white/5 px-3 text-sm text-white"
            value={(transitions[state] ?? []).join(", ")}
            onChange={(event) => onChange(state, event.target.value)}
            placeholder="Enter allowed next stages, separated by commas"
          />
        </div>
      ))}
    </div>
  );
}

function parseTargets(value: string, allowedStates: string[]) {
  const allowed = new Set(allowedStates);
  return Array.from(
    new Set(
      value
        .split(",")
        .map((item) => item.trim())
        .filter((item) => item.length > 0 && allowed.has(item)),
    ),
  );
}

export default function AdminSettingsPage() {
  const [editableConfig, setEditableConfig] = useState<EditableConfig | null>(
    null,
  );
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">(
    "idle",
  );
  const [actionError, setActionError] = useState<string | null>(null);

  const configQuery = useQuery({
    queryKey: ["admin-workflow-config"],
    queryFn: async (): Promise<WorkflowConfigPayload> => {
      const response = await fetch("/api/admin/workflow-config", {
        credentials: "include",
      });
      const body = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(body?.error ?? "Could not load workflow settings.");
      }

      return body as WorkflowConfigPayload;
    },
  });

  useEffect(() => {
    if (configQuery.data?.config) {
      setEditableConfig(configQuery.data.config);
    }
  }, [configQuery.data]);

  const payload = configQuery.data;
  const config = editableConfig ?? payload?.config ?? null;

  const dirty = useMemo(() => {
    if (!config || !payload?.config) {
      return false;
    }
    return JSON.stringify(config) !== JSON.stringify(payload.config);
  }, [config, payload?.config]);

  const updateTransition = (
    lane: "sales" | "logistics",
    state: string,
    rawValue: string,
  ) => {
    if (!config || !payload) {
      return;
    }

    const nextStates = parseTargets(rawValue, payload.states[lane]);
    setEditableConfig((current) => {
      if (!current) return current;
      return {
        ...current,
        transitions: {
          ...current.transitions,
          [lane]: {
            ...current.transitions[lane],
            [state]: nextStates,
          },
        },
      };
    });
  };

  const saveConfig = async () => {
    if (!config || !dirty) {
      return;
    }

    setSaveState("saving");
    setActionError(null);

    try {
      const response = await fetch("/api/admin/workflow-config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          transitions: config.transitions,
          defaultAssignments: config.defaultAssignments,
          guardrails: config.guardrails,
        }),
      });

      const body = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(body?.error ?? "Could not save workflow settings.");
      }

      setEditableConfig((body?.config ?? config) as EditableConfig);
      await configQuery.refetch();
      setSaveState("saved");
      setTimeout(() => setSaveState("idle"), 1500);
    } catch (error) {
      setActionError(
        error instanceof Error
          ? error.message
          : "Could not save workflow settings.",
      );
      setSaveState("idle");
    }
  };

  if (configQuery.isLoading) {
    return (
      <p className="text-sm text-slate-300">Loading workflow settings...</p>
    );
  }

  if (configQuery.isError || !payload || !config) {
    return (
      <p className="text-sm text-red-300">
        {configQuery.error instanceof Error
          ? configQuery.error.message
          : "Could not load workflow settings."}
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-3xl font-semibold text-white">
            Workflow Configuration
          </h2>
          <p className="mt-1 text-sm text-slate-200/85">
            Configure transition rules, default assignments, and workflow
            guardrails.
          </p>
        </div>
        <Badge>{payload.organizationId}</Badge>
      </div>

      {actionError ? (
        <p className="rounded-lg border border-red-300/40 bg-red-500/10 px-3 py-2 text-xs text-red-100">
          {actionError}
        </p>
      ) : null}

      <div className="grid gap-4 md:grid-cols-3">
        <Card title="Sales States">
          <p className="text-3xl font-semibold text-white">
            {payload.states.sales.length}
          </p>
        </Card>
        <Card title="Logistics States">
          <p className="text-3xl font-semibold text-white">
            {payload.states.logistics.length}
          </p>
        </Card>
        <Card title="Updated">
          <p className="text-base font-semibold text-white">
            {new Date(config.updatedAt).toLocaleString()}
          </p>
        </Card>
      </div>

      <Card
        title="Default Assignments"
        description="Choose who new sales and logistics work is assigned to by default."
      >
        <div className="grid gap-3 md:grid-cols-2">
          <label className="text-xs text-slate-300">
            Sales
            <SelectMenu
              className="mt-1"
              value={config.defaultAssignments.sales}
              onChange={(next) =>
                setEditableConfig((current) =>
                  current
                    ? {
                        ...current,
                        defaultAssignments: {
                          ...current.defaultAssignments,
                          sales: next,
                        },
                      }
                    : current,
                )
              }
              options={payload.assigneeRoles.map((role) => ({
                value: role,
                label: role,
              }))}
            />
          </label>

          <label className="text-xs text-slate-300">
            Logistics
            <SelectMenu
              className="mt-1"
              value={config.defaultAssignments.logistics}
              onChange={(next) =>
                setEditableConfig((current) =>
                  current
                    ? {
                        ...current,
                        defaultAssignments: {
                          ...current.defaultAssignments,
                          logistics: next,
                        },
                      }
                    : current,
                )
              }
              options={payload.assigneeRoles.map((role) => ({
                value: role,
                label: role,
              }))}
            />
          </label>
        </div>
      </Card>

      <Card
        title="Guardrails"
        description="Set rules that keep stage changes controlled and traceable."
      >
        <div className="space-y-3 text-sm text-slate-200">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={config.guardrails.strictTransitionValidation}
              onChange={(event) =>
                setEditableConfig((current) =>
                  current
                    ? {
                        ...current,
                        guardrails: {
                          ...current.guardrails,
                          strictTransitionValidation: event.target.checked,
                        },
                      }
                    : current,
                )
              }
            />
            Enforce strict transition validation
          </label>

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={config.guardrails.requireReasonOnManualOverride}
              onChange={(event) =>
                setEditableConfig((current) =>
                  current
                    ? {
                        ...current,
                        guardrails: {
                          ...current.guardrails,
                          requireReasonOnManualOverride: event.target.checked,
                        },
                      }
                    : current,
                )
              }
            />
            Require reason for manual override
          </label>
        </div>
      </Card>

      <Card
        title="Sales Transition Rules"
        description="Choose which stages are allowed next for each sales step."
      >
        {transitionRows(
          payload.states.sales,
          config.transitions.sales,
          (s, v) => updateTransition("sales", s, v),
        )}
      </Card>

      <Card
        title="Logistics Transition Rules"
        description="Choose which stages are allowed next for each logistics step."
      >
        {transitionRows(
          payload.states.logistics,
          config.transitions.logistics,
          (s, v) => updateTransition("logistics", s, v),
        )}
      </Card>

      <div className="flex flex-wrap items-center gap-3">
        <Button
          onClick={saveConfig}
          disabled={!dirty || saveState === "saving"}
        >
          {saveState === "saving"
            ? "Saving..."
            : saveState === "saved"
              ? "Saved"
              : "Save Workflow Config"}
        </Button>
        {dirty ? (
          <p className="text-xs text-amber-200">Unsaved changes</p>
        ) : (
          <p className="text-xs text-slate-300">All changes saved</p>
        )}
      </div>
    </div>
  );
}
