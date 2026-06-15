import { cn } from "@/lib/utils";

type StepState = "done" | "active" | "upcoming";

type StepChip = {
  key: string;
  label: string;
  state: StepState;
};

const classByState: Record<StepState, string> = {
  done: "border-emerald-300 bg-emerald-100 text-emerald-800",
  active:
    "border-blue-300 bg-blue-100 text-blue-800 shadow-[0_0_0_1px_rgba(59,130,246,0.25)]",
  upcoming: "border-sky-200 bg-sky-50 text-sky-800",
};

export function StepStateChipsRow({
  chips,
  className,
}: {
  chips: StepChip[];
  className?: string;
}) {
  return (
    <div className={cn("mb-3 grid gap-2 sm:grid-cols-3", className)}>
      {chips.map((chip) => (
        <div
          key={chip.key}
          className={cn(
            "rounded-md border px-3 py-2 text-center text-xs font-semibold",
            classByState[chip.state],
          )}
        >
          {chip.label}
        </div>
      ))}
    </div>
  );
}
