"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SelectMenu } from "@/components/ui/select-menu";
import {
  getWorkflowStep,
  type WorkflowStepInputField,
} from "@/lib/workflow/workflow-step-contract";

type FieldValue = string | string[];

type LogisticsProviderOption = {
  id: string;
  name: string;
  site: string;
  packageStream: string;
  score: number;
  rank?: number;
  stats: {
    active: number;
    completed: number;
    rejected: number;
  };
};

type WorkflowStepInputModalProps = {
  /** The step key from WORKFLOW_STEP_CONTRACT */
  stepKey: string;
  /** The order to record inputs for */
  orderId: string;
  /** Title shown in the modal header, e.g. "Validate Order" */
  actionLabel: string;
  /** Called when the user cancels */
  onClose: () => void;
  /**
   * Called after inputData has been validated client-side.
   * The parent handles the actual API call (advance + step-inputs) so
   * it can compose both in one flow. Return an error string on failure.
   */
  onConfirm: (
    inputData: Record<string, unknown>,
    actorNotes: string,
  ) => Promise<string | null>;
};

function FieldInput({
  field,
  value,
  onChange,
}: {
  field: WorkflowStepInputField;
  value: FieldValue;
  onChange: (val: FieldValue) => void;
}) {
  const id = `wsim-${field.key}`;

  if (field.type === "select" && field.options) {
    return (
      <SelectMenu
        id={id}
        value={typeof value === "string" ? value : ""}
        placeholder="Select an option"
        onChange={(nextValue) => onChange(nextValue)}
        options={field.options.map((opt) => ({
          value: opt.value,
          label: opt.label,
        }))}
      />
    );
  }

  if (field.type === "multi-select" && field.options) {
    const selected = Array.isArray(value) ? value : [];
    return (
      <div className="flex flex-wrap gap-2">
        {field.options.map((opt) => {
          const checked = selected.includes(opt.value);
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => {
                onChange(
                  checked
                    ? selected.filter((v) => v !== opt.value)
                    : [...selected, opt.value],
                );
              }}
              className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                checked
                  ? "border-cyan-300 bg-cyan-100 text-cyan-800"
                  : "border-slate-300 bg-white text-slate-700 hover:border-slate-400"
              }`}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    );
  }

  if (field.type === "date") {
    return (
      <Input
        id={id}
        type="date"
        value={typeof value === "string" ? value : ""}
        onChange={(e) => onChange(e.target.value)}
        className="border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 focus:ring-cyan-500"
      />
    );
  }

  if (field.type === "number") {
    return (
      <Input
        id={id}
        type="number"
        min={0}
        value={typeof value === "string" ? value : ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder={field.description ?? ""}
        className="border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 focus:ring-cyan-500"
      />
    );
  }

  // text / file treated as text URL input
  return (
    <Input
      id={id}
      type="text"
      value={typeof value === "string" ? value : ""}
      onChange={(e) => onChange(e.target.value)}
      placeholder={field.description ?? ""}
      className="border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 focus:ring-cyan-500"
    />
  );
}

export function WorkflowStepInputModal({
  stepKey,
  orderId,
  actionLabel,
  onClose,
  onConfirm,
}: WorkflowStepInputModalProps) {
  const step = getWorkflowStep(stepKey);
  const [values, setValues] = useState<Record<string, FieldValue>>(() => {
    if (!step) return {};
    const init: Record<string, FieldValue> = {};
    for (const f of step.inputFields) {
      init[f.key] = f.type === "multi-select" ? [] : "";
    }
    return init;
  });
  const [actorNotes, setActorNotes] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [logisticsProviders, setLogisticsProviders] = useState<
    LogisticsProviderOption[]
  >([]);
  const [loadingLogisticsProviders, setLoadingLogisticsProviders] =
    useState(false);
  const [logisticsProvidersError, setLogisticsProvidersError] = useState<
    string | null
  >(null);
  const [expandedProviderId, setExpandedProviderId] = useState<string | null>(
    null,
  );
  const firstInputRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    firstInputRef.current
      ?.querySelector<HTMLElement>("input,select,button")
      ?.focus();
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !submitting) onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, submitting]);

  useEffect(() => {
    if (stepKey !== "logistics_handoff_created") {
      return;
    }

    let cancelled = false;
    setLoadingLogisticsProviders(true);
    setLogisticsProvidersError(null);

    void fetch(`/api/orders/${orderId}/logistics-providers`, {
      method: "GET",
      credentials: "include",
    })
      .then(async (response) => {
        const body = (await response.json().catch(() => null)) as {
          logisticsProviders?: LogisticsProviderOption[];
          error?: string;
        } | null;

        if (cancelled) {
          return;
        }

        if (!response.ok) {
          setLogisticsProvidersError(
            body?.error ?? "Could not load logistics providers.",
          );
          setLogisticsProviders([]);
          return;
        }

        setLogisticsProviders(body?.logisticsProviders ?? []);
      })
      .catch(() => {
        if (!cancelled) {
          setLogisticsProvidersError("Could not load logistics providers.");
          setLogisticsProviders([]);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingLogisticsProviders(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [orderId, stepKey]);

  if (!step) {
    return null;
  }

  const displayLogisticsProviders = logisticsProviders;

  const resolvedStep = step;

  const requiredFields = resolvedStep.inputFields.filter((f) => f.required);
  const hasInputFields = resolvedStep.inputFields.length > 0;

  function validate() {
    const errs: Record<string, string> = {};
    for (const f of requiredFields) {
      const v = values[f.key];
      const empty =
        v === undefined ||
        v === null ||
        (typeof v === "string" && v.trim() === "") ||
        (Array.isArray(v) && v.length === 0);
      if (empty) {
        errs[f.key] = `${f.label} is required.`;
      }
    }
    return errs;
  }

  async function handleSubmit() {
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    setErrors({});
    setSubmitting(true);
    setApiError(null);

    // Normalise: numbers stay as numbers, everything else as string/array
    const inputData: Record<string, unknown> = {};
    for (const f of resolvedStep.inputFields) {
      const v = values[f.key];
      if (f.type === "number") {
        const n = Number(v);
        inputData[f.key] = Number.isNaN(n) ? null : n;
      } else {
        inputData[f.key] = v ?? null;
      }
    }

    const err = await onConfirm(inputData, actorNotes);
    setSubmitting(false);
    if (err) {
      setApiError(err);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 px-4 py-10"
      role="dialog"
      aria-modal="true"
      aria-label={`${actionLabel} — step inputs`}
      onClick={() => {
        if (!submitting) onClose();
      }}
    >
      <div
        className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-5 text-slate-900"
        style={{ backgroundColor: "#ffffff", color: "#0f172a" }}
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-[11px] uppercase tracking-[0.16em] text-cyan-700/80">
          {resolvedStep.label}
        </p>
        <h3 className="mt-1 text-xl font-semibold text-slate-900">
          {actionLabel}
        </h3>
        <p className="mt-1 text-xs text-slate-600">
          {resolvedStep.description}
        </p>

        {hasInputFields ? (
          <div className="mt-4 space-y-4" ref={firstInputRef}>
            {resolvedStep.inputFields.map((field) => (
              <div key={field.key}>
                <label
                  htmlFor={`wsim-${field.key}`}
                  className="mb-1 block text-xs font-medium text-slate-800"
                >
                  {field.label}
                  {field.required ? (
                    <span className="ml-0.5 text-red-600">*</span>
                  ) : (
                    <span className="ml-1 text-slate-500">(optional)</span>
                  )}
                </label>
                {field.description ? (
                  <p className="mb-1 text-[11px] text-slate-600">
                    {field.description}
                  </p>
                ) : null}
                {resolvedStep.key === "logistics_handoff_created" &&
                field.key === "logistics_partner_id" ? (
                  <div className="space-y-2">
                    {loadingLogisticsProviders ? (
                      <p className="text-[11px] text-slate-600">
                        Loading logistics providers...
                      </p>
                    ) : null}

                    {logisticsProvidersError ? (
                      <p className="text-[11px] text-red-600">
                        {logisticsProvidersError}
                      </p>
                    ) : null}

                    {displayLogisticsProviders.length > 0 ? (
                      displayLogisticsProviders.length === 1 ? (
                        <div className="grid gap-2">
                          {displayLogisticsProviders.map((provider) => {
                            const selected = values[field.key] === provider.id;
                            const selectable = true;
                            return (
                              <button
                                key={provider.id}
                                type="button"
                                onClick={() => {
                                  if (!selectable) {
                                    return;
                                  }
                                  setValues((prev) => ({
                                    ...prev,
                                    [field.key]: provider.id,
                                  }));
                                }}
                                className={`rounded-xl border px-3 py-2 text-left transition-colors ${
                                  selected
                                    ? "border-cyan-300 bg-cyan-50 shadow-[0_0_0_1px_rgba(34,211,238,0.25)]"
                                    : "border-slate-200 bg-white hover:border-slate-300"
                                } ${
                                  selectable
                                    ? ""
                                    : "cursor-not-allowed opacity-80"
                                }`}
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <div>
                                    <p className="text-sm font-semibold text-slate-900">
                                      {provider.name}
                                    </p>
                                  </div>
                                  <span className="rounded-full border border-cyan-300 bg-cyan-100 px-2 py-0.5 text-[11px] font-semibold text-cyan-800">
                                    Score {provider.score}
                                  </span>
                                </div>
                                <p className="mt-1 text-[11px] text-slate-600">
                                  {provider.site} • {provider.packageStream}
                                </p>
                                <div className="mt-2 flex flex-wrap gap-1.5">
                                  <span className="rounded-full border border-slate-300 bg-slate-100 px-2 py-0.5 text-[10px] text-slate-700">
                                    Active {provider.stats.active}
                                  </span>
                                  <span className="rounded-full border border-emerald-300 bg-emerald-100 px-2 py-0.5 text-[10px] text-emerald-700">
                                    Completed {provider.stats.completed}
                                  </span>
                                  <span className="rounded-full border border-rose-300 bg-rose-100 px-2 py-0.5 text-[10px] text-rose-700">
                                    Rejected {provider.stats.rejected}
                                  </span>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {displayLogisticsProviders.map((provider) => {
                            const selected = values[field.key] === provider.id;
                            const selectable = true;
                            const expanded = expandedProviderId === provider.id;

                            return (
                              <div
                                key={provider.id}
                                className={`rounded-xl border ${
                                  selected
                                    ? "border-cyan-300 bg-cyan-50"
                                    : "border-slate-200 bg-white"
                                }`}
                              >
                                <button
                                  type="button"
                                  onClick={() =>
                                    setExpandedProviderId((current) =>
                                      current === provider.id
                                        ? null
                                        : provider.id,
                                    )
                                  }
                                  className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left"
                                >
                                  <div>
                                    <p className="text-sm font-semibold text-slate-900">
                                      {provider.name}
                                    </p>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className="rounded-full border border-cyan-300 bg-cyan-100 px-2 py-0.5 text-[11px] font-semibold text-cyan-800">
                                      Score {provider.score}
                                    </span>
                                    <span className="text-xs text-slate-600">
                                      {expanded ? "Hide" : "Show"}
                                    </span>
                                  </div>
                                </button>

                                {expanded ? (
                                  <div className="border-t border-slate-200 px-3 py-2">
                                    <p className="text-[11px] text-slate-600">
                                      {provider.site} • {provider.packageStream}
                                    </p>
                                    <div className="mt-2 flex flex-wrap gap-1.5">
                                      <span className="rounded-full border border-slate-300 bg-slate-100 px-2 py-0.5 text-[10px] text-slate-700">
                                        Active {provider.stats.active}
                                      </span>
                                      <span className="rounded-full border border-emerald-300 bg-emerald-100 px-2 py-0.5 text-[10px] text-emerald-700">
                                        Completed {provider.stats.completed}
                                      </span>
                                      <span className="rounded-full border border-rose-300 bg-rose-100 px-2 py-0.5 text-[10px] text-rose-700">
                                        Rejected {provider.stats.rejected}
                                      </span>
                                    </div>

                                    <div className="mt-2">
                                      <Button
                                        type="button"
                                        className="h-7 rounded-md bg-cyan-600 px-2.5 text-[11px] font-semibold text-white hover:bg-cyan-500"
                                        disabled={!selectable}
                                        onClick={() =>
                                          setValues((prev) => ({
                                            ...prev,
                                            [field.key]: provider.id,
                                          }))
                                        }
                                      >
                                        {selected
                                          ? "Selected"
                                          : "Select provider"}
                                      </Button>
                                    </div>
                                  </div>
                                ) : null}
                              </div>
                            );
                          })}
                        </div>
                      )
                    ) : !loadingLogisticsProviders &&
                      !logisticsProvidersError ? (
                      <p className="text-[11px] text-slate-600">
                        No active logistics providers are available right now.
                      </p>
                    ) : null}
                  </div>
                ) : (
                  <FieldInput
                    field={field}
                    value={
                      values[field.key] ??
                      (field.type === "multi-select" ? [] : "")
                    }
                    onChange={(val) =>
                      setValues((prev) => ({ ...prev, [field.key]: val }))
                    }
                  />
                )}
                {errors[field.key] ? (
                  <p className="mt-0.5 text-[11px] text-red-600">
                    {errors[field.key]}
                  </p>
                ) : null}
              </div>
            ))}

            <div>
              <label
                htmlFor="wsim-actor-notes"
                className="mb-1 block text-xs font-medium text-slate-700"
              >
                Notes <span className="text-slate-500">(optional)</span>
              </label>
              <textarea
                id="wsim-actor-notes"
                value={actorNotes}
                onChange={(e) => setActorNotes(e.target.value)}
                rows={2}
                placeholder="Any relevant context for this step…"
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 resize-none"
              />
            </div>
          </div>
        ) : (
          <p className="mt-4 text-sm text-slate-600">
            No structured inputs required for this step. Confirm to proceed.
          </p>
        )}

        {apiError ? (
          <p className="mt-3 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-700">
            {apiError}
          </p>
        ) : null}

        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" disabled={submitting} onClick={onClose}>
            Cancel
          </Button>
          <Button
            className="bg-cyan-600 text-white hover:bg-cyan-500"
            disabled={submitting}
            onClick={() => void handleSubmit()}
          >
            {submitting ? "Saving…" : actionLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
