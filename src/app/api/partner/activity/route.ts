import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveServicePartnerIdForPartnerUser } from "@/lib/workflow/partner-context";
import { SupabaseClient, User, Session } from "@supabase/supabase-js";

// ===== Type Definitions =====
type AdminClient = ReturnType<typeof createAdminClient>;
type ServerClient = ReturnType<typeof createServerClient>;

interface PartnerContext {
  admin: AdminClient;
  servicePartnerId: string;
  partnerUserId: string;
  partnerUserEmail: string | null;
}

interface AuthError {
  error: NextResponse;
}

interface UserProfile {
  role: string;
  metadata: Record<string, unknown>;
  organization_id: string | null;
}

interface ActivityActor {
  raw_user_meta_data?: {
    company_name?: string;
    full_name?: string;
  };
  email?: string;
}

interface ActivityOrganization {
  name?: string;
}

interface ActivityLog {
  id: string;
  request_id: string;
  actor_id: string;
  actor_type: 'partner' | 'customer' | 'admin';
  action_type: string;
  action_details?: {
    title?: string;
    [key: string]: unknown;
  };
  metadata?: Record<string, unknown>;
  created_at: string;
  partner_id: string;
  actor?: ActivityActor;
  organization?: ActivityOrganization;
}

interface ActivityResponse {
  id: string;
  requestId: string;
  actorId: string;
  actorType: string;
  actorName: string;
  actorDisplayName: string;
  actionType: string;
  actionMessage: string;
  actionDetails?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  createdAt: string;
  organizationName: string | null;
}

interface PaginationInfo {
  limit: number;
  offset: number;
  total: number;
  hasMore: boolean;
}

// ===== Helper Functions =====
async function requirePartnerContext(): Promise<PartnerContext | AuthError> {
  const server = await createServerClient();
  const {
    data: { user },
  } = await server.auth.getUser();

  if (!user) {
    return {
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("user_profiles")
    .select("role, metadata, organization_id")
    .eq("user_id", user.id)
    .maybeSingle<{
      role: string;
      metadata: Record<string, unknown>;
      organization_id: string | null;
    }>();

  if (!profile || profile.role !== "partner") {
    return {
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  const servicePartnerId = await resolveServicePartnerIdForPartnerUser({
    admin,
    userId: user.id,
    profileMetadata: profile.metadata,
    profileOrganizationId: profile.organization_id ?? null,
    userMetadata: user.user_metadata,
  });

  if (!servicePartnerId) {
    return {
      error: NextResponse.json(
        { error: "Partner profile is not mapped to a service partner." },
        { status: 400 },
      ),
    };
  }

  return {
    admin,
    servicePartnerId,
    partnerUserId: user.id,
    partnerUserEmail: user.email ?? null,
  };
}

function formatActivity(activity: ActivityLog): ActivityResponse {
  let actorName = 'System';
  let actorDisplayName = 'System';
  
  if (activity.actor_type === 'partner') {
    const meta = activity.actor?.raw_user_meta_data || {};
    actorName = meta.company_name || meta.full_name || activity.actor?.email || 'Partner';
    actorDisplayName = actorName;
  } else if (activity.actor_type === 'customer') {
    actorName = activity.organization?.name || 'Customer';
    actorDisplayName = actorName;
  } else if (activity.actor_type === 'admin') {
    actorName = activity.actor?.email || 'Admin';
    actorDisplayName = actorName;
  }

  // Build action message
  let actionMessage = '';
  const actionDetails = activity.action_details;
  
  switch (activity.action_type) {
    case 'request_created':
      actionMessage = `New onboarding request created`;
      break;
    case 'request_accepted':
      actionMessage = `Accepted onboarding request`;
      break;
    case 'request_rejected':
      actionMessage = `Rejected onboarding request`;
      break;
    case 'request_acknowledged':
      actionMessage = `Notification sent to customer`;
      break;
    case 'document_uploaded':
      actionMessage = `Uploaded document: ${actionDetails?.title || 'Unknown'}`;
      break;
    case 'document_approved':
      actionMessage = `Approved document: ${actionDetails?.title || 'Unknown'}`;
      break;
    case 'document_rejected':
      actionMessage = `Requested changes to: ${actionDetails?.title || 'Unknown'}`;
      break;
    case 'handoff_created':
      actionMessage = `Created logistics handoff`;
      break;
    case 'handoff_accepted':
      actionMessage = `Accepted logistics handoff`;
      break;
    case 'handoff_completed':
      actionMessage = `Completed logistics handoff`;
      break;
    case 'order_confirmed':
      actionMessage = `Confirmed purchase order`;
      break;
    default:
      actionMessage = activity.action_type.replace(/_/g, ' ');
  }

  return {
    id: activity.id,
    requestId: activity.request_id,
    actorId: activity.actor_id,
    actorType: activity.actor_type,
    actorName,
    actorDisplayName,
    actionType: activity.action_type,
    actionMessage,
    actionDetails: activity.action_details,
    metadata: activity.metadata,
    createdAt: activity.created_at,
    organizationName: activity.organization?.name || null,
  };
}

// ===== Main API Handler =====
export async function GET(request: Request) {
  const auth = await requirePartnerContext();
  if ("error" in auth) {
    return auth.error;
  }

  const { admin, servicePartnerId } = auth;
  
  const url = new URL(request.url);
  const limit = parseInt(url.searchParams.get('limit') || '50');
  const offset = parseInt(url.searchParams.get('offset') || '0');
  const requestId = url.searchParams.get('requestId');

  const safeLimit = Math.min(Math.max(limit, 1), 100);
  const safeOffset = Math.max(offset, 0);

  // Build the query with proper typing
  let query = admin
    .from('activity_log')
    .select('*', { count: 'exact' })
    .eq('partner_id', servicePartnerId)
    .order('created_at', { ascending: false })
    .range(safeOffset, safeOffset + safeLimit - 1);

  if (requestId) {
    query = query.eq('request_id', requestId);
  }

  const { data: activities, error, count } = await query;

  if (error) {
    console.error('[Activity API] Error:', error);
    return NextResponse.json(
      { error: 'Could not fetch activity timeline' },
      { status: 400 }
    );
  }

  // Type assertion for the activities data
  const typedActivities = activities as ActivityLog[] | null;

  // Format the response
  const formattedActivities: ActivityResponse[] = (typedActivities || []).map(formatActivity);

  const pagination: PaginationInfo = {
    limit: safeLimit,
    offset: safeOffset,
    total: count || 0,
    hasMore: (count || 0) > (safeOffset + safeLimit),
  };

  return NextResponse.json({
    activities: formattedActivities,
    pagination,
  });
}