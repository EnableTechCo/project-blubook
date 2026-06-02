import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CustomerBundleBanner } from "@/features/customer/bundle-banner";
import {
  MOCK_CUSTOMER_ACTIVITY_FEED,
  MOCK_CUSTOMER_DASHBOARD_PACK,
  MOCK_CUSTOMER_REQUESTS,
} from "@/features/mock/dashboard-data";

export default function CustomerDashboardPage() {
  const openRequests = MOCK_CUSTOMER_REQUESTS.filter((item) =>
    ["submitted", "triaged", "in_progress", "review"].includes(item.status),
  );
  const metricToneClass: Record<string, string> = {
    good: "text-mint",
    warn: "text-sun",
    critical: "text-coral",
    neutral: "text-white",
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-semibold">Customer Dashboard</h2>
        <Badge>{openRequests.length} Active</Badge>
      </div>
      <CustomerBundleBanner />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {MOCK_CUSTOMER_DASHBOARD_PACK.metrics.map((metric) => (
          <Card key={metric.id} title={metric.label} description={metric.hint}>
            <p
              className={`text-3xl font-semibold ${metricToneClass[metric.tone ?? "neutral"]}`}
            >
              {metric.value}
            </p>
            {metric.delta ? (
              <p className="mt-1 text-xs text-slate-300">{metric.delta}</p>
            ) : null}
          </Card>
        ))}
      </div>

      <Card
        title="Recent Activity"
        description="Event feed for QA, demos, and automation tests."
      >
        <div className="space-y-2">
          {MOCK_CUSTOMER_ACTIVITY_FEED.map((item) => (
            <p
              key={item}
              className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100"
            >
              {item}
            </p>
          ))}
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card
          title="AI Recommendations"
          description="Automation-ready recommendations from mock platform data."
        >
          <div className="space-y-3">
            {MOCK_CUSTOMER_DASHBOARD_PACK.aiRecommendations.map((item) => (
              <div
                key={item.id}
                className="rounded-xl border border-white/15 bg-white/5 p-3"
              >
                <p className="text-sm font-semibold text-white">{item.title}</p>
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
          title="Copilot Prompt Starters"
          description="Reusable prompts for dashboard chatbot integration tests."
        >
          <div className="space-y-3">
            {MOCK_CUSTOMER_DASHBOARD_PACK.aiPrompts.map((item) => (
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

      <Card
        title="Upcoming Milestones"
        description="Execution checkpoints for this week."
      >
        <div className="grid gap-2 md:grid-cols-3">
          <div className="rounded-xl border border-white/15 bg-white/5 p-3 text-sm text-slate-100">
            Mon 10:00 - Fiber cutover readiness review
          </div>
          <div className="rounded-xl border border-white/15 bg-white/5 p-3 text-sm text-slate-100">
            Wed 14:30 - POS firmware acceptance sign-off
          </div>
          <div className="rounded-xl border border-white/15 bg-white/5 p-3 text-sm text-slate-100">
            Fri 16:00 - Weekly SLA governance call
          </div>
        </div>
      </Card>
    </div>
  );
}
