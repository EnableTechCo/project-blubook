"use client";

import { Card } from "@/components/ui/card";

export function WorkflowPipeline({
  title,
  states,
  currentState,
}: {
  title: string;
  states: readonly string[];
  currentState?: string | null;
}) {
  const currentIndex = currentState ? states.indexOf(currentState) : -1;

  return (
    <Card title={title} description="State machine view">
      <div className="flex flex-wrap gap-2">
        {states.map((state, index) => (
          <div key={state} className="flex items-center gap-2">
            <span
              className={`rounded-full px-3 py-1 text-xs ${
                currentIndex >= 0 && index <= currentIndex
                  ? "border border-green-400/40 bg-green-500/15 text-green-200"
                  : "border border-white/20 bg-white/5 text-slate-100"
              }`}
            >
              {state}
            </span>
            {index < states.length - 1 ? (
              <span className="text-slate-400">→</span>
            ) : null}
          </div>
        ))}
      </div>
    </Card>
  );
}
