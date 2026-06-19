import { createAdminClient } from "@/lib/supabase/admin";

export type ActivityActorType = 'partner' | 'customer' | 'system' | 'admin';

export type ActivityActionType = 
  // Request lifecycle
  | 'request_created'
  | 'request_accepted'
  | 'request_rejected'
  | 'request_acknowledged'
  
  // Messages
  | 'message_sent'
  | 'message_received'
  
  // Documents
  | 'document_uploaded'
  | 'document_approved'
  | 'document_rejected'
  | 'document_resubmission_requested'
  
  // Workflow
  | 'handoff_created'
  | 'handoff_accepted'
  | 'handoff_rejected'
  | 'handoff_completed'
  | 'workflow_step_completed'
  
  // System events
  | 'order_confirmed'
  | 'ai_readiness_updated';

// The input structure for logging an activity
interface LogActivityInput {
  requestId: string;              
  organizationId?: string | null; 
  partnerId?: string | null;      
  actorId: string;                
  actorType: ActivityActorType;   
  actionType: ActivityActionType; 
  actionDetails?: Record<string, unknown>; 
  metadata?: Record<string, unknown>;      
}


export async function logActivity(input: LogActivityInput) {
  try {
    const admin = createAdminClient();
    
    const { data, error } = await admin
      .from('activity_log')
      .insert({
        request_id: input.requestId,
        organization_id: input.organizationId ?? null,
        partner_id: input.partnerId ?? null,
        actor_id: input.actorId,
        actor_type: input.actorType,
        action_type: input.actionType,
        action_details: input.actionDetails ?? {},
        metadata: input.metadata ?? {},
      })
      .select()
      .single();

    if (error) {
      // Log the error but don't throw, we don't want to break the main flow
      console.error('[Activity Log] Failed to log activity:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('[Activity Log] Unexpected error:', error);
    return null;
  }
}