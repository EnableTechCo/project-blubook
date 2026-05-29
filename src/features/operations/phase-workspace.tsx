"use client";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

interface WorkspaceMetric {
  label: string;
  value: string;
  hint: string;
}

export function PhaseWorkspace({
  phase,
  title,
  subtitle,
  metrics,
  streams,
}: {
  phase: string;
  title: string;
  subtitle: string;
  metrics: WorkspaceMetric[];
  streams: Array<{ title: string; items: string[] }>;
}) {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm uppercase tracking-[0.18em] text-cyan-200/80">
            {phase}
          </p>
          <h2 className="text-3xl font-semibold text-white">{title}</h2>
          <p className="mt-1 text-sm text-slate-200/85">{subtitle}</p>
        </div>
        <Badge>{phase} Active</Badge>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => (
          <Card
            key={metric.label}
            title={metric.label}
            description={metric.hint}
          >
            <p className="text-3xl font-semibold text-white">{metric.value}</p>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        {streams.map((stream) => (
          <Card
            key={stream.title}
            title={stream.title}
            description="Operational stream"
          >
            <ul className="list-disc space-y-2 pl-5 text-sm text-slate-100/90">
              {stream.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </Card>
        ))}
      </div>
    </div>
  );
}
