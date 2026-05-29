export type UserRole = "customer" | "partner" | "staff" | "admin";

export type RequestStatus =
  | "draft"
  | "submitted"
  | "in_review"
  | "in_progress"
  | "blocked"
  | "completed"
  | "cancelled";

export interface UserProfile {
  id: string;
  fullName: string;
  email: string;
  role: UserRole;
  avatarUrl?: string;
}

export interface ServiceRequest {
  id: string;
  title: string;
  description?: string;
  status: RequestStatus;
  priority: "low" | "medium" | "high" | "urgent";
  customerId: string;
  partnerId?: string;
  createdAt: string;
  updatedAt: string;
}
