"use client";

import { Card } from "@/components/ui/card";

export function WorkflowPipeline({
  title,
  states,
}: {
  title: string;
  states: readonly string[];
}) {
  return (
    <Card title={title} description="State machine view">
      <div className="flex flex-wrap gap-2">
        {states.map((state, index) => (
          <div key={state} className="flex items-center gap-2">
            <span className="rounded-full border border-white/20 bg-white/5 px-3 py-1 text-xs text-slate-100">
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
