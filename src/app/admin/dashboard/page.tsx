import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  MOCK_ADMIN_DASHBOARD_PACK,
  MOCK_AI_SCENARIOS,
} from "@/features/mock/dashboard-data";

export default function AdminDashboardPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-3xl font-semibold text-white">Admin Dashboard</h2>
          <p className="mt-2 text-sm text-slate-200/85">
            {MOCK_ADMIN_DASHBOARD_PACK.subheading}
          </p>
        </div>
        <Badge>Phase 4 Data Pack</Badge>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {MOCK_ADMIN_DASHBOARD_PACK.metrics.map((metric) => (
          <Card key={metric.id} title={metric.label} description={metric.hint}>
            <p className="text-3xl font-semibold text-white">{metric.value}</p>
            {metric.delta ? (
              <p className="mt-1 text-xs text-slate-300">{metric.delta}</p>
            ) : null}
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Governance Tasks" description="Policy and approval tasks.">
          <div className="space-y-3">
            {MOCK_ADMIN_DASHBOARD_PACK.tasks.map((task) => (
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
          title="Critical Alerts"
          description="Audit and security incidents."
        >
          <div className="space-y-3">
            {MOCK_ADMIN_DASHBOARD_PACK.alerts.map((alert) => (
              <div
                key={alert.id}
                className="rounded-xl border border-white/15 bg-white/5 p-3"
              >
                <p className="text-sm font-semibold text-coral">
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
          title="AI Governance Recommendations"
          description="Recommendations with confidence and action mapping."
        >
          <div className="space-y-3">
            {MOCK_ADMIN_DASHBOARD_PACK.aiRecommendations.map((item) => (
              <div
                key={item.id}
                className="rounded-xl border border-white/15 bg-white/5 p-3"
              >
                <p className="text-sm text-white">{item.title}</p>
                <p className="mt-1 text-xs text-slate-300">{item.reason}</p>
                <p className="mt-2 text-xs text-slate-200">
                  Action: {item.action} (confidence{" "}
                  {Math.round(item.confidence * 100)}%)
                </p>
              </div>
            ))}
          </div>
        </Card>

        <Card
          title="AI Scenario Library"
          description="Scenario coverage for AI ticketing."
        >
          <div className="space-y-3">
            {MOCK_AI_SCENARIOS.map((scenario) => (
              <div
                key={scenario.id}
                className="rounded-xl border border-white/15 bg-white/5 p-3"
              >
                <p className="text-sm font-semibold text-white">
                  {scenario.name}
                </p>
                <p className="mt-1 text-xs text-slate-300">
                  {scenario.trigger}
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  {scenario.phase} | Expected: {scenario.expectedOutcome}
                </p>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
