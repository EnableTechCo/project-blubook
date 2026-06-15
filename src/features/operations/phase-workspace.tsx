"use client";

import { useState, type ComponentType } from "react";
import { HoverAnimatedIcon } from "@/components/ui/hover-animated-icon";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { BoxesIcon } from "@/components/icons/boxes";
import { ClipboardCheckIcon } from "@/components/icons/clipboard-check";
import { HistoryIcon } from "@/components/icons/history";
import { WorkflowIcon } from "@/components/icons/workflow";

interface WorkspaceMetric {
  label: string;
  value: string;
  hint: string;
}

const METRIC_ICONS: ComponentType<{ className?: string; size?: number }>[] = [
  WorkflowIcon,
  ClipboardCheckIcon,
  BoxesIcon,
  HistoryIcon,
];

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
  const [hoveredMetric, setHoveredMetric] = useState<string | null>(null);

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
        {metrics.map((metric, index) => {
          const Icon =
            METRIC_ICONS[index % METRIC_ICONS.length] ?? WorkflowIcon;
          return (
            <div
              key={metric.label}
              onMouseEnter={() => setHoveredMetric(metric.label)}
              onMouseLeave={() =>
                setHoveredMetric((current) =>
                  current === metric.label ? null : current,
                )
              }
            >
              <Card title={metric.label} description={metric.hint}>
                <div className="flex items-center justify-between gap-3">
                  <p className="text-3xl font-semibold text-white">
                    {metric.value}
                  </p>
                  <HoverAnimatedIcon
                    icon={Icon}
                    active={hoveredMetric === metric.label}
                    className="inline-flex items-center text-slate-200"
                    size={24}
                  />
                </div>
              </Card>
            </div>
          );
        })}
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
