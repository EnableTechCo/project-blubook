export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      organizations: {
        Row: {
          id: string;
          kind: Database["public"]["Enums"]["organization_kind"];
          name: string;
          slug: string | null;
          status: string;
          primary_contact_name: string | null;
          primary_contact_email: string | null;
          metadata: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          kind: Database["public"]["Enums"]["organization_kind"];
          name: string;
          slug?: string | null;
          status?: string;
          primary_contact_name?: string | null;
          primary_contact_email?: string | null;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          kind?: Database["public"]["Enums"]["organization_kind"];
          name?: string;
          slug?: string | null;
          status?: string;
          primary_contact_name?: string | null;
          primary_contact_email?: string | null;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
      };
      user_profiles: {
        Row: {
          user_id: string;
          organization_id: string | null;
          full_name: string | null;
          email: string;
          role: string;
          membership_status: Database["public"]["Enums"]["membership_status"];
          invited_at: string | null;
          activated_at: string | null;
          last_login_at: string | null;
          metadata: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          organization_id?: string | null;
          full_name?: string | null;
          email: string;
          role: string;
          membership_status?: Database["public"]["Enums"]["membership_status"];
          invited_at?: string | null;
          activated_at?: string | null;
          last_login_at?: string | null;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          organization_id?: string | null;
          full_name?: string | null;
          email?: string;
          role?: string;
          membership_status?: Database["public"]["Enums"]["membership_status"];
          invited_at?: string | null;
          activated_at?: string | null;
          last_login_at?: string | null;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
      };
      organization_memberships: {
        Row: {
          id: string;
          organization_id: string;
          user_id: string | null;
          email: string;
          role: string;
          status: Database["public"]["Enums"]["membership_status"];
          is_primary: boolean;
          invited_by: string | null;
          invited_at: string | null;
          accepted_at: string | null;
          metadata: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          user_id?: string | null;
          email: string;
          role: string;
          status?: Database["public"]["Enums"]["membership_status"];
          is_primary?: boolean;
          invited_by?: string | null;
          invited_at?: string | null;
          accepted_at?: string | null;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          user_id?: string | null;
          email?: string;
          role?: string;
          status?: Database["public"]["Enums"]["membership_status"];
          is_primary?: boolean;
          invited_by?: string | null;
          invited_at?: string | null;
          accepted_at?: string | null;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
      };
      service_packages: {
        Row: {
          id: string;
          code: string;
          name: string;
          description: string | null;
          billing_interval: Database["public"]["Enums"]["billing_interval"];
          currency_code: string;
          unit_amount_cents: number;
          is_active: boolean;
          metadata: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          code: string;
          name: string;
          description?: string | null;
          billing_interval: Database["public"]["Enums"]["billing_interval"];
          currency_code?: string;
          unit_amount_cents: number;
          is_active?: boolean;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          code?: string;
          name?: string;
          description?: string | null;
          billing_interval?: Database["public"]["Enums"]["billing_interval"];
          currency_code?: string;
          unit_amount_cents?: number;
          is_active?: boolean;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
      };
      customer_onboarding_submissions: {
        Row: {
          id: string;
          organization_id: string | null;
          contact_name: string;
          contact_email: string;
          package_id: string;
          submission_status: string;
          business_title: string;
          business_summary: string;
          company_type: string | null;
          employees: string | null;
          country: string | null;
          city: string | null;
          inventory_handling: string | null;
          regulated: boolean;
          regions: Json;
          payload: Json;
          submitted_at: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id?: string | null;
          contact_name: string;
          contact_email: string;
          package_id: string;
          submission_status?: string;
          business_title: string;
          business_summary: string;
          company_type?: string | null;
          employees?: string | null;
          country?: string | null;
          city?: string | null;
          inventory_handling?: string | null;
          regulated?: boolean;
          regions?: Json;
          payload?: Json;
          submitted_at?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string | null;
          contact_name?: string;
          contact_email?: string;
          package_id?: string;
          submission_status?: string;
          business_title?: string;
          business_summary?: string;
          company_type?: string | null;
          employees?: string | null;
          country?: string | null;
          city?: string | null;
          inventory_handling?: string | null;
          regulated?: boolean;
          regions?: Json;
          payload?: Json;
          submitted_at?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      users: {
        Row: Record<string, Json>;
        Insert: Record<string, Json>;
        Update: Record<string, Json>;
      };
      profiles: {
        Row: Record<string, Json>;
        Insert: Record<string, Json>;
        Update: Record<string, Json>;
      };
      roles: {
        Row: Record<string, Json>;
        Insert: Record<string, Json>;
        Update: Record<string, Json>;
      };
      permissions: {
        Row: Record<string, Json>;
        Insert: Record<string, Json>;
        Update: Record<string, Json>;
      };
      service_requests: {
        Row: Record<string, Json>;
        Insert: Record<string, Json>;
        Update: Record<string, Json>;
      };
      request_messages: {
        Row: Record<string, Json>;
        Insert: Record<string, Json>;
        Update: Record<string, Json>;
      };
      documents: {
        Row: Record<string, Json>;
        Insert: Record<string, Json>;
        Update: Record<string, Json>;
      };
      orders: {
        Row: Record<string, Json>;
        Insert: Record<string, Json>;
        Update: Record<string, Json>;
      };
      work_orders: {
        Row: Record<string, Json>;
        Insert: Record<string, Json>;
        Update: Record<string, Json>;
      };
      inventory_items: {
        Row: Record<string, Json>;
        Insert: Record<string, Json>;
        Update: Record<string, Json>;
      };
      shipments: {
        Row: Record<string, Json>;
        Insert: Record<string, Json>;
        Update: Record<string, Json>;
      };
      carriers: {
        Row: Record<string, Json>;
        Insert: Record<string, Json>;
        Update: Record<string, Json>;
      };
      invoices: {
        Row: {
          id: string;
          organization_id: string;
          subscription_id: string | null;
          onboarding_submission_id: string | null;
          invoice_number: string;
          status: Database["public"]["Enums"]["invoice_status"];
          currency_code: string;
          subtotal_cents: number;
          tax_cents: number;
          total_cents: number;
          billing_reason: string;
          due_at: string | null;
          issued_at: string | null;
          paid_at: string | null;
          hosted_invoice_url: string | null;
          pdf_url: string | null;
          metadata: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          subscription_id?: string | null;
          onboarding_submission_id?: string | null;
          invoice_number: string;
          status?: Database["public"]["Enums"]["invoice_status"];
          currency_code?: string;
          subtotal_cents?: number;
          tax_cents?: number;
          total_cents?: number;
          billing_reason?: string;
          due_at?: string | null;
          issued_at?: string | null;
          paid_at?: string | null;
          hosted_invoice_url?: string | null;
          pdf_url?: string | null;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          subscription_id?: string | null;
          onboarding_submission_id?: string | null;
          invoice_number?: string;
          status?: Database["public"]["Enums"]["invoice_status"];
          currency_code?: string;
          subtotal_cents?: number;
          tax_cents?: number;
          total_cents?: number;
          billing_reason?: string;
          due_at?: string | null;
          issued_at?: string | null;
          paid_at?: string | null;
          hosted_invoice_url?: string | null;
          pdf_url?: string | null;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
      };
      invoice_line_items: {
        Row: {
          id: string;
          invoice_id: string;
          package_id: string | null;
          description: string;
          quantity: number;
          unit_amount_cents: number;
          line_total_cents: number;
          metadata: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          invoice_id: string;
          package_id?: string | null;
          description: string;
          quantity?: number;
          unit_amount_cents?: number;
          line_total_cents?: number;
          metadata?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          invoice_id?: string;
          package_id?: string | null;
          description?: string;
          quantity?: number;
          unit_amount_cents?: number;
          line_total_cents?: number;
          metadata?: Json;
          created_at?: string;
        };
      };
      subscriptions: {
        Row: {
          id: string;
          organization_id: string;
          package_id: string;
          onboarding_submission_id: string | null;
          status: Database["public"]["Enums"]["subscription_status"];
          billing_interval: Database["public"]["Enums"]["billing_interval"];
          currency_code: string;
          unit_amount_cents: number;
          quantity: number;
          cancel_at_period_end: boolean;
          current_period_start: string | null;
          current_period_end: string | null;
          cancelled_at: string | null;
          metadata: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          package_id: string;
          onboarding_submission_id?: string | null;
          status?: Database["public"]["Enums"]["subscription_status"];
          billing_interval: Database["public"]["Enums"]["billing_interval"];
          currency_code?: string;
          unit_amount_cents: number;
          quantity?: number;
          cancel_at_period_end?: boolean;
          current_period_start?: string | null;
          current_period_end?: string | null;
          cancelled_at?: string | null;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          package_id?: string;
          onboarding_submission_id?: string | null;
          status?: Database["public"]["Enums"]["subscription_status"];
          billing_interval?: Database["public"]["Enums"]["billing_interval"];
          currency_code?: string;
          unit_amount_cents?: number;
          quantity?: number;
          cancel_at_period_end?: boolean;
          current_period_start?: string | null;
          current_period_end?: string | null;
          cancelled_at?: string | null;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
      };
      invitations: {
        Row: {
          id: string;
          organization_id: string | null;
          membership_id: string | null;
          email: string;
          role: string;
          token_hash: string;
          status: Database["public"]["Enums"]["invitation_status"];
          invited_by: string | null;
          expires_at: string;
          accepted_at: string | null;
          revoked_at: string | null;
          metadata: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id?: string | null;
          membership_id?: string | null;
          email: string;
          role: string;
          token_hash: string;
          status?: Database["public"]["Enums"]["invitation_status"];
          invited_by?: string | null;
          expires_at: string;
          accepted_at?: string | null;
          revoked_at?: string | null;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string | null;
          membership_id?: string | null;
          email?: string;
          role?: string;
          token_hash?: string;
          status?: Database["public"]["Enums"]["invitation_status"];
          invited_by?: string | null;
          expires_at?: string;
          accepted_at?: string | null;
          revoked_at?: string | null;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
      };
      outbound_emails: {
        Row: {
          id: string;
          template_key: string;
          organization_id: string | null;
          invitation_id: string | null;
          invoice_id: string | null;
          to_email: string;
          subject: string;
          provider: string;
          provider_message_id: string | null;
          status: Database["public"]["Enums"]["email_delivery_status"];
          payload: Json;
          error_message: string | null;
          queued_at: string;
          sent_at: string | null;
          delivered_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          template_key: string;
          organization_id?: string | null;
          invitation_id?: string | null;
          invoice_id?: string | null;
          to_email: string;
          subject: string;
          provider?: string;
          provider_message_id?: string | null;
          status?: Database["public"]["Enums"]["email_delivery_status"];
          payload?: Json;
          error_message?: string | null;
          queued_at?: string;
          sent_at?: string | null;
          delivered_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          template_key?: string;
          organization_id?: string | null;
          invitation_id?: string | null;
          invoice_id?: string | null;
          to_email?: string;
          subject?: string;
          provider?: string;
          provider_message_id?: string | null;
          status?: Database["public"]["Enums"]["email_delivery_status"];
          payload?: Json;
          error_message?: string | null;
          queued_at?: string;
          sent_at?: string | null;
          delivered_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      notifications: {
        Row: Record<string, Json>;
        Insert: Record<string, Json>;
        Update: Record<string, Json>;
      };
      activity_logs: {
        Row: Record<string, Json>;
        Insert: Record<string, Json>;
        Update: Record<string, Json>;
      };
      analytics_events: {
        Row: Record<string, Json>;
        Insert: Record<string, Json>;
        Update: Record<string, Json>;
      };
      audit_logs: {
        Row: Record<string, Json>;
        Insert: Record<string, Json>;
        Update: Record<string, Json>;
      };
      onboarding_anomaly_alerts: {
        Row: {
          id: string;
          organization_id: string;
          onboarding_submission_id: string;
          profile_id: string;
          anomaly_type: string;
          reason: string;
          severity: "low" | "medium" | "high";
          status: "pending_review" | "reviewed" | "dismissed";
          reviewed_by: string | null;
          reviewed_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          onboarding_submission_id: string;
          profile_id: string;
          anomaly_type: string;
          reason: string;
          severity: "low" | "medium" | "high";
          status?: "pending_review" | "reviewed" | "dismissed";
          reviewed_by?: string | null;
          reviewed_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          onboarding_submission_id?: string;
          profile_id?: string;
          anomaly_type?: string;
          reason?: string;
          severity?: "low" | "medium" | "high";
          status?: "pending_review" | "reviewed" | "dismissed";
          reviewed_by?: string | null;
          reviewed_at?: string | null;
          created_at?: string;
        };
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      organization_kind: "customer" | "partner" | "admin";
      membership_status: "invited" | "active" | "suspended";
      invitation_status: "pending" | "accepted" | "expired" | "revoked";
      billing_interval: "monthly" | "quarterly" | "annual" | "one_time";
      subscription_status:
        | "draft"
        | "trialing"
        | "active"
        | "past_due"
        | "cancelled"
        | "expired";
      invoice_status: "draft" | "issued" | "paid" | "void" | "overdue";
      email_delivery_status: "queued" | "sent" | "delivered" | "failed";
    };
    CompositeTypes: Record<string, never>;
  };
}
