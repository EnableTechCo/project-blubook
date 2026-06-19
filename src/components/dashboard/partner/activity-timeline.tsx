"use client";

import { useState, useEffect } from "react";
import { formatDistanceToNow } from "date-fns";

interface Activity {
  id: string;
  requestId: string;
  actorId: string;
  actorType: 'partner' | 'customer' | 'system' | 'admin';
  actorName: string;
  actorDisplayName: string;
  actionType: string;
  actionMessage: string;
  actionDetails: Record<string, unknown>;
  metadata: Record<string, unknown>;
  createdAt: string;
  organizationName: string | null;
}

interface ActivityTimelineProps {
  limit?: number;
  requestId?: string;
}

export function ActivityTimeline({ limit = 10, requestId }: ActivityTimelineProps) {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchActivities() {
      setLoading(true);
      setError(null);

      try {
        let url = `/api/partner/activity?limit=${limit}`;
        if (requestId) {
          url += `&requestId=${requestId}`;
        }

        const response = await fetch(url);
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to load activities');
        }

        setActivities(data.activities || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load activities');
      } finally {
        setLoading(false);
      }
    }

    fetchActivities();
  }, [limit, requestId]);

  if (loading) {
    return (
      <div className="space-y-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="animate-pulse flex items-start space-x-3">
            <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-3/4 bg-slate-200 dark:bg-slate-700 rounded" />
              <div className="h-3 w-1/2 bg-slate-200 dark:bg-slate-700 rounded" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <p className="text-sm text-red-500 dark:text-red-400">
        {error}
      </p>
    );
  }

  if (activities.length === 0) {
    return (
      <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-4">
        No activity yet. Actions will appear here as they happen.
      </p>
    );
  }

  const groupedActivities = activities.reduce((groups, activity) => {
    const date = new Date(activity.createdAt);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    let key = 'Older';
    if (date.toDateString() === today.toDateString()) {
      key = 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      key = 'Yesterday';
    }
    
    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key].push(activity);
    return groups;
  }, {} as Record<string, Activity[]>);

  const groupOrder = ['Today', 'Yesterday', 'Older'];

  const getActionColor = (actionType: string) => {
    if (actionType.includes('accepted') || actionType.includes('completed')) {
      return 'text-emerald-600 dark:text-emerald-400';
    }
    if (actionType.includes('rejected') || actionType.includes('failed')) {
      return 'text-red-600 dark:text-red-400';
    }
    if (actionType.includes('created') || actionType.includes('sent')) {
      return 'text-blue-600 dark:text-blue-400';
    }
    return 'text-slate-600 dark:text-slate-400';
  };

  return (
    <div className="flow-root">
      <ul className="-mb-8">
        {groupOrder.map((group) => {
          const groupActivities = groupedActivities[group];
          if (!groupActivities || groupActivities.length === 0) return null;

          return (
            <li key={group} className="mb-6">
              <div className="relative">
                <div className="flex items-center">
                  <div className="flex-grow border-t border-slate-200 dark:border-slate-700" />
                  <span className="mx-4 text-xs font-medium text-slate-500 dark:text-slate-400">
                    {group}
                  </span>
                  <div className="flex-grow border-t border-slate-200 dark:border-slate-700" />
                </div>
              </div>
              <ul className="mt-4 space-y-4">
                {groupActivities.map((activity, idx) => (
                  <li key={activity.id} className="relative flex items-start">
                    {idx < groupActivities.length - 1 && (
                      <span className="absolute left-4 top-6 -ml-px h-full w-0.5 bg-slate-200 dark:bg-slate-700" />
                    )}
                    
                    <div className="relative flex h-3 w-3 items-center justify-center mt-1.5">
                      <span className="absolute h-3 w-3 rounded-full bg-slate-300 dark:bg-slate-600 ring-1 ring-slate-200 dark:ring-slate-700" />
                    </div>
                    
                    <div className="min-w-0 flex-1 pl-4">
                      <div className="text-sm">
                        <span className="font-medium text-slate-900 dark:text-white">
                          {activity.actorDisplayName}
                        </span>
                        <span className="text-slate-500 dark:text-slate-400"> · </span>
                        <span className={`font-medium ${getActionColor(activity.actionType)}`}>
                          {activity.actionMessage}
                        </span>
                      </div>
                      {activity.organizationName && (
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {activity.organizationName}
                        </p>
                      )}
                      <div className="mt-0.5 flex items-center gap-2 text-xs text-slate-400 dark:text-slate-500">
                        <span>
                          {formatDistanceToNow(new Date(activity.createdAt), { addSuffix: true })}
                        </span>
                        {typeof activity.actionDetails?.package_stream === 'string' && (
                          <>
                            <span>·</span>
                            <span>Stream: {activity.actionDetails.package_stream}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </li>
          );
        })}
      </ul>
    </div>
  );
}