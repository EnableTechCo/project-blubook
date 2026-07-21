export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      activity_log: {
        Row: {
          action_details: Json | null
          action_type: string
          actor_id: string
          actor_type: string
          created_at: string | null
          id: string
          metadata: Json | null
          organization_id: string | null
          partner_id: string | null
          request_id: string
        }
        Insert: {
          action_details?: Json | null
          action_type: string
          actor_id: string
          actor_type: string
          created_at?: string | null
          id?: string
          metadata?: Json | null
          organization_id?: string | null
          partner_id?: string | null
          request_id: string
        }
        Update: {
          action_details?: Json | null
          action_type?: string
          actor_id?: string
          actor_type?: string
          created_at?: string | null
          id?: string
          metadata?: Json | null
          organization_id?: string | null
          partner_id?: string | null
          request_id?: string
        }
        Relationships: []
      }
      anomaly_alerts: {
        Row: {
          anomaly_type: string
          area: string
          created_at: string
          id: string
          is_example: boolean
          reason: string
          reviewed_at: string | null
          reviewed_by: string | null
          severity: string
          source_entity_id: string | null
          source_entity_type: string | null
          source_label: string | null
          status: string
        }
        Insert: {
          anomaly_type: string
          area: string
          created_at?: string
          id?: string
          is_example?: boolean
          reason: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          severity: string
          source_entity_id?: string | null
          source_entity_type?: string | null
          source_label?: string | null
          status?: string
        }
        Update: {
          anomaly_type?: string
          area?: string
          created_at?: string
          id?: string
          is_example?: boolean
          reason?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          severity?: string
          source_entity_id?: string | null
          source_entity_type?: string | null
          source_label?: string | null
          status?: string
        }
        Relationships: []
      }
      automation_decisions: {
        Row: {
          confidence_score: number | null
          created_at: string
          decided_at: string
          explanation: string | null
          id: string
          organization_id: string
          profile_id: string | null
          recommendation_json: Json
          recommended_owner_id: string | null
          recommended_priority:
            | Database["public"]["Enums"]["priority_tier_type"]
            | null
          recommended_stream: string | null
          request_id: string | null
          rule_id: string | null
          source: Database["public"]["Enums"]["decision_source_type"]
          status: string
          updated_at: string
        }
        Insert: {
          confidence_score?: number | null
          created_at?: string
          decided_at?: string
          explanation?: string | null
          id?: string
          organization_id: string
          profile_id?: string | null
          recommendation_json?: Json
          recommended_owner_id?: string | null
          recommended_priority?:
            | Database["public"]["Enums"]["priority_tier_type"]
            | null
          recommended_stream?: string | null
          request_id?: string | null
          rule_id?: string | null
          source: Database["public"]["Enums"]["decision_source_type"]
          status?: string
          updated_at?: string
        }
        Update: {
          confidence_score?: number | null
          created_at?: string
          decided_at?: string
          explanation?: string | null
          id?: string
          organization_id?: string
          profile_id?: string | null
          recommendation_json?: Json
          recommended_owner_id?: string | null
          recommended_priority?:
            | Database["public"]["Enums"]["priority_tier_type"]
            | null
          recommended_stream?: string | null
          request_id?: string | null
          rule_id?: string | null
          source?: Database["public"]["Enums"]["decision_source_type"]
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "automation_decisions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_decisions_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "customer_intelligence_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_decisions_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "service_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_decisions_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "automation_rules"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_overrides: {
        Row: {
          created_at: string
          decision_id: string
          id: string
          metadata: Json
          new_owner_id: string | null
          new_priority: Database["public"]["Enums"]["priority_tier_type"] | null
          overridden_by: string | null
          previous_owner_id: string | null
          previous_priority:
            | Database["public"]["Enums"]["priority_tier_type"]
            | null
          reason: string
        }
        Insert: {
          created_at?: string
          decision_id: string
          id?: string
          metadata?: Json
          new_owner_id?: string | null
          new_priority?:
            | Database["public"]["Enums"]["priority_tier_type"]
            | null
          overridden_by?: string | null
          previous_owner_id?: string | null
          previous_priority?:
            | Database["public"]["Enums"]["priority_tier_type"]
            | null
          reason: string
        }
        Update: {
          created_at?: string
          decision_id?: string
          id?: string
          metadata?: Json
          new_owner_id?: string | null
          new_priority?:
            | Database["public"]["Enums"]["priority_tier_type"]
            | null
          overridden_by?: string | null
          previous_owner_id?: string | null
          previous_priority?:
            | Database["public"]["Enums"]["priority_tier_type"]
            | null
          reason?: string
        }
        Relationships: [
          {
            foreignKeyName: "automation_overrides_decision_id_fkey"
            columns: ["decision_id"]
            isOneToOne: false
            referencedRelation: "automation_decisions"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_rules: {
        Row: {
          action_json: Json
          condition_json: Json
          created_at: string
          created_by: string | null
          description: string | null
          enabled: boolean
          id: string
          name: string
          priority_weight: number
          rule_key: string
          stream: string | null
          updated_at: string
        }
        Insert: {
          action_json?: Json
          condition_json?: Json
          created_at?: string
          created_by?: string | null
          description?: string | null
          enabled?: boolean
          id?: string
          name: string
          priority_weight?: number
          rule_key: string
          stream?: string | null
          updated_at?: string
        }
        Update: {
          action_json?: Json
          condition_json?: Json
          created_at?: string
          created_by?: string | null
          description?: string | null
          enabled?: boolean
          id?: string
          name?: string
          priority_weight?: number
          rule_key?: string
          stream?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      catalog_item_dependencies: {
        Row: {
          catalog_item_id: string
          created_at: string
          depends_on_item_id: string
          id: string
        }
        Insert: {
          catalog_item_id: string
          created_at?: string
          depends_on_item_id: string
          id?: string
        }
        Update: {
          catalog_item_id?: string
          created_at?: string
          depends_on_item_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "catalog_item_dependencies_catalog_item_id_fkey"
            columns: ["catalog_item_id"]
            isOneToOne: false
            referencedRelation: "catalog_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "catalog_item_dependencies_depends_on_item_id_fkey"
            columns: ["depends_on_item_id"]
            isOneToOne: false
            referencedRelation: "catalog_items"
            referencedColumns: ["id"]
          },
        ]
      }
      catalog_items: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          item_key: string
          label: string
          service_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          item_key: string
          label: string
          service_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          item_key?: string
          label?: string
          service_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "catalog_items_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_intelligence_profiles: {
        Row: {
          annual_revenue_band: string | null
          business_model: Database["public"]["Enums"]["business_model_type"]
          confidence_score: number | null
          created_at: string
          customer_segment: Database["public"]["Enums"]["customer_segment_type"]
          feature_vector: Json
          fulfillment_model:
            | Database["public"]["Enums"]["fulfillment_model_type"]
            | null
          id: string
          inventory_model:
            | Database["public"]["Enums"]["inventory_model_type"]
            | null
          monthly_order_volume_band: string | null
          onboarding_submission_id: string | null
          organization_id: string
          primary_industry: string
          regions: Json
          regulated: boolean
          sales_channels: Json
          signal_snapshot: Json
          sub_industry: string | null
          updated_at: string
        }
        Insert: {
          annual_revenue_band?: string | null
          business_model: Database["public"]["Enums"]["business_model_type"]
          confidence_score?: number | null
          created_at?: string
          customer_segment?: Database["public"]["Enums"]["customer_segment_type"]
          feature_vector?: Json
          fulfillment_model?:
            | Database["public"]["Enums"]["fulfillment_model_type"]
            | null
          id?: string
          inventory_model?:
            | Database["public"]["Enums"]["inventory_model_type"]
            | null
          monthly_order_volume_band?: string | null
          onboarding_submission_id?: string | null
          organization_id: string
          primary_industry: string
          regions?: Json
          regulated?: boolean
          sales_channels?: Json
          signal_snapshot?: Json
          sub_industry?: string | null
          updated_at?: string
        }
        Update: {
          annual_revenue_band?: string | null
          business_model?: Database["public"]["Enums"]["business_model_type"]
          confidence_score?: number | null
          created_at?: string
          customer_segment?: Database["public"]["Enums"]["customer_segment_type"]
          feature_vector?: Json
          fulfillment_model?:
            | Database["public"]["Enums"]["fulfillment_model_type"]
            | null
          id?: string
          inventory_model?:
            | Database["public"]["Enums"]["inventory_model_type"]
            | null
          monthly_order_volume_band?: string | null
          onboarding_submission_id?: string | null
          organization_id?: string
          primary_industry?: string
          regions?: Json
          regulated?: boolean
          sales_channels?: Json
          signal_snapshot?: Json
          sub_industry?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_intelligence_profiles_onboarding_submission_id_fkey"
            columns: ["onboarding_submission_id"]
            isOneToOne: false
            referencedRelation: "customer_onboarding_submissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_intelligence_profiles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_onboarding_submissions: {
        Row: {
          annual_revenue_band: string | null
          business_model:
            | Database["public"]["Enums"]["business_model_type"]
            | null
          business_summary: string
          business_title: string
          city: string | null
          company_type: string | null
          contact_email: string
          contact_name: string
          country: string | null
          created_at: string
          customer_segment:
            | Database["public"]["Enums"]["customer_segment_type"]
            | null
          employees: string | null
          fulfillment_model:
            | Database["public"]["Enums"]["fulfillment_model_type"]
            | null
          id: string
          inventory_handling: string | null
          inventory_model:
            | Database["public"]["Enums"]["inventory_model_type"]
            | null
          monthly_order_volume_band: string | null
          organization_id: string | null
          package_id: string
          payload: Json
          primary_industry: string | null
          regions: Json
          regulated: boolean
          sales_channels: Json
          sub_industry: string | null
          submission_status: string
          submitted_at: string
          updated_at: string
        }
        Insert: {
          annual_revenue_band?: string | null
          business_model?:
            | Database["public"]["Enums"]["business_model_type"]
            | null
          business_summary: string
          business_title: string
          city?: string | null
          company_type?: string | null
          contact_email: string
          contact_name: string
          country?: string | null
          created_at?: string
          customer_segment?:
            | Database["public"]["Enums"]["customer_segment_type"]
            | null
          employees?: string | null
          fulfillment_model?:
            | Database["public"]["Enums"]["fulfillment_model_type"]
            | null
          id?: string
          inventory_handling?: string | null
          inventory_model?:
            | Database["public"]["Enums"]["inventory_model_type"]
            | null
          monthly_order_volume_band?: string | null
          organization_id?: string | null
          package_id: string
          payload?: Json
          primary_industry?: string | null
          regions?: Json
          regulated?: boolean
          sales_channels?: Json
          sub_industry?: string | null
          submission_status?: string
          submitted_at?: string
          updated_at?: string
        }
        Update: {
          annual_revenue_band?: string | null
          business_model?:
            | Database["public"]["Enums"]["business_model_type"]
            | null
          business_summary?: string
          business_title?: string
          city?: string | null
          company_type?: string | null
          contact_email?: string
          contact_name?: string
          country?: string | null
          created_at?: string
          customer_segment?:
            | Database["public"]["Enums"]["customer_segment_type"]
            | null
          employees?: string | null
          fulfillment_model?:
            | Database["public"]["Enums"]["fulfillment_model_type"]
            | null
          id?: string
          inventory_handling?: string | null
          inventory_model?:
            | Database["public"]["Enums"]["inventory_model_type"]
            | null
          monthly_order_volume_band?: string | null
          organization_id?: string | null
          package_id?: string
          payload?: Json
          primary_industry?: string | null
          regions?: Json
          regulated?: boolean
          sales_channels?: Json
          sub_industry?: string | null
          submission_status?: string
          submitted_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_onboarding_submissions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_onboarding_submissions_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "service_packages"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_priority_scores: {
        Row: {
          computed_at: string
          created_at: string
          created_by: string | null
          expires_at: string | null
          id: string
          is_active: boolean
          model_version: string | null
          organization_id: string
          profile_id: string | null
          reason_summary: string | null
          score: number
          score_factors: Json
          tier: Database["public"]["Enums"]["priority_tier_type"]
        }
        Insert: {
          computed_at?: string
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean
          model_version?: string | null
          organization_id: string
          profile_id?: string | null
          reason_summary?: string | null
          score: number
          score_factors?: Json
          tier: Database["public"]["Enums"]["priority_tier_type"]
        }
        Update: {
          computed_at?: string
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean
          model_version?: string | null
          organization_id?: string
          profile_id?: string | null
          reason_summary?: string | null
          score?: number
          score_factors?: Json
          tier?: Database["public"]["Enums"]["priority_tier_type"]
        }
        Relationships: [
          {
            foreignKeyName: "customer_priority_scores_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_priority_scores_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "customer_intelligence_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_provider_requests: {
        Row: {
          acknowledged_at: string | null
          created_at: string
          id: string
          metadata: Json
          onboarding_submission_id: string | null
          organization_id: string
          package_id: string | null
          package_stream: string
          provider_id: string
          request_status: Database["public"]["Enums"]["provider_dispatch_status"]
          sent_at: string
          updated_at: string
        }
        Insert: {
          acknowledged_at?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          onboarding_submission_id?: string | null
          organization_id: string
          package_id?: string | null
          package_stream: string
          provider_id: string
          request_status?: Database["public"]["Enums"]["provider_dispatch_status"]
          sent_at?: string
          updated_at?: string
        }
        Update: {
          acknowledged_at?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          onboarding_submission_id?: string | null
          organization_id?: string
          package_id?: string | null
          package_stream?: string
          provider_id?: string
          request_status?: Database["public"]["Enums"]["provider_dispatch_status"]
          sent_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_provider_requests_onboarding_submission_id_fkey"
            columns: ["onboarding_submission_id"]
            isOneToOne: false
            referencedRelation: "customer_onboarding_submissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_provider_requests_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_provider_requests_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "service_packages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_provider_requests_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "service_partners"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_requirement_evidence: {
        Row: {
          created_at: string
          customer_note: string | null
          document_id: string | null
          file_name: string | null
          id: string
          mime_type: string | null
          requirement_item_id: string
          size_bytes: number | null
          storage_bucket: string | null
          storage_path: string | null
          submitted_by: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_note?: string | null
          document_id?: string | null
          file_name?: string | null
          id?: string
          mime_type?: string | null
          requirement_item_id: string
          size_bytes?: number | null
          storage_bucket?: string | null
          storage_path?: string | null
          submitted_by?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_note?: string | null
          document_id?: string | null
          file_name?: string | null
          id?: string
          mime_type?: string | null
          requirement_item_id?: string
          size_bytes?: number | null
          storage_bucket?: string | null
          storage_path?: string | null
          submitted_by?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_requirement_evidence_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_requirement_evidence_requirement_item_id_fkey"
            columns: ["requirement_item_id"]
            isOneToOne: false
            referencedRelation: "customer_requirement_items"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_requirement_items: {
        Row: {
          approved_at: string | null
          created_at: string
          description: string | null
          due_at: string | null
          evidence_type: string
          id: string
          is_required: boolean
          metadata: Json
          onboarding_submission_id: string | null
          organization_id: string
          package_id: string | null
          package_stream: string
          provider_id: string | null
          rejected_at: string | null
          sort_order: number
          status: Database["public"]["Enums"]["requirement_item_status"]
          status_reason: string | null
          submitted_at: string | null
          template_id: string
          title: string
          updated_at: string
          why_required: string | null
        }
        Insert: {
          approved_at?: string | null
          created_at?: string
          description?: string | null
          due_at?: string | null
          evidence_type?: string
          id?: string
          is_required?: boolean
          metadata?: Json
          onboarding_submission_id?: string | null
          organization_id: string
          package_id?: string | null
          package_stream: string
          provider_id?: string | null
          rejected_at?: string | null
          sort_order?: number
          status?: Database["public"]["Enums"]["requirement_item_status"]
          status_reason?: string | null
          submitted_at?: string | null
          template_id: string
          title: string
          updated_at?: string
          why_required?: string | null
        }
        Update: {
          approved_at?: string | null
          created_at?: string
          description?: string | null
          due_at?: string | null
          evidence_type?: string
          id?: string
          is_required?: boolean
          metadata?: Json
          onboarding_submission_id?: string | null
          organization_id?: string
          package_id?: string | null
          package_stream?: string
          provider_id?: string | null
          rejected_at?: string | null
          sort_order?: number
          status?: Database["public"]["Enums"]["requirement_item_status"]
          status_reason?: string | null
          submitted_at?: string | null
          template_id?: string
          title?: string
          updated_at?: string
          why_required?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_requirement_items_onboarding_submission_id_fkey"
            columns: ["onboarding_submission_id"]
            isOneToOne: false
            referencedRelation: "customer_onboarding_submissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_requirement_items_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_requirement_items_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "service_packages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_requirement_items_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "service_partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_requirement_items_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "requirement_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_sla_activations: {
        Row: {
          activated_at: string | null
          created_at: string
          id: string
          metadata: Json
          organization_id: string
          package_stream: string
          paused_at: string | null
          pending_reason: string | null
          provider_id: string
          provider_request_id: string
          status: Database["public"]["Enums"]["sla_activation_status"]
          updated_at: string
        }
        Insert: {
          activated_at?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          organization_id: string
          package_stream: string
          paused_at?: string | null
          pending_reason?: string | null
          provider_id: string
          provider_request_id: string
          status?: Database["public"]["Enums"]["sla_activation_status"]
          updated_at?: string
        }
        Update: {
          activated_at?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          organization_id?: string
          package_stream?: string
          paused_at?: string | null
          pending_reason?: string | null
          provider_id?: string
          provider_request_id?: string
          status?: Database["public"]["Enums"]["sla_activation_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_sla_activations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_sla_activations_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "service_partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_sla_activations_provider_request_id_fkey"
            columns: ["provider_request_id"]
            isOneToOne: true
            referencedRelation: "customer_provider_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          bucket: string
          created_at: string
          file_name: string
          id: string
          metadata: Json
          mime_type: string | null
          organization_id: string | null
          path: string
          request_id: string | null
          size_bytes: number | null
          updated_at: string
          uploaded_by: string
        }
        Insert: {
          bucket: string
          created_at?: string
          file_name: string
          id?: string
          metadata?: Json
          mime_type?: string | null
          organization_id?: string | null
          path: string
          request_id?: string | null
          size_bytes?: number | null
          updated_at?: string
          uploaded_by: string
        }
        Update: {
          bucket?: string
          created_at?: string
          file_name?: string
          id?: string
          metadata?: Json
          mime_type?: string | null
          organization_id?: string | null
          path?: string
          request_id?: string | null
          size_bytes?: number | null
          updated_at?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "documents_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "service_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      fulfillment_logs: {
        Row: {
          created_at: string
          id: string
          order_item_id: string
          received_by: string | null
          received_quantity: number
          source_id: string
          source_type: string
        }
        Insert: {
          created_at?: string
          id?: string
          order_item_id: string
          received_by?: string | null
          received_quantity: number
          source_id: string
          source_type: string
        }
        Update: {
          created_at?: string
          id?: string
          order_item_id?: string
          received_by?: string | null
          received_quantity?: number
          source_id?: string
          source_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "fulfillment_logs_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "sales_order_items"
            referencedColumns: ["id"]
          },
        ]
      }
      industry_taxonomy: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          metadata: Json
          primary_industry: string
          sort_order: number
          sub_industry: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          metadata?: Json
          primary_industry: string
          sort_order?: number
          sub_industry: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          metadata?: Json
          primary_industry?: string
          sort_order?: number
          sub_industry?: string
          updated_at?: string
        }
        Relationships: []
      }
      inventory_movements: {
        Row: {
          actor_id: string | null
          created_at: string
          id: string
          movement_type: string
          quantity: number
          reason: string | null
          sales_order_id: string | null
          sku: string
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          id?: string
          movement_type: string
          quantity: number
          reason?: string | null
          sales_order_id?: string | null
          sku: string
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          id?: string
          movement_type?: string
          quantity?: number
          reason?: string | null
          sales_order_id?: string | null
          sku?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_movements_sales_order_id_fkey"
            columns: ["sales_order_id"]
            isOneToOne: false
            referencedRelation: "sales_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      invitations: {
        Row: {
          accepted_at: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string | null
          membership_id: string | null
          metadata: Json
          organization_id: string | null
          revoked_at: string | null
          role: string
          status: Database["public"]["Enums"]["invitation_status"]
          token_hash: string
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          email: string
          expires_at: string
          id?: string
          invited_by?: string | null
          membership_id?: string | null
          metadata?: Json
          organization_id?: string | null
          revoked_at?: string | null
          role: string
          status?: Database["public"]["Enums"]["invitation_status"]
          token_hash: string
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          membership_id?: string | null
          metadata?: Json
          organization_id?: string | null
          revoked_at?: string | null
          role?: string
          status?: Database["public"]["Enums"]["invitation_status"]
          token_hash?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invitations_membership_id_fkey"
            columns: ["membership_id"]
            isOneToOne: false
            referencedRelation: "organization_memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_line_items: {
        Row: {
          created_at: string
          description: string
          id: string
          invoice_id: string
          line_total_cents: number
          metadata: Json
          package_id: string | null
          quantity: number
          unit_amount_cents: number
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          invoice_id: string
          line_total_cents?: number
          metadata?: Json
          package_id?: string | null
          quantity?: number
          unit_amount_cents?: number
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          invoice_id?: string
          line_total_cents?: number
          metadata?: Json
          package_id?: string | null
          quantity?: number
          unit_amount_cents?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoice_line_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_line_items_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "service_packages"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          billing_reason: string
          created_at: string
          currency_code: string
          due_at: string | null
          hosted_invoice_url: string | null
          id: string
          invoice_number: string
          issued_at: string | null
          metadata: Json
          onboarding_submission_id: string | null
          organization_id: string
          paid_at: string | null
          pdf_url: string | null
          status: Database["public"]["Enums"]["invoice_status"]
          subscription_id: string | null
          subtotal_cents: number
          tax_cents: number
          total_cents: number
          updated_at: string
        }
        Insert: {
          billing_reason?: string
          created_at?: string
          currency_code?: string
          due_at?: string | null
          hosted_invoice_url?: string | null
          id?: string
          invoice_number: string
          issued_at?: string | null
          metadata?: Json
          onboarding_submission_id?: string | null
          organization_id: string
          paid_at?: string | null
          pdf_url?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          subscription_id?: string | null
          subtotal_cents?: number
          tax_cents?: number
          total_cents?: number
          updated_at?: string
        }
        Update: {
          billing_reason?: string
          created_at?: string
          currency_code?: string
          due_at?: string | null
          hosted_invoice_url?: string | null
          id?: string
          invoice_number?: string
          issued_at?: string | null
          metadata?: Json
          onboarding_submission_id?: string | null
          organization_id?: string
          paid_at?: string | null
          pdf_url?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          subscription_id?: string | null
          subtotal_cents?: number
          tax_cents?: number
          total_cents?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_onboarding_submission_id_fkey"
            columns: ["onboarding_submission_id"]
            isOneToOne: false
            referencedRelation: "customer_onboarding_submissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          message: string
          metadata: Json
          organization_id: string | null
          read_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          metadata?: Json
          organization_id?: string | null
          read_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          metadata?: Json
          organization_id?: string | null
          read_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_anomaly_alerts: {
        Row: {
          anomaly_type: string
          created_at: string
          id: string
          onboarding_submission_id: string
          organization_id: string
          profile_id: string
          reason: string
          reviewed_at: string | null
          reviewed_by: string | null
          severity: string
          status: string
        }
        Insert: {
          anomaly_type: string
          created_at?: string
          id?: string
          onboarding_submission_id: string
          organization_id: string
          profile_id: string
          reason: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          severity: string
          status?: string
        }
        Update: {
          anomaly_type?: string
          created_at?: string
          id?: string
          onboarding_submission_id?: string
          organization_id?: string
          profile_id?: string
          reason?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          severity?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_anomaly_alerts_onboarding_submission_id_fkey"
            columns: ["onboarding_submission_id"]
            isOneToOne: false
            referencedRelation: "customer_onboarding_submissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "onboarding_anomaly_alerts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "onboarding_anomaly_alerts_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "customer_intelligence_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      order_workflow_step_events: {
        Row: {
          actor_id: string | null
          actor_type: string
          created_at: string
          id: string
          metadata: Json
          order_id: string
          proof_type: string | null
          proof_url: string | null
          source: string
          step_key: string
          step_owner: string
        }
        Insert: {
          actor_id?: string | null
          actor_type: string
          created_at?: string
          id?: string
          metadata?: Json
          order_id: string
          proof_type?: string | null
          proof_url?: string | null
          source: string
          step_key: string
          step_owner: string
        }
        Update: {
          actor_id?: string | null
          actor_type?: string
          created_at?: string
          id?: string
          metadata?: Json
          order_id?: string
          proof_type?: string | null
          proof_url?: string | null
          source?: string
          step_key?: string
          step_owner?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_workflow_step_events_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "sales_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_workflow_step_inputs: {
        Row: {
          actor_notes: string | null
          created_at: string
          id: string
          input_data: Json
          order_id: string
          step_key: string
          updated_at: string
        }
        Insert: {
          actor_notes?: string | null
          created_at?: string
          id?: string
          input_data?: Json
          order_id: string
          step_key: string
          updated_at?: string
        }
        Update: {
          actor_notes?: string | null
          created_at?: string
          id?: string
          input_data?: Json
          order_id?: string
          step_key?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_workflow_step_inputs_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "sales_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_memberships: {
        Row: {
          accepted_at: string | null
          created_at: string
          email: string
          id: string
          invited_at: string | null
          invited_by: string | null
          is_primary: boolean
          metadata: Json
          organization_id: string
          role: string
          status: Database["public"]["Enums"]["membership_status"]
          updated_at: string
          user_id: string | null
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          email: string
          id?: string
          invited_at?: string | null
          invited_by?: string | null
          is_primary?: boolean
          metadata?: Json
          organization_id: string
          role: string
          status?: Database["public"]["Enums"]["membership_status"]
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          email?: string
          id?: string
          invited_at?: string | null
          invited_by?: string | null
          is_primary?: boolean
          metadata?: Json
          organization_id?: string
          role?: string
          status?: Database["public"]["Enums"]["membership_status"]
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "organization_memberships_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          id: string
          kind: Database["public"]["Enums"]["organization_kind"]
          metadata: Json
          name: string
          primary_contact_email: string | null
          primary_contact_name: string | null
          slug: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind: Database["public"]["Enums"]["organization_kind"]
          metadata?: Json
          name: string
          primary_contact_email?: string | null
          primary_contact_name?: string | null
          slug?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["organization_kind"]
          metadata?: Json
          name?: string
          primary_contact_email?: string | null
          primary_contact_name?: string | null
          slug?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      outbound_emails: {
        Row: {
          created_at: string
          delivered_at: string | null
          error_message: string | null
          id: string
          invitation_id: string | null
          invoice_id: string | null
          organization_id: string | null
          payload: Json
          provider: string
          provider_message_id: string | null
          queued_at: string
          sent_at: string | null
          status: Database["public"]["Enums"]["email_delivery_status"]
          subject: string
          template_key: string
          to_email: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          delivered_at?: string | null
          error_message?: string | null
          id?: string
          invitation_id?: string | null
          invoice_id?: string | null
          organization_id?: string | null
          payload?: Json
          provider?: string
          provider_message_id?: string | null
          queued_at?: string
          sent_at?: string | null
          status?: Database["public"]["Enums"]["email_delivery_status"]
          subject: string
          template_key: string
          to_email: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          delivered_at?: string | null
          error_message?: string | null
          id?: string
          invitation_id?: string | null
          invoice_id?: string | null
          organization_id?: string | null
          payload?: Json
          provider?: string
          provider_message_id?: string | null
          queued_at?: string
          sent_at?: string | null
          status?: Database["public"]["Enums"]["email_delivery_status"]
          subject?: string
          template_key?: string
          to_email?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "outbound_emails_invitation_id_fkey"
            columns: ["invitation_id"]
            isOneToOne: false
            referencedRelation: "invitations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outbound_emails_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outbound_emails_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      package_services: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          package_id: string
          service_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          package_id: string
          service_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          package_id?: string
          service_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "package_services_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "service_packages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "package_services_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      pick_tickets: {
        Row: {
          assigned_to: string | null
          bin_location: string
          completed_at: string | null
          created_at: string
          id: string
          order_item_id: string
          picked_by: string | null
          picked_quantity: number
          status: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          bin_location: string
          completed_at?: string | null
          created_at?: string
          id?: string
          order_item_id: string
          picked_by?: string | null
          picked_quantity?: number
          status?: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          bin_location?: string
          completed_at?: string | null
          created_at?: string
          id?: string
          order_item_id?: string
          picked_by?: string | null
          picked_quantity?: number
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pick_tickets_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "sales_order_items"
            referencedColumns: ["id"]
          },
        ]
      }
      provider_workflow_handoffs: {
        Row: {
          accepted_at: string | null
          assigned_at: string
          completed_at: string | null
          created_at: string
          from_provider_id: string
          handoff_type: string
          id: string
          metadata: Json
          notes: string | null
          order_item_id: string
          organization_id: string
          package_stream: string
          required_documents: Json
          sales_order_id: string
          source_handoff_id: string | null
          status: string
          to_provider_id: string
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          assigned_at?: string
          completed_at?: string | null
          created_at?: string
          from_provider_id: string
          handoff_type?: string
          id?: string
          metadata?: Json
          notes?: string | null
          order_item_id: string
          organization_id: string
          package_stream: string
          required_documents?: Json
          sales_order_id: string
          source_handoff_id?: string | null
          status?: string
          to_provider_id: string
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          assigned_at?: string
          completed_at?: string | null
          created_at?: string
          from_provider_id?: string
          handoff_type?: string
          id?: string
          metadata?: Json
          notes?: string | null
          order_item_id?: string
          organization_id?: string
          package_stream?: string
          required_documents?: Json
          sales_order_id?: string
          source_handoff_id?: string | null
          status?: string
          to_provider_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "provider_workflow_handoffs_from_provider_id_fkey"
            columns: ["from_provider_id"]
            isOneToOne: false
            referencedRelation: "service_partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "provider_workflow_handoffs_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "sales_order_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "provider_workflow_handoffs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "provider_workflow_handoffs_sales_order_id_fkey"
            columns: ["sales_order_id"]
            isOneToOne: false
            referencedRelation: "sales_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "provider_workflow_handoffs_source_handoff_id_fkey"
            columns: ["source_handoff_id"]
            isOneToOne: false
            referencedRelation: "sales_partner_handoffs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "provider_workflow_handoffs_to_provider_id_fkey"
            columns: ["to_provider_id"]
            isOneToOne: false
            referencedRelation: "service_partners"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_order_items: {
        Row: {
          completed_at: string | null
          created_at: string
          id: string
          order_item_id: string
          ordered_quantity: number
          purchase_order_id: string | null
          status: string
          supplier_name: string
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          id?: string
          order_item_id: string
          ordered_quantity: number
          purchase_order_id?: string | null
          status?: string
          supplier_name: string
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          id?: string
          order_item_id?: string
          ordered_quantity?: number
          purchase_order_id?: string | null
          status?: string
          supplier_name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_order_items_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "sales_order_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_items_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_orders: {
        Row: {
          created_at: string
          customer_document_id: string | null
          id: string
          metadata: Json
          organization_id: string
          po_number: string | null
          provider_id: string | null
          sales_order_id: string
          status: string
          submitted_by: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_document_id?: string | null
          id?: string
          metadata?: Json
          organization_id: string
          po_number?: string | null
          provider_id?: string | null
          sales_order_id: string
          status?: string
          submitted_by?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_document_id?: string | null
          id?: string
          metadata?: Json
          organization_id?: string
          po_number?: string | null
          provider_id?: string | null
          sales_order_id?: string
          status?: string
          submitted_by?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_orders_customer_document_id_fkey"
            columns: ["customer_document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "service_partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_sales_order_id_fkey"
            columns: ["sales_order_id"]
            isOneToOne: true
            referencedRelation: "sales_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      request_messages: {
        Row: {
          body: string
          created_at: string
          id: string
          read_at: string | null
          request_id: string
          sender_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          read_at?: string | null
          request_id: string
          sender_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          read_at?: string | null
          request_id?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "request_messages_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "service_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      requirement_templates: {
        Row: {
          applies_when: Json
          created_at: string
          description: string | null
          evidence_type: string
          id: string
          is_active: boolean
          is_required: boolean
          metadata: Json
          package_stream: string
          provider_id: string | null
          requirement_key: string
          sort_order: number
          title: string
          updated_at: string
          why_required: string | null
        }
        Insert: {
          applies_when?: Json
          created_at?: string
          description?: string | null
          evidence_type?: string
          id?: string
          is_active?: boolean
          is_required?: boolean
          metadata?: Json
          package_stream: string
          provider_id?: string | null
          requirement_key: string
          sort_order?: number
          title: string
          updated_at?: string
          why_required?: string | null
        }
        Update: {
          applies_when?: Json
          created_at?: string
          description?: string | null
          evidence_type?: string
          id?: string
          is_active?: boolean
          is_required?: boolean
          metadata?: Json
          package_stream?: string
          provider_id?: string | null
          requirement_key?: string
          sort_order?: number
          title?: string
          updated_at?: string
          why_required?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "requirement_templates_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "service_partners"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_order_items: {
        Row: {
          created_at: string
          fulfillment_route: string
          id: string
          order_id: string
          product_name: string
          quantity: number
          sku: string
          unit_price_cents: number
        }
        Insert: {
          created_at?: string
          fulfillment_route: string
          id?: string
          order_id: string
          product_name: string
          quantity: number
          sku: string
          unit_price_cents: number
        }
        Update: {
          created_at?: string
          fulfillment_route?: string
          id?: string
          order_id?: string
          product_name?: string
          quantity?: number
          sku?: string
          unit_price_cents?: number
        }
        Relationships: [
          {
            foreignKeyName: "sales_order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "sales_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_orders: {
        Row: {
          created_at: string
          currency_code: string
          id: string
          metadata: Json
          organization_id: string
          po_reference: string | null
          status: string
          total_cents: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          currency_code?: string
          id?: string
          metadata?: Json
          organization_id: string
          po_reference?: string | null
          status?: string
          total_cents?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          currency_code?: string
          id?: string
          metadata?: Json
          organization_id?: string
          po_reference?: string | null
          status?: string
          total_cents?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_orders_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_partner_handoffs: {
        Row: {
          accepted_at: string | null
          assigned_at: string
          completed_at: string | null
          created_at: string
          id: string
          metadata: Json
          order_item_id: string
          organization_id: string
          package_stream: string
          partner_notes: string | null
          provider_id: string
          sales_order_id: string
          status: string
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          assigned_at?: string
          completed_at?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          order_item_id: string
          organization_id: string
          package_stream: string
          partner_notes?: string | null
          provider_id: string
          sales_order_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          assigned_at?: string
          completed_at?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          order_item_id?: string
          organization_id?: string
          package_stream?: string
          partner_notes?: string | null
          provider_id?: string
          sales_order_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_partner_handoffs_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: true
            referencedRelation: "sales_order_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_partner_handoffs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_partner_handoffs_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "service_partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_partner_handoffs_sales_order_id_fkey"
            columns: ["sales_order_id"]
            isOneToOne: false
            referencedRelation: "sales_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      service_packages: {
        Row: {
          billing_interval: Database["public"]["Enums"]["billing_interval"]
          code: string
          created_at: string
          currency_code: string
          description: string | null
          id: string
          is_active: boolean
          metadata: Json
          name: string
          unit_amount_cents: number
          updated_at: string
        }
        Insert: {
          billing_interval: Database["public"]["Enums"]["billing_interval"]
          code: string
          created_at?: string
          currency_code?: string
          description?: string | null
          id?: string
          is_active?: boolean
          metadata?: Json
          name: string
          unit_amount_cents: number
          updated_at?: string
        }
        Update: {
          billing_interval?: Database["public"]["Enums"]["billing_interval"]
          code?: string
          created_at?: string
          currency_code?: string
          description?: string | null
          id?: string
          is_active?: boolean
          metadata?: Json
          name?: string
          unit_amount_cents?: number
          updated_at?: string
        }
        Relationships: []
      }
      service_partners: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          metadata: Json
          name: string
          package_stream: string
          site: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          metadata?: Json
          name: string
          package_stream: string
          site: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          metadata?: Json
          name?: string
          package_stream?: string
          site?: string
          updated_at?: string
        }
        Relationships: []
      }
      service_requests: {
        Row: {
          created_at: string
          customer_id: string
          description: string | null
          id: string
          metadata: Json
          organization_id: string | null
          partner_id: string | null
          priority: string
          provider_request_id: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          description?: string | null
          id?: string
          metadata?: Json
          organization_id?: string | null
          partner_id?: string | null
          priority?: string
          provider_request_id?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          description?: string | null
          id?: string
          metadata?: Json
          organization_id?: string | null
          partner_id?: string | null
          priority?: string
          provider_request_id?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_requests_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_requests_provider_request_id_fkey"
            columns: ["provider_request_id"]
            isOneToOne: false
            referencedRelation: "customer_provider_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      services: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          key: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          key: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          key?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          billing_interval: Database["public"]["Enums"]["billing_interval"]
          cancel_at_period_end: boolean
          cancelled_at: string | null
          created_at: string
          currency_code: string
          current_period_end: string | null
          current_period_start: string | null
          id: string
          metadata: Json
          onboarding_submission_id: string | null
          organization_id: string
          package_id: string
          quantity: number
          status: Database["public"]["Enums"]["subscription_status"]
          unit_amount_cents: number
          updated_at: string
        }
        Insert: {
          billing_interval: Database["public"]["Enums"]["billing_interval"]
          cancel_at_period_end?: boolean
          cancelled_at?: string | null
          created_at?: string
          currency_code?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          metadata?: Json
          onboarding_submission_id?: string | null
          organization_id: string
          package_id: string
          quantity?: number
          status?: Database["public"]["Enums"]["subscription_status"]
          unit_amount_cents: number
          updated_at?: string
        }
        Update: {
          billing_interval?: Database["public"]["Enums"]["billing_interval"]
          cancel_at_period_end?: boolean
          cancelled_at?: string | null
          created_at?: string
          currency_code?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          metadata?: Json
          onboarding_submission_id?: string | null
          organization_id?: string
          package_id?: string
          quantity?: number
          status?: Database["public"]["Enums"]["subscription_status"]
          unit_amount_cents?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_onboarding_submission_id_fkey"
            columns: ["onboarding_submission_id"]
            isOneToOne: false
            referencedRelation: "customer_onboarding_submissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "service_packages"
            referencedColumns: ["id"]
          },
        ]
      }
      user_profiles: {
        Row: {
          activated_at: string | null
          created_at: string
          email: string
          full_name: string | null
          invited_at: string | null
          last_login_at: string | null
          membership_status: Database["public"]["Enums"]["membership_status"]
          metadata: Json
          organization_id: string | null
          role: string
          updated_at: string
          user_id: string
        }
        Insert: {
          activated_at?: string | null
          created_at?: string
          email: string
          full_name?: string | null
          invited_at?: string | null
          last_login_at?: string | null
          membership_status?: Database["public"]["Enums"]["membership_status"]
          metadata?: Json
          organization_id?: string | null
          role: string
          updated_at?: string
          user_id: string
        }
        Update: {
          activated_at?: string | null
          created_at?: string
          email?: string
          full_name?: string | null
          invited_at?: string | null
          last_login_at?: string | null
          membership_status?: Database["public"]["Enums"]["membership_status"]
          metadata?: Json
          organization_id?: string | null
          role?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_profiles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      work_orders: {
        Row: {
          assigned_to: string | null
          completed_at: string | null
          created_at: string
          id: string
          order_item_id: string
          quantity_to_build: number
          status: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          completed_at?: string | null
          created_at?: string
          id?: string
          order_item_id: string
          quantity_to_build: number
          status?: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          completed_at?: string | null
          created_at?: string
          id?: string
          order_item_id?: string
          quantity_to_build?: number
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_orders_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "sales_order_items"
            referencedColumns: ["id"]
          },
        ]
      }
      work_request_item_dependencies: {
        Row: {
          created_at: string
          depends_on_item_id: string
          id: string
          work_request_item_id: string
        }
        Insert: {
          created_at?: string
          depends_on_item_id: string
          id?: string
          work_request_item_id: string
        }
        Update: {
          created_at?: string
          depends_on_item_id?: string
          id?: string
          work_request_item_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_request_item_dependencies_depends_on_item_id_fkey"
            columns: ["depends_on_item_id"]
            isOneToOne: false
            referencedRelation: "work_request_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_request_item_dependencies_work_request_item_id_fkey"
            columns: ["work_request_item_id"]
            isOneToOne: false
            referencedRelation: "work_request_items"
            referencedColumns: ["id"]
          },
        ]
      }
      work_request_items: {
        Row: {
          assigned_provider_id: string | null
          auto_included: boolean
          catalog_item_id: string
          completed_at: string | null
          created_at: string
          id: string
          released_at: string | null
          service_id: string
          status: string
          updated_at: string
          work_request_id: string
        }
        Insert: {
          assigned_provider_id?: string | null
          auto_included?: boolean
          catalog_item_id: string
          completed_at?: string | null
          created_at?: string
          id?: string
          released_at?: string | null
          service_id: string
          status?: string
          updated_at?: string
          work_request_id: string
        }
        Update: {
          assigned_provider_id?: string | null
          auto_included?: boolean
          catalog_item_id?: string
          completed_at?: string | null
          created_at?: string
          id?: string
          released_at?: string | null
          service_id?: string
          status?: string
          updated_at?: string
          work_request_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_request_items_catalog_item_id_fkey"
            columns: ["catalog_item_id"]
            isOneToOne: false
            referencedRelation: "catalog_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_request_items_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_request_items_work_request_id_fkey"
            columns: ["work_request_id"]
            isOneToOne: false
            referencedRelation: "work_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      work_requests: {
        Row: {
          created_at: string
          customer_id: string
          id: string
          metadata: Json
          organization_id: string | null
          package_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          id?: string
          metadata?: Json
          organization_id?: string | null
          package_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          id?: string
          metadata?: Json
          organization_id?: string | null
          package_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_requests_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_requests_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "service_packages"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_events_queue: {
        Row: {
          created_at: string
          error_message: string | null
          event_type: string
          id: string
          max_retries: number
          next_retry_at: string | null
          payload: Json
          processed_at: string | null
          retry_count: number
          scheduled_at: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          event_type: string
          id?: string
          max_retries?: number
          next_retry_at?: string | null
          payload?: Json
          processed_at?: string | null
          retry_count?: number
          scheduled_at?: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          event_type?: string
          id?: string
          max_retries?: number
          next_retry_at?: string | null
          payload?: Json
          processed_at?: string | null
          retry_count?: number
          scheduled_at?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      refresh_customer_sla_activation: {
        Args: { p_organization_id: string }
        Returns: number
      }
      reserve_inventory_for_order: {
        Args: {
          p_actor_id?: string
          p_order_id: string
          p_quantity: number
          p_sku: string
        }
        Returns: undefined
      }
      submit_customer_requirement_evidence: {
        Args: {
          p_customer_note?: string
          p_document_id: string
          p_file_name: string
          p_mime_type?: string
          p_requirement_item_id: string
          p_size_bytes?: number
          p_storage_bucket: string
          p_storage_path: string
        }
        Returns: string
      }
      sync_customer_provider_requests: {
        Args: { p_customer_user_id: string; p_organization_id: string }
        Returns: number
      }
      sync_customer_requirements: {
        Args: { p_organization_id: string }
        Returns: number
      }
    }
    Enums: {
      billing_interval: "monthly" | "quarterly" | "annual" | "one_time"
      business_model_type:
        | "seller"
        | "reseller"
        | "distributor"
        | "manufacturer"
        | "marketplace"
        | "service_provider"
      customer_segment_type: "b2b" | "b2c" | "hybrid"
      decision_source_type: "rule" | "ai" | "hybrid" | "manual"
      email_delivery_status: "queued" | "sent" | "delivered" | "failed"
      fulfillment_model_type: "in_house" | "third_party" | "hybrid"
      inventory_model_type: "own_stock" | "dropship" | "hybrid" | "none"
      invitation_status: "pending" | "accepted" | "expired" | "revoked"
      invoice_status: "draft" | "issued" | "paid" | "void" | "overdue"
      membership_status: "invited" | "active" | "suspended"
      organization_kind: "customer" | "partner" | "admin"
      priority_tier_type: "standard" | "high" | "critical" | "strategic"
      project_health: "GREEN" | "AMBER" | "RED"
      project_status:
        | "PLANNING"
        | "ACTIVE"
        | "ON_HOLD"
        | "COMPLETE"
        | "ARCHIVED"
      provider_dispatch_status: "sent" | "acknowledged" | "failed"
      requirement_item_status: "missing" | "submitted" | "approved" | "rejected"
      role: "USER" | "CLIENT" | "SUPER_ADMIN"
      sla_activation_status: "pending_requirements" | "active" | "paused"
      subscription_status:
        | "draft"
        | "trialing"
        | "active"
        | "past_due"
        | "cancelled"
        | "expired"
      ticket_priority: "NONE" | "LOW" | "MEDIUM" | "HIGH" | "URGENT"
      ticket_status:
        | "BACKLOG"
        | "TODO"
        | "REFINE"
        | "IN_PROGRESS"
        | "REVISIONS"
        | "CLIENT_REVIEW"
        | "COMPLETE"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      billing_interval: ["monthly", "quarterly", "annual", "one_time"],
      business_model_type: [
        "seller",
        "reseller",
        "distributor",
        "manufacturer",
        "marketplace",
        "service_provider",
      ],
      customer_segment_type: ["b2b", "b2c", "hybrid"],
      decision_source_type: ["rule", "ai", "hybrid", "manual"],
      email_delivery_status: ["queued", "sent", "delivered", "failed"],
      fulfillment_model_type: ["in_house", "third_party", "hybrid"],
      inventory_model_type: ["own_stock", "dropship", "hybrid", "none"],
      invitation_status: ["pending", "accepted", "expired", "revoked"],
      invoice_status: ["draft", "issued", "paid", "void", "overdue"],
      membership_status: ["invited", "active", "suspended"],
      organization_kind: ["customer", "partner", "admin"],
      priority_tier_type: ["standard", "high", "critical", "strategic"],
      project_health: ["GREEN", "AMBER", "RED"],
      project_status: ["PLANNING", "ACTIVE", "ON_HOLD", "COMPLETE", "ARCHIVED"],
      provider_dispatch_status: ["sent", "acknowledged", "failed"],
      requirement_item_status: ["missing", "submitted", "approved", "rejected"],
      role: ["USER", "CLIENT", "SUPER_ADMIN"],
      sla_activation_status: ["pending_requirements", "active", "paused"],
      subscription_status: [
        "draft",
        "trialing",
        "active",
        "past_due",
        "cancelled",
        "expired",
      ],
      ticket_priority: ["NONE", "LOW", "MEDIUM", "HIGH", "URGENT"],
      ticket_status: [
        "BACKLOG",
        "TODO",
        "REFINE",
        "IN_PROGRESS",
        "REVISIONS",
        "CLIENT_REVIEW",
        "COMPLETE",
      ],
    },
  },
} as const
