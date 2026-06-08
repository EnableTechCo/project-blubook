"use client";

import { useState, useEffect, JSX } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Clock, CheckCircle, Circle } from "lucide-react";

interface Request {
  id: string;
  status: string;
  created_at: string;
  completed_at?: string;
  category: string;
  title?: string;
  description?: string;
}

const getStatusConfig = (status: string) => {
  const configs: Record<string, { color: string; icon: JSX.Element; label: string }> = {
    completed: { 
      color: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
      icon: <CheckCircle className="w-3 h-3" />,
      label: "Completed"
    },
    in_progress: { 
      color: "bg-blue-500/20 text-blue-300 border-blue-500/30",
      icon: <Clock className="w-3 h-3" />,
      label: "In Progress"
    },
    pending: { 
      color: "bg-amber-500/20 text-amber-300 border-amber-500/30",
      icon: <Clock className="w-3 h-3" />,
      label: "Pending"
    },
    review: { 
      color: "bg-purple-500/20 text-purple-300 border-purple-500/30",
      icon: <Circle className="w-3 h-3" />,
      label: "Under Review"
    },
    triaged: { 
      color: "bg-cyan-500/20 text-cyan-300 border-cyan-500/30",
      icon: <Circle className="w-3 h-3" />,
      label: "Triaged"
    },
    submitted: { 
      color: "bg-amber-500/20 text-amber-300 border-amber-500/30",
      icon: <Circle className="w-3 h-3" />,
      label: "Submitted"
    },
    cancelled: { 
      color: "bg-red-500/20 text-red-300 border-red-500/30",
      icon: <Circle className="w-3 h-3" />,
      label: "Cancelled"
    },
    open: { 
      color: "bg-cyan-500/20 text-cyan-300 border-cyan-500/30",
      icon: <Circle className="w-3 h-3" />,
      label: "Open"
    }
  };
  return configs[status] || configs.open;
};

const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const getDaysSince = (dateString: string): number => {
  const ageMs = Date.now() - new Date(dateString).getTime();
  return Math.floor(ageMs / (1000 * 60 * 60 * 24));
};

export default function RequestsPage() {
  const router = useRouter();
  const [requests, setRequests] = useState<Request[]>([]);
  const [pageTitle, setPageTitle] = useState("");
  const [filterType, setFilterType] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Retrieve the filtered data from sessionStorage
    const storedRequests = sessionStorage.getItem('filteredRequests');
    const title = sessionStorage.getItem('pageTitle');
    const filter = sessionStorage.getItem('filterType');
    
    if (storedRequests) {
      setRequests(JSON.parse(storedRequests));
      setPageTitle(title || "Requests");
      setFilterType(filter || "");
    }
    setIsLoading(false);
  }, []);

  const getInsightText = () => {
    const count = requests.length;
    if (filterType === 'open') {
      return `You have ${count} open ${count === 1 ? 'request' : 'requests'} that need attention. Our team is actively working on resolving them.`;
    } else if (filterType === 'completed') {
      return `Great news! You have ${count} completed ${count === 1 ? 'request' : 'requests'}. Thank you for your patience.`;
    } else if (filterType === 'all') {
      return `Total of ${count} request${count !== 1 ? 's' : ''} found. Click on any request to view details.`;
    } else if (filterType) {
      return `Showing ${count} request${count !== 1 ? 's' : ''} with status "${filterType.replace(/_/g, ' ')}".`;
    }
    return `Found ${count} request${count !== 1 ? 's' : ''} matching your filter.`;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        <div className="max-w-7xl mx-auto p-6 space-y-6">
          <div className="h-8 w-32 bg-white/10 rounded animate-pulse"></div>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white/5 rounded-xl p-4 h-24 animate-pulse"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.back()}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-slate-300" />
          </button>
          <div>
            <p className="text-sm uppercase tracking-[0.18em] text-cyan-200/80">
              Customer Analytics
            </p>
            <h2 className="text-3xl font-semibold text-white">
              {pageTitle}
            </h2>
          </div>
          <Badge className="bg-cyan-500/20 text-cyan-300 border-cyan-500/30 ml-auto">
            {requests.length} Requests
          </Badge>
        </div>

        <div className="bg-gradient-to-r from-blue-500/10 to-cyan-500/10 rounded-xl p-4 border border-blue-500/20">
          <div className="flex items-start gap-3">
            <div className="text-2xl"></div>
            <div>
              <p className="text-sm font-medium text-white">Summary</p>
              <p className="text-sm text-slate-300">
                {getInsightText()}
              </p>
            </div>
          </div>
        </div>

        {/* Requests List */}
        {requests.length > 0 ? (
          <div className="space-y-3">
            {requests.map((request) => {
              const statusConfig = getStatusConfig(request.status);
              const daysOld = getDaysSince(request.created_at);
              
              return (
                <Card 
                      key={request.id}
                      className="p-4 bg-white/5 backdrop-blur-sm border-white/10 hover:bg-white/10 transition-all group" title={""}                >
                  <div
                    className="flex flex-col md:flex-row md:items-center justify-between gap-3 cursor-pointer"
                    onClick={() => {
                      // Store individual request for detail page
                      sessionStorage.setItem('selectedRequest', JSON.stringify(request));
                      router.push('/customer/analytics/requests/[id]');
                    }}
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <Badge className={statusConfig.color}>
                          <span className="flex items-center gap-1">
                            {statusConfig.icon}
                            {statusConfig.label}
                          </span>
                        </Badge>
                        <Badge className="border-white/20 text-slate-300">
                          {request.category.replace(/_/g, ' ')}
                        </Badge>
                        <span className="text-xs text-slate-400">
                          ID: {request.id}
                        </span>
                      </div>
                      <h3 className="text-white font-medium mb-1">
                        {request.title || `${request.category.replace(/_/g, ' ')} request`}
                      </h3>
                      <div className="flex items-center gap-4 text-xs text-slate-400">
                        <span>Created: {formatDate(request.created_at)}</span>
                        {request.completed_at && (
                          <span>Completed: {formatDate(request.completed_at)}</span>
                        )}
                        <span>Age: {daysOld} {daysOld === 1 ? 'day' : 'days'}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-cyan-400 opacity-0 group-hover:opacity-100 transition-opacity">
                        Click to view details →
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        ) : (
          <Card className="p-12 bg-white/5 backdrop-blur-sm border-white/10 text-center" title={""}>
            <div className="text-4xl mb-4"></div>
            <h3 className="text-xl font-semibold text-white mb-2">No requests found</h3>
            <p className="text-slate-400">
              There are no requests matching the current filter.
            </p>
            <button
              onClick={() => router.back()}
              className="mt-4 px-4 py-2 bg-cyan-500/20 text-cyan-300 rounded-lg hover:bg-cyan-500/30 transition-colors"
            >
              Go Back
            </button>
          </Card>
        )}
      </div>
    </div>
  );
}