import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CustomerBundleBanner } from "@/features/customer/bundle-banner";
import {
  MOCK_CUSTOMER_ACTIVITY,
  MOCK_CUSTOMER_REQUESTS,
} from "@/features/mock/dashboard-data";

export default function CustomerDashboardPage() {
  const openRequests = MOCK_CUSTOMER_REQUESTS.filter(
    (item) => !["completed", "cancelled", "rejected"].includes(item.status),
  );
  const urgent = openRequests.filter((item) => item.priority === "urgent");

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-semibold">Customer Dashboard</h2>
        <Badge>{openRequests.length} Active</Badge>
      </div>
      <CustomerBundleBanner />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card title="Open Requests" description="Live workload snapshot">
          <p className="text-3xl font-semibold">{openRequests.length}</p>
        </Card>
        <Card title="SLA On Track" description="Current month">
          <p className="text-3xl font-semibold text-mint">98%</p>
        </Card>
        <Card title="Urgent Queue" description="Immediate attention">
          <p className="text-3xl font-semibold text-sun">{urgent.length}</p>
        </Card>
        <Card title="Unread Messages" description="Across partners">
          <p className="text-3xl font-semibold text-coral">7</p>
        </Card>
      </div>

      <Card
        title="Recent Activity"
        description="Hardcoded feed for demo and QA."
      >
        <div className="space-y-2">
          {MOCK_CUSTOMER_ACTIVITY.map((item) => (
            <p
              key={item}
              className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100"
            >
              {item}
            </p>
          ))}
        </div>
      </Card>

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
