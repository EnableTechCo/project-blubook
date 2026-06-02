import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { MOCK_PARTNER_DASHBOARD_PACK } from "@/features/mock/dashboard-data";

export default function PartnerDashboardPage() {
  const severityClass: Record<string, string> = {
    low: "text-slate-200",
    medium: "text-sun",
    high: "text-coral",
    critical: "text-coral",
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-3xl font-semibold text-white">
            Partner Dashboard
          </h2>
          <p className="mt-2 text-sm text-slate-200/85">
            {MOCK_PARTNER_DASHBOARD_PACK.subheading}
          </p>
        </div>
        <Badge>Phase 2 Data Pack</Badge>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {MOCK_PARTNER_DASHBOARD_PACK.metrics.map((metric) => (
          <Card key={metric.id} title={metric.label} description={metric.hint}>
            <p className="text-3xl font-semibold text-white">{metric.value}</p>
            {metric.delta ? (
              <p className="mt-1 text-xs text-slate-300">{metric.delta}</p>
            ) : null}
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card
          title="Execution Queue"
          description="Mock task load with ownership and ETA."
        >
          <div className="space-y-3">
            {MOCK_PARTNER_DASHBOARD_PACK.tasks.map((task) => (
              <div
                key={task.id}
                className="rounded-xl border border-white/15 bg-white/5 p-3"
              >
                <p className="text-sm font-semibold text-white">{task.title}</p>
                <p className="mt-1 text-xs text-slate-300">
                  Owner: {task.owner} | ETA: {task.eta}
                </p>
                <p className="mt-1 text-xs text-slate-200">
                  Status: {task.status}
                </p>
              </div>
            ))}
          </div>
        </Card>

        <Card
          title="Alerts"
          description="Event anomalies and route exceptions."
        >
          <div className="space-y-3">
            {MOCK_PARTNER_DASHBOARD_PACK.alerts.map((alert) => (
              <div
                key={alert.id}
                className="rounded-xl border border-white/15 bg-white/5 p-3"
              >
                <p
                  className={`text-sm font-semibold ${severityClass[alert.severity]}`}
                >
                  {alert.title}
                </p>
                <p className="mt-1 text-xs text-slate-300">{alert.detail}</p>
                <p className="mt-1 text-xs text-slate-400">
                  Source: {alert.source}
                </p>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card
          title="AI Recommendations"
          description="Suggested interventions powered by platform signals."
        >
          <div className="space-y-3">
            {MOCK_PARTNER_DASHBOARD_PACK.aiRecommendations.map((item) => (
              <div
                key={item.id}
                className="rounded-xl border border-white/15 bg-white/5 p-3"
              >
                <p className="text-sm text-white">{item.title}</p>
                <p className="mt-1 text-xs text-slate-300">{item.reason}</p>
                <p className="mt-2 text-xs text-slate-200">
                  Action: {item.action}
                </p>
              </div>
            ))}
          </div>
        </Card>

        <Card
          title="Copilot Test Prompts"
          description="Partner chatbot starter prompts."
        >
          <div className="space-y-3">
            {MOCK_PARTNER_DASHBOARD_PACK.aiPrompts.map((item) => (
              <div
                key={item.id}
                className="rounded-xl border border-white/15 bg-white/5 p-3"
              >
                <p className="text-sm text-white">{item.prompt}</p>
                <p className="mt-1 text-xs text-slate-300">
                  Expected: {item.expectedOutcome}
                </p>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
