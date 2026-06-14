"use client";

import { useState, useEffect, JSX } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  Calendar,
  Clock,
  Tag,
  User,
  MessageCircle,
  CheckCircle,
  Clock as ClockIcon,
} from "lucide-react";

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
  const configs: Record<
    string,
    { color: string; icon: JSX.Element; message: string }
  > = {
    completed: {
      color: "bg-emerald-500/20 text-emerald-300",
      icon: <CheckCircle className="w-4 h-4" />,
      message: "This request has been resolved. Thank you for your patience.",
    },
    in_progress: {
      color: "bg-blue-500/20 text-blue-300",
      icon: <ClockIcon className="w-4 h-4" />,
      message: "Our team is actively working on your request.",
    },
    review: {
      color: "bg-purple-500/20 text-purple-300",
      icon: <MessageCircle className="w-4 h-4" />,
      message: "Your request is under review by our support team.",
    },
    pending: {
      color: "bg-amber-500/20 text-amber-300",
      icon: <ClockIcon className="w-4 h-4" />,
      message: "Your request is pending and will be processed soon.",
    },
    triaged: {
      color: "bg-cyan-500/20 text-cyan-300",
      icon: <MessageCircle className="w-4 h-4" />,
      message:
        "Your request has been categorized and assigned to the right team.",
    },
    submitted: {
      color: "bg-amber-500/20 text-amber-300",
      icon: <MessageCircle className="w-4 h-4" />,
      message: "Your request has been received. We&apos;ll update you soon.",
    },
    open: {
      color: "bg-cyan-500/20 text-cyan-300",
      icon: <MessageCircle className="w-4 h-4" />,
      message: "Your request is open and awaiting initial review.",
    },
  };
  return configs[status] || configs.open;
};

const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const getDaysSince = (dateString: string): number => {
  const ageMs = Date.now() - new Date(dateString).getTime();
  return Math.floor(ageMs / (1000 * 60 * 60 * 24));
};

export default function RequestDetailPage() {
  const router = useRouter();
  const [request, setRequest] = useState<Request | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const storedRequest = sessionStorage.getItem("selectedRequest");
    if (storedRequest) {
      setRequest(JSON.parse(storedRequest));
    }
    setIsLoading(false);
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  if (!request) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        <div className="max-w-4xl mx-auto p-6">
          <Card
            className="p-12 bg-white/5 backdrop-blur-sm border-white/10 text-center"
            title={""}
          >
            <div className="text-4xl mb-4">🔍</div>
            <h3 className="text-xl font-semibold text-white mb-2">
              Request not found
            </h3>
            <p className="text-slate-400 mb-4">
              The request you&apos;re looking for doesn&apos;t exist or has been
              removed.
            </p>
            <button
              type="button"
              onClick={() => router.back()}
              className="px-4 py-2 bg-cyan-500/20 text-cyan-300 rounded-lg hover:bg-cyan-500/30 transition-colors"
            >
              Go Back
            </button>
          </Card>
        </div>
      </div>
    );
  }

  const statusConfig = getStatusConfig(request.status);
  const daysOld = getDaysSince(request.created_at);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="max-w-4xl mx-auto p-6 space-y-6">
        {/* Header with back button */}
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => router.back()}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-slate-300" />
          </button>
          <div className="flex-1">
            <p className="text-sm uppercase tracking-[0.18em] text-cyan-200/80">
              Request Details
            </p>
            <h2 className="text-2xl font-semibold text-white">
              {request.title ||
                `${request.category.replace(/_/g, " ")} Request`}
            </h2>
          </div>
          <Badge className={`${statusConfig.color} border-none`}>
            <span className="flex items-center gap-1">
              {statusConfig.icon}
              {request.status.replace(/_/g, " ")}
            </span>
          </Badge>
        </div>

        {/* Request Information */}
        <div className="grid gap-6 md:grid-cols-2">
          <Card
            className="p-6 bg-white/5 backdrop-blur-sm border-white/10"
            title={""}
          >
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <Tag className="w-4 h-4 text-slate-400" />
                <div>
                  <p className="text-xs text-slate-400">Category</p>
                  <p className="text-white capitalize">
                    {request.category.replace(/_/g, " ")}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Calendar className="w-4 h-4 text-slate-400" />
                <div>
                  <p className="text-xs text-slate-400">Created</p>
                  <p className="text-white">{formatDate(request.created_at)}</p>
                  <p className="text-xs text-slate-400 mt-1">
                    {daysOld} {daysOld === 1 ? "day" : "days"} ago
                  </p>
                </div>
              </div>

              {request.completed_at && (
                <div className="flex items-center gap-3">
                  <Clock className="w-4 h-4 text-slate-400" />
                  <div>
                    <p className="text-xs text-slate-400">Completed</p>
                    <p className="text-white">
                      {formatDate(request.completed_at)}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </Card>

          <Card
            className="p-6 bg-white/5 backdrop-blur-sm border-white/10"
            title={""}
          >
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <User className="w-4 h-4 text-slate-400" />
                <div>
                  <p className="text-xs text-slate-400">Request ID</p>
                  <p className="text-white font-mono">{request.id}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <MessageCircle className="w-4 h-4 text-slate-400" />
                <div>
                  <p className="text-xs text-slate-400">Status Update</p>
                  <p className="text-sm text-slate-300">
                    {statusConfig.message}
                  </p>
                </div>
              </div>
            </div>
          </Card>
        </div>

        <Card
          className="p-6 bg-white/5 backdrop-blur-sm border-white/10"
          title={""}
        >
          <h3 className="text-lg font-semibold text-white mb-3">Description</h3>
          <p className="text-slate-300 leading-relaxed">
            {request.description ||
              "No additional description provided for this request."}
          </p>
        </Card>

        <div className="flex gap-4 justify-end">
          <button
            type="button"
            onClick={() => router.back()}
            className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-white transition-colors"
          >
            Back to List
          </button>
          {request.status !== "completed" && request.status !== "cancelled" && (
            <button
              type="button"
              className="px-4 py-2 bg-cyan-500 hover:bg-cyan-600 rounded-lg text-white transition-colors"
            >
              Add Comment
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
