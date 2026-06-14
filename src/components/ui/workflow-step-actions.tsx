import { Button } from "@/components/ui/button";

type WorkflowStepActionTone = "forward" | "backward" | "neutral";

export type WorkflowStepActionItem = {
  key: string;
  label: string;
  loadingLabel?: string;
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
  tone?: WorkflowStepActionTone;
};

function toneClassName(tone: WorkflowStepActionTone) {
  if (tone === "backward") {
    return "border border-amber-300/35 bg-transparent text-amber-100 hover:bg-amber-500/10";
  }

  if (tone === "neutral") {
    return "bg-slate-500/90 text-white hover:bg-slate-400";
  }

  return "bg-cyan-400/90 text-slate-950 hover:bg-cyan-300";
}

export function WorkflowStepActions({
  actions,
  className = "mb-3 flex flex-wrap gap-3",
}: {
  actions: WorkflowStepActionItem[];
  className?: string;
}) {
  if (actions.length === 0) {
    return null;
  }

  return (
    <div className={className}>
      {actions.map((action) => (
        <Button
          key={action.key}
          variant={action.tone === "backward" ? "ghost" : "primary"}
          className={`h-8 rounded-md px-3 text-xs font-semibold ${toneClassName(
            action.tone ?? "forward",
          )}`}
          disabled={action.disabled || action.loading}
          onClick={action.onClick}
        >
          {action.loading
            ? (action.loadingLabel ?? "Working...")
            : action.label}
        </Button>
      ))}
    </div>
  );
}
