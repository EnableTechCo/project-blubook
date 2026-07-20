


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE TYPE "public"."billing_interval" AS ENUM (
    'monthly',
    'quarterly',
    'annual',
    'one_time'
);


ALTER TYPE "public"."billing_interval" OWNER TO "postgres";


CREATE TYPE "public"."business_model_type" AS ENUM (
    'seller',
    'reseller',
    'distributor',
    'manufacturer',
    'marketplace',
    'service_provider'
);


ALTER TYPE "public"."business_model_type" OWNER TO "postgres";


CREATE TYPE "public"."customer_segment_type" AS ENUM (
    'b2b',
    'b2c',
    'hybrid'
);


ALTER TYPE "public"."customer_segment_type" OWNER TO "postgres";


CREATE TYPE "public"."decision_source_type" AS ENUM (
    'rule',
    'ai',
    'hybrid',
    'manual'
);


ALTER TYPE "public"."decision_source_type" OWNER TO "postgres";


CREATE TYPE "public"."email_delivery_status" AS ENUM (
    'queued',
    'sent',
    'delivered',
    'failed'
);


ALTER TYPE "public"."email_delivery_status" OWNER TO "postgres";


CREATE TYPE "public"."fulfillment_model_type" AS ENUM (
    'in_house',
    'third_party',
    'hybrid'
);


ALTER TYPE "public"."fulfillment_model_type" OWNER TO "postgres";


CREATE TYPE "public"."inventory_model_type" AS ENUM (
    'own_stock',
    'dropship',
    'hybrid',
    'none'
);


ALTER TYPE "public"."inventory_model_type" OWNER TO "postgres";


CREATE TYPE "public"."invitation_status" AS ENUM (
    'pending',
    'accepted',
    'expired',
    'revoked'
);


ALTER TYPE "public"."invitation_status" OWNER TO "postgres";


CREATE TYPE "public"."invoice_status" AS ENUM (
    'draft',
    'issued',
    'paid',
    'void',
    'overdue'
);


ALTER TYPE "public"."invoice_status" OWNER TO "postgres";


CREATE TYPE "public"."membership_status" AS ENUM (
    'invited',
    'active',
    'suspended'
);


ALTER TYPE "public"."membership_status" OWNER TO "postgres";


CREATE TYPE "public"."organization_kind" AS ENUM (
    'customer',
    'partner',
    'admin'
);


ALTER TYPE "public"."organization_kind" OWNER TO "postgres";


CREATE TYPE "public"."priority_tier_type" AS ENUM (
    'standard',
    'high',
    'critical',
    'strategic'
);


ALTER TYPE "public"."priority_tier_type" OWNER TO "postgres";


CREATE TYPE "public"."project_health" AS ENUM (
    'GREEN',
    'AMBER',
    'RED'
);


ALTER TYPE "public"."project_health" OWNER TO "postgres";


CREATE TYPE "public"."project_status" AS ENUM (
    'PLANNING',
    'ACTIVE',
    'ON_HOLD',
    'COMPLETE',
    'ARCHIVED'
);


ALTER TYPE "public"."project_status" OWNER TO "postgres";


CREATE TYPE "public"."provider_dispatch_status" AS ENUM (
    'sent',
    'acknowledged',
    'failed'
);


ALTER TYPE "public"."provider_dispatch_status" OWNER TO "postgres";


CREATE TYPE "public"."requirement_item_status" AS ENUM (
    'missing',
    'submitted',
    'approved',
    'rejected'
);


ALTER TYPE "public"."requirement_item_status" OWNER TO "postgres";


CREATE TYPE "public"."role" AS ENUM (
    'USER',
    'CLIENT',
    'SUPER_ADMIN'
);


ALTER TYPE "public"."role" OWNER TO "postgres";


CREATE TYPE "public"."sla_activation_status" AS ENUM (
    'pending_requirements',
    'active',
    'paused'
);


ALTER TYPE "public"."sla_activation_status" OWNER TO "postgres";


CREATE TYPE "public"."subscription_status" AS ENUM (
    'draft',
    'trialing',
    'active',
    'past_due',
    'cancelled',
    'expired'
);


ALTER TYPE "public"."subscription_status" OWNER TO "postgres";


CREATE TYPE "public"."ticket_priority" AS ENUM (
    'NONE',
    'LOW',
    'MEDIUM',
    'HIGH',
    'URGENT'
);


ALTER TYPE "public"."ticket_priority" OWNER TO "postgres";


CREATE TYPE "public"."ticket_status" AS ENUM (
    'BACKLOG',
    'TODO',
    'REFINE',
    'IN_PROGRESS',
    'REVISIONS',
    'CLIENT_REVIEW',
    'COMPLETE'
);


ALTER TYPE "public"."ticket_status" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."refresh_customer_sla_activation"("p_organization_id" "uuid") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_required_count integer;
  v_submitted_count integer;
  v_updated integer;
begin
  select count(*)
  into v_required_count
  from public.customer_requirement_items cri
  where cri.organization_id = p_organization_id
    and cri.is_required = true;

  select count(*)
  into v_submitted_count
  from public.customer_requirement_items cri
  where cri.organization_id = p_organization_id
    and cri.is_required = true
    and cri.status in ('submitted', 'approved');

  if v_required_count > 0 and v_required_count = v_submitted_count then
    update public.customer_sla_activations
    set status = 'active',
        pending_reason = null,
        activated_at = coalesce(activated_at, timezone('utc', now())),
        paused_at = null,
        updated_at = timezone('utc', now())
    where organization_id = p_organization_id
      and status <> 'active';
  else
    update public.customer_sla_activations
    set status = 'pending_requirements',
        pending_reason = 'Waiting for all required customer requirement submissions.',
        paused_at = null,
        updated_at = timezone('utc', now())
    where organization_id = p_organization_id
      and status <> 'pending_requirements';
  end if;

  get diagnostics v_updated = row_count;
  return coalesce(v_updated, 0);
end;
$$;


ALTER FUNCTION "public"."refresh_customer_sla_activation"("p_organization_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."reserve_inventory_for_order"("p_sku" "text", "p_quantity" integer, "p_order_id" "uuid", "p_actor_id" "uuid" DEFAULT NULL::"uuid") RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_available INTEGER;
BEGIN
  -- Lock all rows for this SKU first to block concurrent reservations,
  -- then aggregate in a separate pass.
  PERFORM 1 FROM public.inventory_movements WHERE sku = p_sku FOR UPDATE;
  SELECT COALESCE(SUM(quantity), 0) INTO v_available
  FROM   public.inventory_movements
  WHERE  sku = p_sku;

  IF v_available < p_quantity THEN
    RAISE EXCEPTION
      'Insufficient stock for SKU "%": % unit(s) available, % requested.',
      p_sku, v_available, p_quantity;
  END IF;

  INSERT INTO public.inventory_movements
    (sku, quantity, movement_type, sales_order_id, actor_id, reason)
  VALUES
    (p_sku, -p_quantity, 'reservation', p_order_id, p_actor_id,
     'Order inventory reservation');
END;
$$;


ALTER FUNCTION "public"."reserve_inventory_for_order"("p_sku" "text", "p_quantity" integer, "p_order_id" "uuid", "p_actor_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."submit_customer_requirement_evidence"("p_requirement_item_id" "uuid", "p_document_id" "uuid", "p_storage_bucket" "text", "p_storage_path" "text", "p_file_name" "text", "p_mime_type" "text" DEFAULT NULL::"text", "p_size_bytes" bigint DEFAULT NULL::bigint, "p_customer_note" "text" DEFAULT NULL::"text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_user_id uuid;
  v_organization_id uuid;
  v_provider_id uuid;
  v_requirement_title text;
  v_evidence_id uuid;
begin
  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception 'Unauthorized';
  end if;

  select cri.organization_id, cri.provider_id, cri.title
  into v_organization_id, v_provider_id, v_requirement_title
  from public.customer_requirement_items cri
  where cri.id = p_requirement_item_id;

  if v_organization_id is null then
    raise exception 'Requirement item not found';
  end if;

  if not exists (
    select 1
    from public.user_profiles up
    where up.user_id = v_user_id
      and up.organization_id = v_organization_id
  ) then
    raise exception 'Forbidden';
  end if;

  insert into public.customer_requirement_evidence (
    requirement_item_id,
    document_id,
    storage_bucket,
    storage_path,
    file_name,
    mime_type,
    size_bytes,
    submitted_by,
    customer_note
  )
  values (
    p_requirement_item_id,
    p_document_id,
    p_storage_bucket,
    p_storage_path,
    p_file_name,
    p_mime_type,
    p_size_bytes,
    v_user_id,
    p_customer_note
  )
  returning id into v_evidence_id;

  update public.customer_requirement_items
  set status = 'submitted',
      status_reason = null,
      submitted_at = timezone('utc', now()),
      rejected_at = null,
      updated_at = timezone('utc', now())
  where id = p_requirement_item_id;

  perform public.refresh_customer_sla_activation(v_organization_id);

  insert into public.notifications (
    user_id,
    organization_id,
    message,
    metadata
  )
  select
    up.user_id,
    v_organization_id,
    concat(
      'Customer submitted evidence for ',
      coalesce(v_requirement_title, 'a requirement'),
      '.'
    ),
    jsonb_build_object(
      'source', 'customer_requirement_submission',
      'requirement_item_id', p_requirement_item_id,
      'provider_id', v_provider_id,
      'evidence_id', v_evidence_id
    )
  from public.user_profiles up
  where up.role = 'partner'
    and coalesce(up.metadata ->> 'service_partner_id', '') = coalesce(v_provider_id::text, '');

  return v_evidence_id;
end;
$$;


ALTER FUNCTION "public"."submit_customer_requirement_evidence"("p_requirement_item_id" "uuid", "p_document_id" "uuid", "p_storage_bucket" "text", "p_storage_path" "text", "p_file_name" "text", "p_mime_type" "text", "p_size_bytes" bigint, "p_customer_note" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_customer_provider_requests"("p_organization_id" "uuid", "p_customer_user_id" "uuid") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_onboarding_id uuid;
  v_package_id uuid;
  v_inserted integer;
begin
  select cos.id, cos.package_id
  into v_onboarding_id, v_package_id
  from public.customer_onboarding_submissions cos
  where cos.organization_id = p_organization_id
  order by cos.created_at desc
  limit 1;

  if v_onboarding_id is null or v_package_id is null then
    return 0;
  end if;

  with package_streams as (
    select jsonb_object_keys(sp.metadata -> 'streams') as package_stream
    from public.service_packages sp
    where sp.id = v_package_id
  ),
  provider_candidates as (
    select
      spp.id as provider_id,
      spp.package_stream,
      spp.name as provider_name
    from public.service_partners spp
    join package_streams ps
      on ps.package_stream = spp.package_stream
    where spp.is_active = true
  ),
  inserted_provider_requests as (
    insert into public.customer_provider_requests (
      organization_id,
      onboarding_submission_id,
      package_id,
      provider_id,
      package_stream,
      request_status,
      metadata
    )
    select
      p_organization_id,
      v_onboarding_id,
      v_package_id,
      pc.provider_id,
      pc.package_stream,
      'sent',
      jsonb_build_object('provider_name', pc.provider_name)
    from provider_candidates pc
    on conflict (organization_id, onboarding_submission_id, provider_id)
    do update set
      request_status = 'sent',
      sent_at = timezone('utc', now()),
      updated_at = timezone('utc', now()),
      metadata = excluded.metadata
    returning id, provider_id, package_stream, metadata
  ),
  inserted_service_requests as (
    insert into public.service_requests (
      organization_id,
      customer_id,
      title,
      description,
      status,
      priority,
      metadata,
      provider_request_id
    )
    select
      p_organization_id,
      p_customer_user_id,
      concat(
        'Provider onboarding request - ',
        ipr.package_stream,
        ' - ',
        coalesce(ipr.metadata ->> 'provider_name', 'Provider')
      ) as title,
      concat(
        'Auto-generated provider request for stream ',
        ipr.package_stream,
        ' and provider ',
        coalesce(ipr.metadata ->> 'provider_name', 'Provider'),
        '.'
      ) as description,
      'submitted',
      'medium',
      jsonb_build_object(
        'system_generated', true,
        'provider_request_id', ipr.id,
        'provider_id', ipr.provider_id,
        'package_stream', ipr.package_stream
      ),
      ipr.id
    from inserted_provider_requests ipr
    where not exists (
      select 1
      from public.service_requests sr
      where sr.provider_request_id = ipr.id
    )
    returning 1
  ),
  upserted_slas as (
    insert into public.customer_sla_activations (
      organization_id,
      provider_request_id,
      provider_id,
      package_stream,
      status,
      pending_reason
    )
    select
      p_organization_id,
      ipr.id,
      ipr.provider_id,
      ipr.package_stream,
      'pending_requirements',
      'Waiting for all required customer requirement submissions.'
    from inserted_provider_requests ipr
    on conflict (provider_request_id)
    do update set
      package_stream = excluded.package_stream,
      provider_id = excluded.provider_id,
      updated_at = timezone('utc', now())
    returning 1
  )
  select count(*) into v_inserted from inserted_provider_requests;

  return coalesce(v_inserted, 0);
end;
$$;


ALTER FUNCTION "public"."sync_customer_provider_requests"("p_organization_id" "uuid", "p_customer_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_customer_requirements"("p_organization_id" "uuid") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_onboarding_id uuid;
  v_package_id uuid;
  v_inserted integer;
begin
  select cos.id, cos.package_id
  into v_onboarding_id, v_package_id
  from public.customer_onboarding_submissions cos
  where cos.organization_id = p_organization_id
  order by cos.created_at desc
  limit 1;

  if v_onboarding_id is null or v_package_id is null then
    return 0;
  end if;

  with package_streams as (
    select jsonb_object_keys(sp.metadata -> 'streams') as package_stream
    from public.service_packages sp
    where sp.id = v_package_id
  ),
  applicable_templates as (
    select rt.*
    from public.requirement_templates rt
    join package_streams ps
      on ps.package_stream = rt.package_stream
    where rt.is_active = true
      and (
        rt.provider_id is null
        or exists (
          select 1
          from public.service_partners spp
          where spp.id = rt.provider_id
            and spp.is_active = true
        )
      )
  ),
  upserted as (
    insert into public.customer_requirement_items (
      organization_id,
      onboarding_submission_id,
      package_id,
      template_id,
      package_stream,
      provider_id,
      title,
      description,
      why_required,
      evidence_type,
      is_required,
      sort_order,
      metadata
    )
    select
      p_organization_id,
      v_onboarding_id,
      v_package_id,
      at.id,
      at.package_stream,
      at.provider_id,
      at.title,
      at.description,
      at.why_required,
      at.evidence_type,
      at.is_required,
      at.sort_order,
      jsonb_build_object('requirement_key', at.requirement_key)
    from applicable_templates at
    on conflict (
      organization_id,
      template_id,
      (coalesce(provider_id, '00000000-0000-0000-0000-000000000000'::uuid))
    )
    do update set
      title = excluded.title,
      description = excluded.description,
      why_required = excluded.why_required,
      evidence_type = excluded.evidence_type,
      is_required = excluded.is_required,
      sort_order = excluded.sort_order,
      updated_at = timezone('utc', now())
    returning 1
  )
  select count(*) into v_inserted from upserted;

  return coalesce(v_inserted, 0);
end;
$$;


ALTER FUNCTION "public"."sync_customer_requirements"("p_organization_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."touch_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;


ALTER FUNCTION "public"."touch_updated_at"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."activity_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "request_id" "uuid" NOT NULL,
    "organization_id" "uuid",
    "partner_id" "uuid",
    "actor_id" "uuid" NOT NULL,
    "actor_type" character varying(20) NOT NULL,
    "action_type" character varying(50) NOT NULL,
    "action_details" "jsonb" DEFAULT '{}'::"jsonb",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "activity_log_actor_type_check" CHECK ((("actor_type")::"text" = ANY ((ARRAY['partner'::character varying, 'customer'::character varying, 'system'::character varying, 'admin'::character varying])::"text"[])))
);


ALTER TABLE "public"."activity_log" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."anomaly_alerts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "area" "text" NOT NULL,
    "anomaly_type" "text" NOT NULL,
    "severity" "text" NOT NULL,
    "reason" "text" NOT NULL,
    "source_entity_type" "text",
    "source_entity_id" "uuid",
    "source_label" "text",
    "is_example" boolean DEFAULT false NOT NULL,
    "status" "text" DEFAULT 'pending_review'::"text" NOT NULL,
    "reviewed_by" "uuid",
    "reviewed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "anomaly_alerts_area_check" CHECK (("area" = ANY (ARRAY['orders'::"text", 'inventory'::"text", 'onboarding'::"text", 'workflow'::"text"]))),
    CONSTRAINT "anomaly_alerts_severity_check" CHECK (("severity" = ANY (ARRAY['low'::"text", 'medium'::"text", 'high'::"text"]))),
    CONSTRAINT "anomaly_alerts_status_check" CHECK (("status" = ANY (ARRAY['pending_review'::"text", 'reviewed'::"text", 'dismissed'::"text"])))
);


ALTER TABLE "public"."anomaly_alerts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."automation_decisions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "request_id" "uuid",
    "profile_id" "uuid",
    "rule_id" "uuid",
    "source" "public"."decision_source_type" NOT NULL,
    "recommended_priority" "public"."priority_tier_type",
    "recommended_stream" "text",
    "recommended_owner_id" "uuid",
    "recommendation_json" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "explanation" "text",
    "confidence_score" numeric(5,2),
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "decided_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    CONSTRAINT "automation_decisions_confidence_score_check" CHECK ((("confidence_score" IS NULL) OR (("confidence_score" >= (0)::numeric) AND ("confidence_score" <= (100)::numeric))))
);


ALTER TABLE "public"."automation_decisions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."automation_overrides" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "decision_id" "uuid" NOT NULL,
    "overridden_by" "uuid",
    "previous_priority" "public"."priority_tier_type",
    "new_priority" "public"."priority_tier_type",
    "previous_owner_id" "uuid",
    "new_owner_id" "uuid",
    "reason" "text" NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."automation_overrides" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."automation_rules" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "rule_key" "text" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "stream" "text",
    "condition_json" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "action_json" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "priority_weight" integer DEFAULT 0 NOT NULL,
    "enabled" boolean DEFAULT true NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."automation_rules" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."customer_intelligence_profiles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "onboarding_submission_id" "uuid",
    "primary_industry" "text" NOT NULL,
    "sub_industry" "text",
    "business_model" "public"."business_model_type" NOT NULL,
    "customer_segment" "public"."customer_segment_type" DEFAULT 'b2b'::"public"."customer_segment_type" NOT NULL,
    "sales_channels" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "inventory_model" "public"."inventory_model_type",
    "fulfillment_model" "public"."fulfillment_model_type",
    "regulated" boolean DEFAULT false NOT NULL,
    "regions" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "annual_revenue_band" "text",
    "monthly_order_volume_band" "text",
    "feature_vector" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "signal_snapshot" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "confidence_score" numeric(5,2),
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    CONSTRAINT "customer_intelligence_profiles_confidence_score_check" CHECK ((("confidence_score" IS NULL) OR (("confidence_score" >= (0)::numeric) AND ("confidence_score" <= (100)::numeric)))),
    CONSTRAINT "customer_intelligence_profiles_regions_check" CHECK (("jsonb_typeof"("regions") = 'array'::"text")),
    CONSTRAINT "customer_intelligence_profiles_sales_channels_check" CHECK (("jsonb_typeof"("sales_channels") = 'array'::"text"))
);


ALTER TABLE "public"."customer_intelligence_profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."customer_onboarding_submissions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid",
    "contact_name" "text" NOT NULL,
    "contact_email" "text" NOT NULL,
    "package_id" "uuid" NOT NULL,
    "submission_status" "text" DEFAULT 'submitted'::"text" NOT NULL,
    "business_title" "text" NOT NULL,
    "business_summary" "text" NOT NULL,
    "company_type" "text",
    "employees" "text",
    "country" "text",
    "city" "text",
    "inventory_handling" "text",
    "regulated" boolean DEFAULT false NOT NULL,
    "regions" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "payload" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "submitted_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "primary_industry" "text",
    "sub_industry" "text",
    "business_model" "public"."business_model_type",
    "customer_segment" "public"."customer_segment_type",
    "sales_channels" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "inventory_model" "public"."inventory_model_type",
    "fulfillment_model" "public"."fulfillment_model_type",
    "annual_revenue_band" "text",
    "monthly_order_volume_band" "text"
);


ALTER TABLE "public"."customer_onboarding_submissions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."customer_priority_scores" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "profile_id" "uuid",
    "score" integer NOT NULL,
    "tier" "public"."priority_tier_type" NOT NULL,
    "reason_summary" "text",
    "score_factors" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "model_version" "text",
    "is_active" boolean DEFAULT true NOT NULL,
    "computed_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "expires_at" timestamp with time zone,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    CONSTRAINT "customer_priority_scores_score_check" CHECK ((("score" >= 0) AND ("score" <= 100)))
);


ALTER TABLE "public"."customer_priority_scores" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."customer_provider_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "onboarding_submission_id" "uuid",
    "package_id" "uuid",
    "provider_id" "uuid" NOT NULL,
    "package_stream" "text" NOT NULL,
    "request_status" "public"."provider_dispatch_status" DEFAULT 'sent'::"public"."provider_dispatch_status" NOT NULL,
    "sent_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "acknowledged_at" timestamp with time zone,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."customer_provider_requests" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."customer_requirement_evidence" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "requirement_item_id" "uuid" NOT NULL,
    "document_id" "uuid",
    "storage_bucket" "text",
    "storage_path" "text",
    "file_name" "text",
    "mime_type" "text",
    "size_bytes" bigint,
    "submitted_by" "uuid",
    "customer_note" "text",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."customer_requirement_evidence" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."customer_requirement_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "onboarding_submission_id" "uuid",
    "package_id" "uuid",
    "template_id" "uuid" NOT NULL,
    "package_stream" "text" NOT NULL,
    "provider_id" "uuid",
    "title" "text" NOT NULL,
    "description" "text",
    "why_required" "text",
    "evidence_type" "text" DEFAULT 'document'::"text" NOT NULL,
    "is_required" boolean DEFAULT true NOT NULL,
    "sort_order" integer DEFAULT 100 NOT NULL,
    "status" "public"."requirement_item_status" DEFAULT 'missing'::"public"."requirement_item_status" NOT NULL,
    "status_reason" "text",
    "due_at" timestamp with time zone,
    "submitted_at" timestamp with time zone,
    "approved_at" timestamp with time zone,
    "rejected_at" timestamp with time zone,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."customer_requirement_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."customer_sla_activations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "provider_request_id" "uuid" NOT NULL,
    "provider_id" "uuid" NOT NULL,
    "package_stream" "text" NOT NULL,
    "status" "public"."sla_activation_status" DEFAULT 'pending_requirements'::"public"."sla_activation_status" NOT NULL,
    "pending_reason" "text",
    "activated_at" timestamp with time zone,
    "paused_at" timestamp with time zone,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."customer_sla_activations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."documents" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid",
    "request_id" "uuid",
    "uploaded_by" "uuid" NOT NULL,
    "bucket" "text" NOT NULL,
    "path" "text" NOT NULL,
    "file_name" "text" NOT NULL,
    "mime_type" "text",
    "size_bytes" bigint,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."documents" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."fulfillment_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "order_item_id" "uuid" NOT NULL,
    "source_type" "text" NOT NULL,
    "source_id" "uuid" NOT NULL,
    "received_quantity" integer NOT NULL,
    "received_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    CONSTRAINT "fulfillment_logs_received_quantity_check" CHECK (("received_quantity" >= 0)),
    CONSTRAINT "fulfillment_logs_source_type_check" CHECK (("source_type" = ANY (ARRAY['pick_ticket'::"text", 'work_order'::"text", 'purchase_order'::"text", 'partner_handoff'::"text"])))
);


ALTER TABLE "public"."fulfillment_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."industry_taxonomy" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "primary_industry" "text" NOT NULL,
    "sub_industry" "text" NOT NULL,
    "sort_order" integer DEFAULT 100 NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."industry_taxonomy" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."inventory_movements" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "sku" "text" NOT NULL,
    "quantity" integer NOT NULL,
    "movement_type" "text" NOT NULL,
    "sales_order_id" "uuid",
    "reason" "text",
    "actor_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "inventory_movements_movement_type_check" CHECK (("movement_type" = ANY (ARRAY['reservation'::"text", 'restoration'::"text", 'adjustment'::"text", 'deduction'::"text"])))
);


ALTER TABLE "public"."inventory_movements" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."invitations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid",
    "membership_id" "uuid",
    "email" "text" NOT NULL,
    "role" "text" NOT NULL,
    "token_hash" "text" NOT NULL,
    "status" "public"."invitation_status" DEFAULT 'pending'::"public"."invitation_status" NOT NULL,
    "invited_by" "uuid",
    "expires_at" timestamp with time zone NOT NULL,
    "accepted_at" timestamp with time zone,
    "revoked_at" timestamp with time zone,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."invitations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."invoice_line_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "invoice_id" "uuid" NOT NULL,
    "package_id" "uuid",
    "description" "text" NOT NULL,
    "quantity" integer DEFAULT 1 NOT NULL,
    "unit_amount_cents" integer DEFAULT 0 NOT NULL,
    "line_total_cents" integer DEFAULT 0 NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    CONSTRAINT "invoice_line_items_line_total_cents_check" CHECK (("line_total_cents" >= 0)),
    CONSTRAINT "invoice_line_items_quantity_check" CHECK (("quantity" > 0)),
    CONSTRAINT "invoice_line_items_unit_amount_cents_check" CHECK (("unit_amount_cents" >= 0))
);


ALTER TABLE "public"."invoice_line_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."invoices" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "subscription_id" "uuid",
    "onboarding_submission_id" "uuid",
    "invoice_number" "text" NOT NULL,
    "status" "public"."invoice_status" DEFAULT 'draft'::"public"."invoice_status" NOT NULL,
    "currency_code" "text" DEFAULT 'ZAR'::"text" NOT NULL,
    "subtotal_cents" integer DEFAULT 0 NOT NULL,
    "tax_cents" integer DEFAULT 0 NOT NULL,
    "total_cents" integer DEFAULT 0 NOT NULL,
    "billing_reason" "text" DEFAULT 'package_purchase'::"text" NOT NULL,
    "due_at" timestamp with time zone,
    "issued_at" timestamp with time zone,
    "paid_at" timestamp with time zone,
    "hosted_invoice_url" "text",
    "pdf_url" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    CONSTRAINT "invoices_subtotal_cents_check" CHECK (("subtotal_cents" >= 0)),
    CONSTRAINT "invoices_tax_cents_check" CHECK (("tax_cents" >= 0)),
    CONSTRAINT "invoices_total_cents_check" CHECK (("total_cents" >= 0))
);


ALTER TABLE "public"."invoices" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notifications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "organization_id" "uuid",
    "message" "text" NOT NULL,
    "read_at" timestamp with time zone,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."notifications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."onboarding_anomaly_alerts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "onboarding_submission_id" "uuid" NOT NULL,
    "profile_id" "uuid" NOT NULL,
    "anomaly_type" "text" NOT NULL,
    "reason" "text" NOT NULL,
    "severity" "text" NOT NULL,
    "status" "text" DEFAULT 'pending_review'::"text" NOT NULL,
    "reviewed_by" "uuid",
    "reviewed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "onboarding_anomaly_alerts_severity_check" CHECK (("severity" = ANY (ARRAY['low'::"text", 'medium'::"text", 'high'::"text"]))),
    CONSTRAINT "onboarding_anomaly_alerts_status_check" CHECK (("status" = ANY (ARRAY['pending_review'::"text", 'reviewed'::"text", 'dismissed'::"text"])))
);


ALTER TABLE "public"."onboarding_anomaly_alerts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."order_workflow_step_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "order_id" "uuid" NOT NULL,
    "step_key" "text" NOT NULL,
    "step_owner" "text" NOT NULL,
    "actor_type" "text" NOT NULL,
    "actor_id" "uuid",
    "source" "text" NOT NULL,
    "proof_url" "text",
    "proof_type" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "order_workflow_step_events_actor_type_check" CHECK (("actor_type" = ANY (ARRAY['staff'::"text", 'sales'::"text", 'logistics'::"text", 'customer'::"text", 'system'::"text"]))),
    CONSTRAINT "order_workflow_step_events_step_owner_check" CHECK (("step_owner" = ANY (ARRAY['sales'::"text", 'logistics'::"text"])))
);


ALTER TABLE "public"."order_workflow_step_events" OWNER TO "postgres";


COMMENT ON TABLE "public"."order_workflow_step_events" IS 'Canonical ledger of explicitly-completed workflow steps per order. UI completion state must derive from this table, never from status/timeline inference.';



COMMENT ON COLUMN "public"."order_workflow_step_events"."step_key" IS 'Must match a key in WORKFLOW_STEP_CONTRACT. Enforced at application layer.';



COMMENT ON COLUMN "public"."order_workflow_step_events"."proof_url" IS 'Storage URL for uploaded proof documents (POD, invoices, shipping labels, etc.).';



CREATE TABLE IF NOT EXISTS "public"."order_workflow_step_inputs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "order_id" "uuid" NOT NULL,
    "step_key" "text" NOT NULL,
    "input_data" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "actor_notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."order_workflow_step_inputs" OWNER TO "postgres";


COMMENT ON TABLE "public"."order_workflow_step_inputs" IS 'Structured decision data collected during workflow steps. Separate from completion events: inputs are "what was decided", events are "proof of completion".';



COMMENT ON COLUMN "public"."order_workflow_step_inputs"."step_key" IS 'Must match a key in WORKFLOW_STEP_CONTRACT. Enforced at application layer.';



COMMENT ON COLUMN "public"."order_workflow_step_inputs"."input_data" IS 'Flexible jsonb object containing step-specific required fields. E.g. inventory_reserved: {warehouse_id, quantity_reserved, backorder_split, hold_days}. Schema validation enforced in application code.';



CREATE TABLE IF NOT EXISTS "public"."organization_memberships" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "user_id" "uuid",
    "email" "text" NOT NULL,
    "role" "text" NOT NULL,
    "status" "public"."membership_status" DEFAULT 'invited'::"public"."membership_status" NOT NULL,
    "is_primary" boolean DEFAULT false NOT NULL,
    "invited_by" "uuid",
    "invited_at" timestamp with time zone,
    "accepted_at" timestamp with time zone,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."organization_memberships" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."organizations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "kind" "public"."organization_kind" NOT NULL,
    "name" "text" NOT NULL,
    "slug" "text",
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "primary_contact_name" "text",
    "primary_contact_email" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."organizations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."outbound_emails" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "template_key" "text" NOT NULL,
    "organization_id" "uuid",
    "invitation_id" "uuid",
    "invoice_id" "uuid",
    "to_email" "text" NOT NULL,
    "subject" "text" NOT NULL,
    "provider" "text" DEFAULT 'resend'::"text" NOT NULL,
    "provider_message_id" "text",
    "status" "public"."email_delivery_status" DEFAULT 'queued'::"public"."email_delivery_status" NOT NULL,
    "payload" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "error_message" "text",
    "queued_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "sent_at" timestamp with time zone,
    "delivered_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."outbound_emails" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."pick_tickets" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "order_item_id" "uuid" NOT NULL,
    "bin_location" "text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "picked_quantity" integer DEFAULT 0 NOT NULL,
    "picked_by" "uuid",
    "completed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "assigned_to" "uuid",
    CONSTRAINT "pick_tickets_picked_quantity_check" CHECK (("picked_quantity" >= 0)),
    CONSTRAINT "pick_tickets_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'picking'::"text", 'completed'::"text"])))
);


ALTER TABLE "public"."pick_tickets" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."provider_workflow_handoffs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "source_handoff_id" "uuid",
    "sales_order_id" "uuid" NOT NULL,
    "order_item_id" "uuid" NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "from_provider_id" "uuid" NOT NULL,
    "to_provider_id" "uuid" NOT NULL,
    "handoff_type" "text" DEFAULT 'sales_to_logistics'::"text" NOT NULL,
    "package_stream" "text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "notes" "text",
    "required_documents" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "assigned_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "accepted_at" timestamp with time zone,
    "completed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    CONSTRAINT "provider_workflow_handoffs_handoff_type_check" CHECK (("handoff_type" = 'sales_to_logistics'::"text")),
    CONSTRAINT "provider_workflow_handoffs_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'accepted'::"text", 'in_progress'::"text", 'completed'::"text", 'rejected'::"text"])))
);


ALTER TABLE "public"."provider_workflow_handoffs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."purchase_order_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "order_item_id" "uuid" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "supplier_name" "text" NOT NULL,
    "ordered_quantity" integer NOT NULL,
    "completed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "purchase_order_id" "uuid",
    CONSTRAINT "purchase_order_items_ordered_quantity_check" CHECK (("ordered_quantity" > 0)),
    CONSTRAINT "purchase_order_items_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'ordered'::"text", 'completed'::"text"])))
);


ALTER TABLE "public"."purchase_order_items" OWNER TO "postgres";


COMMENT ON COLUMN "public"."purchase_order_items"."purchase_order_id" IS 'Parent purchase order header reference. Enables 1-to-many purchase order modeling.';



CREATE TABLE IF NOT EXISTS "public"."purchase_orders" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "sales_order_id" "uuid" NOT NULL,
    "provider_id" "uuid",
    "po_number" "text",
    "customer_document_id" "uuid",
    "status" "text" DEFAULT 'submitted'::"text" NOT NULL,
    "submitted_by" "uuid",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."purchase_orders" OWNER TO "postgres";


COMMENT ON TABLE "public"."purchase_orders" IS 'Header-level purchase orders submitted by customers and linked to sales orders/providers.';



COMMENT ON COLUMN "public"."purchase_orders"."customer_document_id" IS 'Primary uploaded PO file from customer (documents.id), when available.';



CREATE TABLE IF NOT EXISTS "public"."request_messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "request_id" "uuid" NOT NULL,
    "sender_id" "uuid" NOT NULL,
    "body" "text" NOT NULL,
    "read_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."request_messages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."requirement_templates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "requirement_key" "text" NOT NULL,
    "package_stream" "text" NOT NULL,
    "provider_id" "uuid",
    "title" "text" NOT NULL,
    "description" "text",
    "why_required" "text",
    "evidence_type" "text" DEFAULT 'document'::"text" NOT NULL,
    "is_required" boolean DEFAULT true NOT NULL,
    "sort_order" integer DEFAULT 100 NOT NULL,
    "applies_when" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."requirement_templates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sales_order_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "order_id" "uuid" NOT NULL,
    "product_name" "text" NOT NULL,
    "sku" "text" NOT NULL,
    "quantity" integer NOT NULL,
    "unit_price_cents" integer NOT NULL,
    "fulfillment_route" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    CONSTRAINT "sales_order_items_fulfillment_route_check" CHECK (("fulfillment_route" = ANY (ARRAY['pick'::"text", 'produce'::"text", 'order'::"text"]))),
    CONSTRAINT "sales_order_items_quantity_check" CHECK (("quantity" > 0)),
    CONSTRAINT "sales_order_items_unit_price_cents_check" CHECK (("unit_price_cents" >= 0))
);


ALTER TABLE "public"."sales_order_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sales_orders" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "status" "text" DEFAULT 'Purchase Order Received'::"text" NOT NULL,
    "total_cents" integer DEFAULT 0 NOT NULL,
    "currency_code" "text" DEFAULT 'ZAR'::"text" NOT NULL,
    "po_reference" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    CONSTRAINT "sales_orders_status_check" CHECK (("status" = ANY (ARRAY['Purchase Order Received'::"text", 'Order Validated'::"text", 'Inventory Reserved'::"text", 'Partner Handoff Created'::"text", 'Partner Fulfillment In Progress'::"text", 'Work Order Created'::"text", 'Pick Ticket Generated'::"text", 'Manufacturing'::"text", 'Packaging'::"text", 'Invoice Generated'::"text", 'Shipment Created'::"text", 'Delivered'::"text"]))),
    CONSTRAINT "sales_orders_total_cents_check" CHECK (("total_cents" >= 0))
);


ALTER TABLE "public"."sales_orders" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sales_partner_handoffs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "sales_order_id" "uuid" NOT NULL,
    "order_item_id" "uuid" NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "provider_id" "uuid" NOT NULL,
    "package_stream" "text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "partner_notes" "text",
    "assigned_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "accepted_at" timestamp with time zone,
    "completed_at" timestamp with time zone,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    CONSTRAINT "sales_partner_handoffs_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'accepted'::"text", 'in_progress'::"text", 'completed'::"text", 'rejected'::"text"])))
);


ALTER TABLE "public"."sales_partner_handoffs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."service_packages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "code" "text" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "billing_interval" "public"."billing_interval" NOT NULL,
    "currency_code" "text" DEFAULT 'ZAR'::"text" NOT NULL,
    "unit_amount_cents" integer NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    CONSTRAINT "service_packages_unit_amount_cents_check" CHECK (("unit_amount_cents" >= 0))
);


ALTER TABLE "public"."service_packages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."service_partners" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "package_stream" "text" NOT NULL,
    "name" "text" NOT NULL,
    "site" "text" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."service_partners" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."service_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid",
    "customer_id" "uuid" NOT NULL,
    "partner_id" "uuid",
    "title" "text" NOT NULL,
    "description" "text",
    "status" "text" DEFAULT 'submitted'::"text" NOT NULL,
    "priority" "text" DEFAULT 'medium'::"text" NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "provider_request_id" "uuid"
);


ALTER TABLE "public"."service_requests" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."subscriptions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "package_id" "uuid" NOT NULL,
    "onboarding_submission_id" "uuid",
    "status" "public"."subscription_status" DEFAULT 'draft'::"public"."subscription_status" NOT NULL,
    "billing_interval" "public"."billing_interval" NOT NULL,
    "currency_code" "text" DEFAULT 'ZAR'::"text" NOT NULL,
    "unit_amount_cents" integer NOT NULL,
    "quantity" integer DEFAULT 1 NOT NULL,
    "cancel_at_period_end" boolean DEFAULT false NOT NULL,
    "current_period_start" timestamp with time zone,
    "current_period_end" timestamp with time zone,
    "cancelled_at" timestamp with time zone,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    CONSTRAINT "subscriptions_quantity_check" CHECK (("quantity" > 0)),
    CONSTRAINT "subscriptions_unit_amount_cents_check" CHECK (("unit_amount_cents" >= 0))
);


ALTER TABLE "public"."subscriptions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_profiles" (
    "user_id" "uuid" NOT NULL,
    "organization_id" "uuid",
    "full_name" "text",
    "email" "text" NOT NULL,
    "role" "text" NOT NULL,
    "membership_status" "public"."membership_status" DEFAULT 'invited'::"public"."membership_status" NOT NULL,
    "invited_at" timestamp with time zone,
    "activated_at" timestamp with time zone,
    "last_login_at" timestamp with time zone,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."user_profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."work_orders" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "order_item_id" "uuid" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "quantity_to_build" integer NOT NULL,
    "completed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "assigned_to" "uuid",
    CONSTRAINT "work_orders_quantity_to_build_check" CHECK (("quantity_to_build" > 0)),
    CONSTRAINT "work_orders_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'manufacturing'::"text", 'completed'::"text"])))
);


ALTER TABLE "public"."work_orders" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."workflow_events_queue" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_type" "text" NOT NULL,
    "status" "text" DEFAULT 'queued'::"text" NOT NULL,
    "payload" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "error_message" "text",
    "scheduled_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "processed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "retry_count" integer DEFAULT 0 NOT NULL,
    "max_retries" integer DEFAULT 3 NOT NULL,
    "next_retry_at" timestamp with time zone,
    CONSTRAINT "workflow_events_queue_status_check" CHECK (("status" = ANY (ARRAY['queued'::"text", 'processing'::"text", 'completed'::"text", 'failed'::"text"])))
);


ALTER TABLE "public"."workflow_events_queue" OWNER TO "postgres";


ALTER TABLE ONLY "public"."activity_log"
    ADD CONSTRAINT "activity_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."anomaly_alerts"
    ADD CONSTRAINT "anomaly_alerts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."automation_decisions"
    ADD CONSTRAINT "automation_decisions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."automation_overrides"
    ADD CONSTRAINT "automation_overrides_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."automation_rules"
    ADD CONSTRAINT "automation_rules_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."automation_rules"
    ADD CONSTRAINT "automation_rules_rule_key_key" UNIQUE ("rule_key");



ALTER TABLE ONLY "public"."customer_intelligence_profiles"
    ADD CONSTRAINT "customer_intelligence_profiles_organization_id_key" UNIQUE ("organization_id");



ALTER TABLE ONLY "public"."customer_intelligence_profiles"
    ADD CONSTRAINT "customer_intelligence_profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."customer_onboarding_submissions"
    ADD CONSTRAINT "customer_onboarding_submissions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."customer_priority_scores"
    ADD CONSTRAINT "customer_priority_scores_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."customer_provider_requests"
    ADD CONSTRAINT "customer_provider_requests_organization_id_onboarding_submi_key" UNIQUE ("organization_id", "onboarding_submission_id", "provider_id");



ALTER TABLE ONLY "public"."customer_provider_requests"
    ADD CONSTRAINT "customer_provider_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."customer_requirement_evidence"
    ADD CONSTRAINT "customer_requirement_evidence_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."customer_requirement_items"
    ADD CONSTRAINT "customer_requirement_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."customer_sla_activations"
    ADD CONSTRAINT "customer_sla_activations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."customer_sla_activations"
    ADD CONSTRAINT "customer_sla_activations_provider_request_id_key" UNIQUE ("provider_request_id");



ALTER TABLE ONLY "public"."documents"
    ADD CONSTRAINT "documents_bucket_path_key" UNIQUE ("bucket", "path");



ALTER TABLE ONLY "public"."documents"
    ADD CONSTRAINT "documents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."fulfillment_logs"
    ADD CONSTRAINT "fulfillment_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."industry_taxonomy"
    ADD CONSTRAINT "industry_taxonomy_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."industry_taxonomy"
    ADD CONSTRAINT "industry_taxonomy_primary_industry_sub_industry_key" UNIQUE ("primary_industry", "sub_industry");



ALTER TABLE ONLY "public"."inventory_movements"
    ADD CONSTRAINT "inventory_movements_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."invitations"
    ADD CONSTRAINT "invitations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."invitations"
    ADD CONSTRAINT "invitations_token_hash_key" UNIQUE ("token_hash");



ALTER TABLE ONLY "public"."invoice_line_items"
    ADD CONSTRAINT "invoice_line_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."invoices"
    ADD CONSTRAINT "invoices_invoice_number_key" UNIQUE ("invoice_number");



ALTER TABLE ONLY "public"."invoices"
    ADD CONSTRAINT "invoices_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."onboarding_anomaly_alerts"
    ADD CONSTRAINT "onboarding_anomaly_alerts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."order_workflow_step_events"
    ADD CONSTRAINT "order_workflow_step_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."order_workflow_step_inputs"
    ADD CONSTRAINT "order_workflow_step_inputs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."organization_memberships"
    ADD CONSTRAINT "organization_memberships_organization_id_email_key" UNIQUE ("organization_id", "email");



ALTER TABLE ONLY "public"."organization_memberships"
    ADD CONSTRAINT "organization_memberships_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."organizations"
    ADD CONSTRAINT "organizations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."organizations"
    ADD CONSTRAINT "organizations_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."outbound_emails"
    ADD CONSTRAINT "outbound_emails_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pick_tickets"
    ADD CONSTRAINT "pick_tickets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."provider_workflow_handoffs"
    ADD CONSTRAINT "provider_workflow_handoffs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."purchase_order_items"
    ADD CONSTRAINT "purchase_order_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."purchase_orders"
    ADD CONSTRAINT "purchase_orders_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."purchase_orders"
    ADD CONSTRAINT "purchase_orders_sales_order_unique" UNIQUE ("sales_order_id");



ALTER TABLE ONLY "public"."request_messages"
    ADD CONSTRAINT "request_messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."requirement_templates"
    ADD CONSTRAINT "requirement_templates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."requirement_templates"
    ADD CONSTRAINT "requirement_templates_requirement_key_key" UNIQUE ("requirement_key");



ALTER TABLE ONLY "public"."sales_order_items"
    ADD CONSTRAINT "sales_order_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sales_orders"
    ADD CONSTRAINT "sales_orders_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sales_partner_handoffs"
    ADD CONSTRAINT "sales_partner_handoffs_order_item_id_key" UNIQUE ("order_item_id");



ALTER TABLE ONLY "public"."sales_partner_handoffs"
    ADD CONSTRAINT "sales_partner_handoffs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."service_packages"
    ADD CONSTRAINT "service_packages_code_key" UNIQUE ("code");



ALTER TABLE ONLY "public"."service_packages"
    ADD CONSTRAINT "service_packages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."service_partners"
    ADD CONSTRAINT "service_partners_package_stream_name_key" UNIQUE ("package_stream", "name");



ALTER TABLE ONLY "public"."service_partners"
    ADD CONSTRAINT "service_partners_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."service_requests"
    ADD CONSTRAINT "service_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."subscriptions"
    ADD CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_profiles"
    ADD CONSTRAINT "user_profiles_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."user_profiles"
    ADD CONSTRAINT "user_profiles_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."work_orders"
    ADD CONSTRAINT "work_orders_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."workflow_events_queue"
    ADD CONSTRAINT "workflow_events_queue_pkey" PRIMARY KEY ("id");



CREATE INDEX "anomaly_alerts_area_idx" ON "public"."anomaly_alerts" USING "btree" ("area");



CREATE INDEX "anomaly_alerts_created_at_idx" ON "public"."anomaly_alerts" USING "btree" ("created_at" DESC);



CREATE INDEX "anomaly_alerts_entity_idx" ON "public"."anomaly_alerts" USING "btree" ("source_entity_type", "source_entity_id");



CREATE INDEX "anomaly_alerts_severity_idx" ON "public"."anomaly_alerts" USING "btree" ("severity");



CREATE INDEX "anomaly_alerts_status_idx" ON "public"."anomaly_alerts" USING "btree" ("status");



CREATE INDEX "idx_activity_log_actor" ON "public"."activity_log" USING "btree" ("actor_id", "actor_type");



CREATE INDEX "idx_activity_log_created_at" ON "public"."activity_log" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_activity_log_partner_id" ON "public"."activity_log" USING "btree" ("partner_id");



CREATE INDEX "idx_activity_log_request_id" ON "public"."activity_log" USING "btree" ("request_id");



CREATE INDEX "idx_automation_decisions_org" ON "public"."automation_decisions" USING "btree" ("organization_id", "decided_at" DESC);



CREATE INDEX "idx_automation_decisions_request" ON "public"."automation_decisions" USING "btree" ("request_id");



CREATE INDEX "idx_automation_overrides_decision" ON "public"."automation_overrides" USING "btree" ("decision_id");



CREATE INDEX "idx_automation_rules_enabled" ON "public"."automation_rules" USING "btree" ("enabled");



CREATE INDEX "idx_customer_intelligence_profiles_industry" ON "public"."customer_intelligence_profiles" USING "btree" ("primary_industry", "business_model");



CREATE INDEX "idx_customer_intelligence_profiles_org" ON "public"."customer_intelligence_profiles" USING "btree" ("organization_id");



CREATE INDEX "idx_customer_priority_scores_org" ON "public"."customer_priority_scores" USING "btree" ("organization_id", "is_active", "computed_at" DESC);



CREATE INDEX "idx_customer_provider_requests_org" ON "public"."customer_provider_requests" USING "btree" ("organization_id", "request_status", "sent_at" DESC);



CREATE INDEX "idx_customer_requirement_evidence_item" ON "public"."customer_requirement_evidence" USING "btree" ("requirement_item_id", "created_at" DESC);



CREATE INDEX "idx_customer_requirement_items_org" ON "public"."customer_requirement_items" USING "btree" ("organization_id", "status", "sort_order");



CREATE INDEX "idx_customer_requirement_items_provider" ON "public"."customer_requirement_items" USING "btree" ("provider_id", "status");



CREATE UNIQUE INDEX "idx_customer_requirement_items_unique" ON "public"."customer_requirement_items" USING "btree" ("organization_id", "template_id", COALESCE("provider_id", '00000000-0000-0000-0000-000000000000'::"uuid"));



CREATE INDEX "idx_customer_sla_activations_org" ON "public"."customer_sla_activations" USING "btree" ("organization_id", "status", "created_at" DESC);



CREATE INDEX "idx_documents_request_id" ON "public"."documents" USING "btree" ("request_id");



CREATE INDEX "idx_documents_uploaded_by" ON "public"."documents" USING "btree" ("uploaded_by");



CREATE INDEX "idx_fulfillment_logs_item" ON "public"."fulfillment_logs" USING "btree" ("order_item_id");



CREATE INDEX "idx_industry_taxonomy_primary" ON "public"."industry_taxonomy" USING "btree" ("primary_industry", "is_active", "sort_order");



CREATE INDEX "idx_invitations_email" ON "public"."invitations" USING "btree" ("email");



CREATE INDEX "idx_invitations_status" ON "public"."invitations" USING "btree" ("status");



CREATE INDEX "idx_invoices_org" ON "public"."invoices" USING "btree" ("organization_id");



CREATE INDEX "idx_notifications_user_id" ON "public"."notifications" USING "btree" ("user_id");



CREATE INDEX "idx_oaa_org" ON "public"."onboarding_anomaly_alerts" USING "btree" ("organization_id");



CREATE INDEX "idx_oaa_severity" ON "public"."onboarding_anomaly_alerts" USING "btree" ("severity");



CREATE INDEX "idx_oaa_status" ON "public"."onboarding_anomaly_alerts" USING "btree" ("status");



CREATE INDEX "idx_oaa_submission" ON "public"."onboarding_anomaly_alerts" USING "btree" ("onboarding_submission_id");



CREATE INDEX "idx_onboarding_contact_email" ON "public"."customer_onboarding_submissions" USING "btree" ("contact_email");



CREATE INDEX "idx_org_memberships_org" ON "public"."organization_memberships" USING "btree" ("organization_id");



CREATE INDEX "idx_org_memberships_user" ON "public"."organization_memberships" USING "btree" ("user_id");



CREATE INDEX "idx_outbound_emails_status" ON "public"."outbound_emails" USING "btree" ("status");



CREATE INDEX "idx_owse_order_id_created" ON "public"."order_workflow_step_events" USING "btree" ("order_id", "created_at");



CREATE UNIQUE INDEX "idx_owse_order_step_unique" ON "public"."order_workflow_step_events" USING "btree" ("order_id", "step_key");



CREATE INDEX "idx_owsi_order_id" ON "public"."order_workflow_step_inputs" USING "btree" ("order_id");



CREATE UNIQUE INDEX "idx_owsi_order_step_unique" ON "public"."order_workflow_step_inputs" USING "btree" ("order_id", "step_key");



CREATE INDEX "idx_pick_tickets_item" ON "public"."pick_tickets" USING "btree" ("order_item_id");



CREATE INDEX "idx_provider_workflow_handoffs_order" ON "public"."provider_workflow_handoffs" USING "btree" ("sales_order_id", "order_item_id");



CREATE INDEX "idx_provider_workflow_handoffs_to_provider" ON "public"."provider_workflow_handoffs" USING "btree" ("to_provider_id", "status", "assigned_at" DESC);



CREATE UNIQUE INDEX "idx_provider_workflow_handoffs_unique_source" ON "public"."provider_workflow_handoffs" USING "btree" ("source_handoff_id", "to_provider_id") WHERE ("source_handoff_id" IS NOT NULL);



CREATE INDEX "idx_purchase_order_items_item" ON "public"."purchase_order_items" USING "btree" ("order_item_id");



CREATE INDEX "idx_purchase_order_items_purchase_order_id" ON "public"."purchase_order_items" USING "btree" ("purchase_order_id");



CREATE INDEX "idx_purchase_orders_org_created" ON "public"."purchase_orders" USING "btree" ("organization_id", "created_at" DESC);



CREATE INDEX "idx_purchase_orders_po_number" ON "public"."purchase_orders" USING "btree" ("po_number");



CREATE INDEX "idx_purchase_orders_provider_created" ON "public"."purchase_orders" USING "btree" ("provider_id", "created_at" DESC);



CREATE INDEX "idx_purchase_orders_status_created" ON "public"."purchase_orders" USING "btree" ("status", "created_at" DESC);



CREATE INDEX "idx_request_messages_request_id" ON "public"."request_messages" USING "btree" ("request_id");



CREATE INDEX "idx_requirement_templates_provider" ON "public"."requirement_templates" USING "btree" ("provider_id", "is_active");



CREATE INDEX "idx_requirement_templates_stream" ON "public"."requirement_templates" USING "btree" ("package_stream", "is_active", "sort_order");



CREATE INDEX "idx_sales_order_items_order" ON "public"."sales_order_items" USING "btree" ("order_id");



CREATE INDEX "idx_sales_orders_org" ON "public"."sales_orders" USING "btree" ("organization_id");



CREATE INDEX "idx_sales_orders_status" ON "public"."sales_orders" USING "btree" ("status");



CREATE INDEX "idx_sales_partner_handoffs_order" ON "public"."sales_partner_handoffs" USING "btree" ("sales_order_id", "status", "assigned_at" DESC);



CREATE INDEX "idx_sales_partner_handoffs_provider" ON "public"."sales_partner_handoffs" USING "btree" ("provider_id", "status", "assigned_at" DESC);



CREATE INDEX "idx_service_partners_stream" ON "public"."service_partners" USING "btree" ("package_stream");



CREATE INDEX "idx_service_requests_customer_id" ON "public"."service_requests" USING "btree" ("customer_id");



CREATE INDEX "idx_service_requests_partner_id" ON "public"."service_requests" USING "btree" ("partner_id");



CREATE INDEX "idx_service_requests_status" ON "public"."service_requests" USING "btree" ("status");



CREATE INDEX "idx_subscriptions_org" ON "public"."subscriptions" USING "btree" ("organization_id");



CREATE INDEX "idx_user_profiles_org" ON "public"."user_profiles" USING "btree" ("organization_id");



CREATE INDEX "idx_work_orders_item" ON "public"."work_orders" USING "btree" ("order_item_id");



CREATE INDEX "idx_workflow_events_queue_status" ON "public"."workflow_events_queue" USING "btree" ("status");



CREATE INDEX "inventory_movements_order_idx" ON "public"."inventory_movements" USING "btree" ("sales_order_id");



CREATE INDEX "inventory_movements_sku_idx" ON "public"."inventory_movements" USING "btree" ("sku");



CREATE INDEX "pick_tickets_assigned_to_idx" ON "public"."pick_tickets" USING "btree" ("assigned_to");



CREATE INDEX "work_orders_assigned_to_idx" ON "public"."work_orders" USING "btree" ("assigned_to");



CREATE INDEX "workflow_events_queue_retry_idx" ON "public"."workflow_events_queue" USING "btree" ("status", "next_retry_at");



CREATE OR REPLACE TRIGGER "automation_decisions_touch_updated_at" BEFORE UPDATE ON "public"."automation_decisions" FOR EACH ROW EXECUTE FUNCTION "public"."touch_updated_at"();



CREATE OR REPLACE TRIGGER "automation_rules_touch_updated_at" BEFORE UPDATE ON "public"."automation_rules" FOR EACH ROW EXECUTE FUNCTION "public"."touch_updated_at"();



CREATE OR REPLACE TRIGGER "customer_intelligence_profiles_touch_updated_at" BEFORE UPDATE ON "public"."customer_intelligence_profiles" FOR EACH ROW EXECUTE FUNCTION "public"."touch_updated_at"();



CREATE OR REPLACE TRIGGER "customer_onboarding_submissions_touch_updated_at" BEFORE UPDATE ON "public"."customer_onboarding_submissions" FOR EACH ROW EXECUTE FUNCTION "public"."touch_updated_at"();



CREATE OR REPLACE TRIGGER "customer_provider_requests_touch_updated_at" BEFORE UPDATE ON "public"."customer_provider_requests" FOR EACH ROW EXECUTE FUNCTION "public"."touch_updated_at"();



CREATE OR REPLACE TRIGGER "customer_requirement_evidence_touch_updated_at" BEFORE UPDATE ON "public"."customer_requirement_evidence" FOR EACH ROW EXECUTE FUNCTION "public"."touch_updated_at"();



CREATE OR REPLACE TRIGGER "customer_requirement_items_touch_updated_at" BEFORE UPDATE ON "public"."customer_requirement_items" FOR EACH ROW EXECUTE FUNCTION "public"."touch_updated_at"();



CREATE OR REPLACE TRIGGER "customer_sla_activations_touch_updated_at" BEFORE UPDATE ON "public"."customer_sla_activations" FOR EACH ROW EXECUTE FUNCTION "public"."touch_updated_at"();



CREATE OR REPLACE TRIGGER "documents_touch_updated_at" BEFORE UPDATE ON "public"."documents" FOR EACH ROW EXECUTE FUNCTION "public"."touch_updated_at"();



CREATE OR REPLACE TRIGGER "industry_taxonomy_touch_updated_at" BEFORE UPDATE ON "public"."industry_taxonomy" FOR EACH ROW EXECUTE FUNCTION "public"."touch_updated_at"();



CREATE OR REPLACE TRIGGER "invitations_touch_updated_at" BEFORE UPDATE ON "public"."invitations" FOR EACH ROW EXECUTE FUNCTION "public"."touch_updated_at"();



CREATE OR REPLACE TRIGGER "invoices_touch_updated_at" BEFORE UPDATE ON "public"."invoices" FOR EACH ROW EXECUTE FUNCTION "public"."touch_updated_at"();



CREATE OR REPLACE TRIGGER "organization_memberships_touch_updated_at" BEFORE UPDATE ON "public"."organization_memberships" FOR EACH ROW EXECUTE FUNCTION "public"."touch_updated_at"();



CREATE OR REPLACE TRIGGER "organizations_touch_updated_at" BEFORE UPDATE ON "public"."organizations" FOR EACH ROW EXECUTE FUNCTION "public"."touch_updated_at"();



CREATE OR REPLACE TRIGGER "outbound_emails_touch_updated_at" BEFORE UPDATE ON "public"."outbound_emails" FOR EACH ROW EXECUTE FUNCTION "public"."touch_updated_at"();



CREATE OR REPLACE TRIGGER "pick_tickets_touch_updated_at" BEFORE UPDATE ON "public"."pick_tickets" FOR EACH ROW EXECUTE FUNCTION "public"."touch_updated_at"();



CREATE OR REPLACE TRIGGER "provider_workflow_handoffs_touch_updated_at" BEFORE UPDATE ON "public"."provider_workflow_handoffs" FOR EACH ROW EXECUTE FUNCTION "public"."touch_updated_at"();



CREATE OR REPLACE TRIGGER "purchase_order_items_touch_updated_at" BEFORE UPDATE ON "public"."purchase_order_items" FOR EACH ROW EXECUTE FUNCTION "public"."touch_updated_at"();



CREATE OR REPLACE TRIGGER "requirement_templates_touch_updated_at" BEFORE UPDATE ON "public"."requirement_templates" FOR EACH ROW EXECUTE FUNCTION "public"."touch_updated_at"();



CREATE OR REPLACE TRIGGER "sales_orders_touch_updated_at" BEFORE UPDATE ON "public"."sales_orders" FOR EACH ROW EXECUTE FUNCTION "public"."touch_updated_at"();



CREATE OR REPLACE TRIGGER "sales_partner_handoffs_touch_updated_at" BEFORE UPDATE ON "public"."sales_partner_handoffs" FOR EACH ROW EXECUTE FUNCTION "public"."touch_updated_at"();



CREATE OR REPLACE TRIGGER "service_packages_touch_updated_at" BEFORE UPDATE ON "public"."service_packages" FOR EACH ROW EXECUTE FUNCTION "public"."touch_updated_at"();



CREATE OR REPLACE TRIGGER "service_partners_touch_updated_at" BEFORE UPDATE ON "public"."service_partners" FOR EACH ROW EXECUTE FUNCTION "public"."touch_updated_at"();



CREATE OR REPLACE TRIGGER "service_requests_touch_updated_at" BEFORE UPDATE ON "public"."service_requests" FOR EACH ROW EXECUTE FUNCTION "public"."touch_updated_at"();



CREATE OR REPLACE TRIGGER "subscriptions_touch_updated_at" BEFORE UPDATE ON "public"."subscriptions" FOR EACH ROW EXECUTE FUNCTION "public"."touch_updated_at"();



CREATE OR REPLACE TRIGGER "user_profiles_touch_updated_at" BEFORE UPDATE ON "public"."user_profiles" FOR EACH ROW EXECUTE FUNCTION "public"."touch_updated_at"();



CREATE OR REPLACE TRIGGER "work_orders_touch_updated_at" BEFORE UPDATE ON "public"."work_orders" FOR EACH ROW EXECUTE FUNCTION "public"."touch_updated_at"();



CREATE OR REPLACE TRIGGER "workflow_events_queue_touch_updated_at" BEFORE UPDATE ON "public"."workflow_events_queue" FOR EACH ROW EXECUTE FUNCTION "public"."touch_updated_at"();



ALTER TABLE ONLY "public"."anomaly_alerts"
    ADD CONSTRAINT "anomaly_alerts_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."automation_decisions"
    ADD CONSTRAINT "automation_decisions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."automation_decisions"
    ADD CONSTRAINT "automation_decisions_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."customer_intelligence_profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."automation_decisions"
    ADD CONSTRAINT "automation_decisions_recommended_owner_id_fkey" FOREIGN KEY ("recommended_owner_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."automation_decisions"
    ADD CONSTRAINT "automation_decisions_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "public"."service_requests"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."automation_decisions"
    ADD CONSTRAINT "automation_decisions_rule_id_fkey" FOREIGN KEY ("rule_id") REFERENCES "public"."automation_rules"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."automation_overrides"
    ADD CONSTRAINT "automation_overrides_decision_id_fkey" FOREIGN KEY ("decision_id") REFERENCES "public"."automation_decisions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."automation_overrides"
    ADD CONSTRAINT "automation_overrides_new_owner_id_fkey" FOREIGN KEY ("new_owner_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."automation_overrides"
    ADD CONSTRAINT "automation_overrides_overridden_by_fkey" FOREIGN KEY ("overridden_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."automation_overrides"
    ADD CONSTRAINT "automation_overrides_previous_owner_id_fkey" FOREIGN KEY ("previous_owner_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."automation_rules"
    ADD CONSTRAINT "automation_rules_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."customer_intelligence_profiles"
    ADD CONSTRAINT "customer_intelligence_profiles_onboarding_submission_id_fkey" FOREIGN KEY ("onboarding_submission_id") REFERENCES "public"."customer_onboarding_submissions"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."customer_intelligence_profiles"
    ADD CONSTRAINT "customer_intelligence_profiles_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."customer_onboarding_submissions"
    ADD CONSTRAINT "customer_onboarding_submissions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."customer_onboarding_submissions"
    ADD CONSTRAINT "customer_onboarding_submissions_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "public"."service_packages"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."customer_priority_scores"
    ADD CONSTRAINT "customer_priority_scores_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."customer_priority_scores"
    ADD CONSTRAINT "customer_priority_scores_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."customer_priority_scores"
    ADD CONSTRAINT "customer_priority_scores_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."customer_intelligence_profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."customer_provider_requests"
    ADD CONSTRAINT "customer_provider_requests_onboarding_submission_id_fkey" FOREIGN KEY ("onboarding_submission_id") REFERENCES "public"."customer_onboarding_submissions"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."customer_provider_requests"
    ADD CONSTRAINT "customer_provider_requests_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."customer_provider_requests"
    ADD CONSTRAINT "customer_provider_requests_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "public"."service_packages"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."customer_provider_requests"
    ADD CONSTRAINT "customer_provider_requests_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "public"."service_partners"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."customer_requirement_evidence"
    ADD CONSTRAINT "customer_requirement_evidence_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."customer_requirement_evidence"
    ADD CONSTRAINT "customer_requirement_evidence_requirement_item_id_fkey" FOREIGN KEY ("requirement_item_id") REFERENCES "public"."customer_requirement_items"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."customer_requirement_evidence"
    ADD CONSTRAINT "customer_requirement_evidence_submitted_by_fkey" FOREIGN KEY ("submitted_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."customer_requirement_items"
    ADD CONSTRAINT "customer_requirement_items_onboarding_submission_id_fkey" FOREIGN KEY ("onboarding_submission_id") REFERENCES "public"."customer_onboarding_submissions"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."customer_requirement_items"
    ADD CONSTRAINT "customer_requirement_items_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."customer_requirement_items"
    ADD CONSTRAINT "customer_requirement_items_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "public"."service_packages"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."customer_requirement_items"
    ADD CONSTRAINT "customer_requirement_items_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "public"."service_partners"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."customer_requirement_items"
    ADD CONSTRAINT "customer_requirement_items_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "public"."requirement_templates"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."customer_sla_activations"
    ADD CONSTRAINT "customer_sla_activations_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."customer_sla_activations"
    ADD CONSTRAINT "customer_sla_activations_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "public"."service_partners"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."customer_sla_activations"
    ADD CONSTRAINT "customer_sla_activations_provider_request_id_fkey" FOREIGN KEY ("provider_request_id") REFERENCES "public"."customer_provider_requests"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."documents"
    ADD CONSTRAINT "documents_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."documents"
    ADD CONSTRAINT "documents_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "public"."service_requests"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."documents"
    ADD CONSTRAINT "documents_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."fulfillment_logs"
    ADD CONSTRAINT "fulfillment_logs_order_item_id_fkey" FOREIGN KEY ("order_item_id") REFERENCES "public"."sales_order_items"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."fulfillment_logs"
    ADD CONSTRAINT "fulfillment_logs_received_by_fkey" FOREIGN KEY ("received_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."inventory_movements"
    ADD CONSTRAINT "inventory_movements_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."inventory_movements"
    ADD CONSTRAINT "inventory_movements_sales_order_id_fkey" FOREIGN KEY ("sales_order_id") REFERENCES "public"."sales_orders"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."invitations"
    ADD CONSTRAINT "invitations_invited_by_fkey" FOREIGN KEY ("invited_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."invitations"
    ADD CONSTRAINT "invitations_membership_id_fkey" FOREIGN KEY ("membership_id") REFERENCES "public"."organization_memberships"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."invitations"
    ADD CONSTRAINT "invitations_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."invoice_line_items"
    ADD CONSTRAINT "invoice_line_items_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."invoice_line_items"
    ADD CONSTRAINT "invoice_line_items_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "public"."service_packages"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."invoices"
    ADD CONSTRAINT "invoices_onboarding_submission_id_fkey" FOREIGN KEY ("onboarding_submission_id") REFERENCES "public"."customer_onboarding_submissions"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."invoices"
    ADD CONSTRAINT "invoices_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."invoices"
    ADD CONSTRAINT "invoices_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscriptions"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."onboarding_anomaly_alerts"
    ADD CONSTRAINT "onboarding_anomaly_alerts_onboarding_submission_id_fkey" FOREIGN KEY ("onboarding_submission_id") REFERENCES "public"."customer_onboarding_submissions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."onboarding_anomaly_alerts"
    ADD CONSTRAINT "onboarding_anomaly_alerts_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."onboarding_anomaly_alerts"
    ADD CONSTRAINT "onboarding_anomaly_alerts_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."customer_intelligence_profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."onboarding_anomaly_alerts"
    ADD CONSTRAINT "onboarding_anomaly_alerts_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."order_workflow_step_events"
    ADD CONSTRAINT "order_workflow_step_events_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."sales_orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."order_workflow_step_inputs"
    ADD CONSTRAINT "order_workflow_step_inputs_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."sales_orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."organization_memberships"
    ADD CONSTRAINT "organization_memberships_invited_by_fkey" FOREIGN KEY ("invited_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."organization_memberships"
    ADD CONSTRAINT "organization_memberships_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."organization_memberships"
    ADD CONSTRAINT "organization_memberships_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."outbound_emails"
    ADD CONSTRAINT "outbound_emails_invitation_id_fkey" FOREIGN KEY ("invitation_id") REFERENCES "public"."invitations"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."outbound_emails"
    ADD CONSTRAINT "outbound_emails_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."outbound_emails"
    ADD CONSTRAINT "outbound_emails_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."pick_tickets"
    ADD CONSTRAINT "pick_tickets_assigned_to_fkey" FOREIGN KEY ("assigned_to") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."pick_tickets"
    ADD CONSTRAINT "pick_tickets_order_item_id_fkey" FOREIGN KEY ("order_item_id") REFERENCES "public"."sales_order_items"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pick_tickets"
    ADD CONSTRAINT "pick_tickets_picked_by_fkey" FOREIGN KEY ("picked_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."provider_workflow_handoffs"
    ADD CONSTRAINT "provider_workflow_handoffs_from_provider_id_fkey" FOREIGN KEY ("from_provider_id") REFERENCES "public"."service_partners"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."provider_workflow_handoffs"
    ADD CONSTRAINT "provider_workflow_handoffs_order_item_id_fkey" FOREIGN KEY ("order_item_id") REFERENCES "public"."sales_order_items"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."provider_workflow_handoffs"
    ADD CONSTRAINT "provider_workflow_handoffs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."provider_workflow_handoffs"
    ADD CONSTRAINT "provider_workflow_handoffs_sales_order_id_fkey" FOREIGN KEY ("sales_order_id") REFERENCES "public"."sales_orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."provider_workflow_handoffs"
    ADD CONSTRAINT "provider_workflow_handoffs_source_handoff_id_fkey" FOREIGN KEY ("source_handoff_id") REFERENCES "public"."sales_partner_handoffs"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."provider_workflow_handoffs"
    ADD CONSTRAINT "provider_workflow_handoffs_to_provider_id_fkey" FOREIGN KEY ("to_provider_id") REFERENCES "public"."service_partners"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."purchase_order_items"
    ADD CONSTRAINT "purchase_order_items_order_item_id_fkey" FOREIGN KEY ("order_item_id") REFERENCES "public"."sales_order_items"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."purchase_order_items"
    ADD CONSTRAINT "purchase_order_items_purchase_order_id_fkey" FOREIGN KEY ("purchase_order_id") REFERENCES "public"."purchase_orders"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."purchase_orders"
    ADD CONSTRAINT "purchase_orders_customer_document_id_fkey" FOREIGN KEY ("customer_document_id") REFERENCES "public"."documents"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."purchase_orders"
    ADD CONSTRAINT "purchase_orders_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."purchase_orders"
    ADD CONSTRAINT "purchase_orders_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "public"."service_partners"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."purchase_orders"
    ADD CONSTRAINT "purchase_orders_sales_order_id_fkey" FOREIGN KEY ("sales_order_id") REFERENCES "public"."sales_orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."request_messages"
    ADD CONSTRAINT "request_messages_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "public"."service_requests"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."request_messages"
    ADD CONSTRAINT "request_messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."requirement_templates"
    ADD CONSTRAINT "requirement_templates_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "public"."service_partners"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sales_order_items"
    ADD CONSTRAINT "sales_order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."sales_orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sales_orders"
    ADD CONSTRAINT "sales_orders_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sales_partner_handoffs"
    ADD CONSTRAINT "sales_partner_handoffs_order_item_id_fkey" FOREIGN KEY ("order_item_id") REFERENCES "public"."sales_order_items"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sales_partner_handoffs"
    ADD CONSTRAINT "sales_partner_handoffs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sales_partner_handoffs"
    ADD CONSTRAINT "sales_partner_handoffs_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "public"."service_partners"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sales_partner_handoffs"
    ADD CONSTRAINT "sales_partner_handoffs_sales_order_id_fkey" FOREIGN KEY ("sales_order_id") REFERENCES "public"."sales_orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."service_requests"
    ADD CONSTRAINT "service_requests_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."service_requests"
    ADD CONSTRAINT "service_requests_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."service_requests"
    ADD CONSTRAINT "service_requests_partner_id_fkey" FOREIGN KEY ("partner_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."service_requests"
    ADD CONSTRAINT "service_requests_provider_request_id_fkey" FOREIGN KEY ("provider_request_id") REFERENCES "public"."customer_provider_requests"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."subscriptions"
    ADD CONSTRAINT "subscriptions_onboarding_submission_id_fkey" FOREIGN KEY ("onboarding_submission_id") REFERENCES "public"."customer_onboarding_submissions"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."subscriptions"
    ADD CONSTRAINT "subscriptions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."subscriptions"
    ADD CONSTRAINT "subscriptions_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "public"."service_packages"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."user_profiles"
    ADD CONSTRAINT "user_profiles_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."user_profiles"
    ADD CONSTRAINT "user_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."work_orders"
    ADD CONSTRAINT "work_orders_assigned_to_fkey" FOREIGN KEY ("assigned_to") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."work_orders"
    ADD CONSTRAINT "work_orders_order_item_id_fkey" FOREIGN KEY ("order_item_id") REFERENCES "public"."sales_order_items"("id") ON DELETE CASCADE;



CREATE POLICY "Customers can read their own order inputs" ON "public"."order_workflow_step_inputs" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM ("public"."sales_orders" "so"
     JOIN "public"."user_profiles" "up" ON (("up"."organization_id" = "so"."organization_id")))
  WHERE (("so"."id" = "order_workflow_step_inputs"."order_id") AND ("up"."user_id" = "auth"."uid"()) AND ("up"."role" = 'customer'::"text")))));



CREATE POLICY "Customers can read their own order step events" ON "public"."order_workflow_step_events" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM ("public"."sales_orders" "so"
     JOIN "public"."user_profiles" "up" ON (("up"."organization_id" = "so"."organization_id")))
  WHERE (("so"."id" = "order_workflow_step_events"."order_id") AND ("up"."user_id" = "auth"."uid"()) AND ("up"."role" = 'customer'::"text")))));



CREATE POLICY "Customers can read their own purchase orders" ON "public"."purchase_orders" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."user_profiles" "up"
  WHERE (("up"."user_id" = "auth"."uid"()) AND ("up"."role" = 'customer'::"text") AND ("up"."organization_id" = "purchase_orders"."organization_id")))));



CREATE POLICY "Service role can insert purchase orders" ON "public"."purchase_orders" FOR INSERT WITH CHECK (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "Service role can insert step events" ON "public"."order_workflow_step_events" FOR INSERT WITH CHECK (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "Service role can insert step inputs" ON "public"."order_workflow_step_inputs" FOR INSERT WITH CHECK (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "Service role can update purchase orders" ON "public"."purchase_orders" FOR UPDATE USING (("auth"."role"() = 'service_role'::"text")) WITH CHECK (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "Service role can update step inputs" ON "public"."order_workflow_step_inputs" FOR UPDATE USING (("auth"."role"() = 'service_role'::"text")) WITH CHECK (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "Service role full access" ON "public"."activity_log" USING (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "Staff and sales can read purchase orders" ON "public"."purchase_orders" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."user_profiles" "up"
  WHERE (("up"."user_id" = "auth"."uid"()) AND ("up"."role" = ANY (ARRAY['staff'::"text", 'admin'::"text", 'sales'::"text", 'logistics'::"text"]))))));



CREATE POLICY "Staff and sales can read step events" ON "public"."order_workflow_step_events" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."user_profiles" "up"
  WHERE (("up"."user_id" = "auth"."uid"()) AND ("up"."role" = ANY (ARRAY['staff'::"text", 'admin'::"text", 'sales'::"text", 'logistics'::"text"]))))));



CREATE POLICY "Staff and sales can read step inputs" ON "public"."order_workflow_step_inputs" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."user_profiles" "up"
  WHERE (("up"."user_id" = "auth"."uid"()) AND ("up"."role" = ANY (ARRAY['staff'::"text", 'admin'::"text", 'sales'::"text", 'logistics'::"text"]))))));



CREATE POLICY "Users can insert activities" ON "public"."activity_log" FOR INSERT WITH CHECK (("actor_id" = "auth"."uid"()));



CREATE POLICY "Users can read their own activities" ON "public"."activity_log" FOR SELECT USING (("actor_id" = "auth"."uid"()));



ALTER TABLE "public"."activity_log" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."anomaly_alerts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."automation_decisions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."automation_overrides" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."automation_rules" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."customer_intelligence_profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."customer_onboarding_submissions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."customer_priority_scores" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."customer_provider_requests" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "customer_provider_requests_select_policy" ON "public"."customer_provider_requests" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."user_profiles" "up"
  WHERE (("up"."user_id" = "auth"."uid"()) AND ("up"."organization_id" = "up"."organization_id")))));



ALTER TABLE "public"."customer_requirement_evidence" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "customer_requirement_evidence_insert_policy" ON "public"."customer_requirement_evidence" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."customer_requirement_items" "cri"
     JOIN "public"."user_profiles" "up" ON (("up"."organization_id" = "cri"."organization_id")))
  WHERE (("cri"."id" = "customer_requirement_evidence"."requirement_item_id") AND ("up"."user_id" = "auth"."uid"())))));



CREATE POLICY "customer_requirement_evidence_select_policy" ON "public"."customer_requirement_evidence" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM ("public"."customer_requirement_items" "cri"
     JOIN "public"."user_profiles" "up" ON (("up"."organization_id" = "cri"."organization_id")))
  WHERE (("cri"."id" = "customer_requirement_evidence"."requirement_item_id") AND ("up"."user_id" = "auth"."uid"())))));



ALTER TABLE "public"."customer_requirement_items" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "customer_requirement_items_select_policy" ON "public"."customer_requirement_items" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."user_profiles" "up"
  WHERE (("up"."user_id" = "auth"."uid"()) AND ("up"."organization_id" = "up"."organization_id")))));



ALTER TABLE "public"."customer_sla_activations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "customer_sla_activations_select_policy" ON "public"."customer_sla_activations" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."user_profiles" "up"
  WHERE (("up"."user_id" = "auth"."uid"()) AND ("up"."organization_id" = "up"."organization_id")))));



ALTER TABLE "public"."documents" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "documents_insert_policy" ON "public"."documents" FOR INSERT WITH CHECK (("uploaded_by" = "auth"."uid"()));



CREATE POLICY "documents_select_policy" ON "public"."documents" FOR SELECT USING (("uploaded_by" = "auth"."uid"()));



CREATE POLICY "documents_update_policy" ON "public"."documents" FOR UPDATE USING (("uploaded_by" = "auth"."uid"())) WITH CHECK (("uploaded_by" = "auth"."uid"()));



ALTER TABLE "public"."fulfillment_logs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "fulfillment_logs_insert_policy" ON "public"."fulfillment_logs" FOR INSERT WITH CHECK (true);



CREATE POLICY "fulfillment_logs_select_policy" ON "public"."fulfillment_logs" FOR SELECT USING (true);



ALTER TABLE "public"."industry_taxonomy" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "industry_taxonomy_public_select_policy" ON "public"."industry_taxonomy" FOR SELECT USING (("is_active" = true));



ALTER TABLE "public"."inventory_movements" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."invitations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."invoice_line_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."invoices" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."notifications" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "notifications_select_policy" ON "public"."notifications" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "notifications_update_policy" ON "public"."notifications" FOR UPDATE USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."onboarding_anomaly_alerts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."order_workflow_step_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."order_workflow_step_inputs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."organization_memberships" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."organizations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."outbound_emails" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."pick_tickets" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "pick_tickets_select_policy" ON "public"."pick_tickets" FOR SELECT USING (true);



CREATE POLICY "pick_tickets_update_policy" ON "public"."pick_tickets" FOR UPDATE USING (true);



ALTER TABLE "public"."provider_workflow_handoffs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "provider_workflow_handoffs_partner_select_policy" ON "public"."provider_workflow_handoffs" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."user_profiles" "up"
  WHERE (("up"."user_id" = "auth"."uid"()) AND ("up"."role" = 'partner'::"text") AND ((COALESCE(("up"."metadata" ->> 'service_partner_id'::"text"), ''::"text") = ("provider_workflow_handoffs"."from_provider_id")::"text") OR (COALESCE(("up"."metadata" ->> 'service_partner_id'::"text"), ''::"text") = ("provider_workflow_handoffs"."to_provider_id")::"text"))))));



CREATE POLICY "provider_workflow_handoffs_partner_update_policy" ON "public"."provider_workflow_handoffs" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."user_profiles" "up"
  WHERE (("up"."user_id" = "auth"."uid"()) AND ("up"."role" = 'partner'::"text") AND (COALESCE(("up"."metadata" ->> 'service_partner_id'::"text"), ''::"text") = ("provider_workflow_handoffs"."to_provider_id")::"text"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."user_profiles" "up"
  WHERE (("up"."user_id" = "auth"."uid"()) AND ("up"."role" = 'partner'::"text") AND (COALESCE(("up"."metadata" ->> 'service_partner_id'::"text"), ''::"text") = ("provider_workflow_handoffs"."to_provider_id")::"text")))));



ALTER TABLE "public"."purchase_order_items" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "purchase_order_items_select_policy" ON "public"."purchase_order_items" FOR SELECT USING (true);



ALTER TABLE "public"."purchase_orders" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."request_messages" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "request_messages_insert_policy" ON "public"."request_messages" FOR INSERT WITH CHECK ((("sender_id" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "public"."service_requests" "sr"
  WHERE (("sr"."id" = "request_messages"."request_id") AND (("sr"."customer_id" = "auth"."uid"()) OR ("sr"."partner_id" = "auth"."uid"())))))));



CREATE POLICY "request_messages_select_policy" ON "public"."request_messages" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."service_requests" "sr"
  WHERE (("sr"."id" = "request_messages"."request_id") AND (("sr"."customer_id" = "auth"."uid"()) OR ("sr"."partner_id" = "auth"."uid"()))))));



ALTER TABLE "public"."requirement_templates" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "requirement_templates_authenticated_select_policy" ON "public"."requirement_templates" FOR SELECT USING ((("auth"."uid"() IS NOT NULL) AND ("is_active" = true)));



ALTER TABLE "public"."sales_order_items" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "sales_order_items_select_policy" ON "public"."sales_order_items" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM ("public"."sales_orders" "so"
     JOIN "public"."user_profiles" "up" ON (("up"."organization_id" = "so"."organization_id")))
  WHERE (("so"."id" = "sales_order_items"."order_id") AND ("up"."user_id" = "auth"."uid"())))));



ALTER TABLE "public"."sales_orders" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "sales_orders_insert_policy" ON "public"."sales_orders" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."user_profiles" "up"
  WHERE (("up"."user_id" = "auth"."uid"()) AND ("up"."organization_id" = "up"."organization_id")))));



CREATE POLICY "sales_orders_select_policy" ON "public"."sales_orders" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."user_profiles" "up"
  WHERE (("up"."user_id" = "auth"."uid"()) AND ("up"."organization_id" = "up"."organization_id")))));



CREATE POLICY "sales_orders_update_policy" ON "public"."sales_orders" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."user_profiles" "up"
  WHERE (("up"."user_id" = "auth"."uid"()) AND ("up"."organization_id" = "up"."organization_id")))));



ALTER TABLE "public"."sales_partner_handoffs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "sales_partner_handoffs_org_select_policy" ON "public"."sales_partner_handoffs" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."user_profiles" "up"
  WHERE (("up"."user_id" = "auth"."uid"()) AND ("up"."organization_id" = "sales_partner_handoffs"."organization_id")))));



CREATE POLICY "sales_partner_handoffs_partner_select_policy" ON "public"."sales_partner_handoffs" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."user_profiles" "up"
  WHERE (("up"."user_id" = "auth"."uid"()) AND ("up"."role" = 'partner'::"text") AND (COALESCE(("up"."metadata" ->> 'service_partner_id'::"text"), ''::"text") = ("sales_partner_handoffs"."provider_id")::"text")))));



CREATE POLICY "sales_partner_handoffs_partner_update_policy" ON "public"."sales_partner_handoffs" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."user_profiles" "up"
  WHERE (("up"."user_id" = "auth"."uid"()) AND ("up"."role" = 'partner'::"text") AND (COALESCE(("up"."metadata" ->> 'service_partner_id'::"text"), ''::"text") = ("sales_partner_handoffs"."provider_id")::"text"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."user_profiles" "up"
  WHERE (("up"."user_id" = "auth"."uid"()) AND ("up"."role" = 'partner'::"text") AND (COALESCE(("up"."metadata" ->> 'service_partner_id'::"text"), ''::"text") = ("sales_partner_handoffs"."provider_id")::"text")))));



ALTER TABLE "public"."service_packages" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "service_packages_public_select_policy" ON "public"."service_packages" FOR SELECT USING (("is_active" = true));



ALTER TABLE "public"."service_partners" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."service_requests" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "service_requests_insert_policy" ON "public"."service_requests" FOR INSERT WITH CHECK (("customer_id" = "auth"."uid"()));



CREATE POLICY "service_requests_select_policy" ON "public"."service_requests" FOR SELECT USING ((("customer_id" = "auth"."uid"()) OR ("partner_id" = "auth"."uid"())));



CREATE POLICY "service_requests_update_policy" ON "public"."service_requests" FOR UPDATE USING ((("customer_id" = "auth"."uid"()) OR ("partner_id" = "auth"."uid"()))) WITH CHECK ((("customer_id" = "auth"."uid"()) OR ("partner_id" = "auth"."uid"())));



ALTER TABLE "public"."subscriptions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."work_orders" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "work_orders_select_policy" ON "public"."work_orders" FOR SELECT USING (true);



CREATE POLICY "work_orders_update_policy" ON "public"."work_orders" FOR UPDATE USING (true);



ALTER TABLE "public"."workflow_events_queue" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "workflow_events_queue_policy" ON "public"."workflow_events_queue" USING (true);



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."refresh_customer_sla_activation"("p_organization_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."refresh_customer_sla_activation"("p_organization_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."refresh_customer_sla_activation"("p_organization_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."reserve_inventory_for_order"("p_sku" "text", "p_quantity" integer, "p_order_id" "uuid", "p_actor_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."reserve_inventory_for_order"("p_sku" "text", "p_quantity" integer, "p_order_id" "uuid", "p_actor_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."reserve_inventory_for_order"("p_sku" "text", "p_quantity" integer, "p_order_id" "uuid", "p_actor_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."submit_customer_requirement_evidence"("p_requirement_item_id" "uuid", "p_document_id" "uuid", "p_storage_bucket" "text", "p_storage_path" "text", "p_file_name" "text", "p_mime_type" "text", "p_size_bytes" bigint, "p_customer_note" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."submit_customer_requirement_evidence"("p_requirement_item_id" "uuid", "p_document_id" "uuid", "p_storage_bucket" "text", "p_storage_path" "text", "p_file_name" "text", "p_mime_type" "text", "p_size_bytes" bigint, "p_customer_note" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."submit_customer_requirement_evidence"("p_requirement_item_id" "uuid", "p_document_id" "uuid", "p_storage_bucket" "text", "p_storage_path" "text", "p_file_name" "text", "p_mime_type" "text", "p_size_bytes" bigint, "p_customer_note" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_customer_provider_requests"("p_organization_id" "uuid", "p_customer_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."sync_customer_provider_requests"("p_organization_id" "uuid", "p_customer_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_customer_provider_requests"("p_organization_id" "uuid", "p_customer_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_customer_requirements"("p_organization_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."sync_customer_requirements"("p_organization_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_customer_requirements"("p_organization_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."touch_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."touch_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."touch_updated_at"() TO "service_role";



GRANT ALL ON TABLE "public"."activity_log" TO "anon";
GRANT ALL ON TABLE "public"."activity_log" TO "authenticated";
GRANT ALL ON TABLE "public"."activity_log" TO "service_role";



GRANT ALL ON TABLE "public"."anomaly_alerts" TO "anon";
GRANT ALL ON TABLE "public"."anomaly_alerts" TO "authenticated";
GRANT ALL ON TABLE "public"."anomaly_alerts" TO "service_role";



GRANT ALL ON TABLE "public"."automation_decisions" TO "anon";
GRANT ALL ON TABLE "public"."automation_decisions" TO "authenticated";
GRANT ALL ON TABLE "public"."automation_decisions" TO "service_role";



GRANT ALL ON TABLE "public"."automation_overrides" TO "anon";
GRANT ALL ON TABLE "public"."automation_overrides" TO "authenticated";
GRANT ALL ON TABLE "public"."automation_overrides" TO "service_role";



GRANT ALL ON TABLE "public"."automation_rules" TO "anon";
GRANT ALL ON TABLE "public"."automation_rules" TO "authenticated";
GRANT ALL ON TABLE "public"."automation_rules" TO "service_role";



GRANT ALL ON TABLE "public"."customer_intelligence_profiles" TO "anon";
GRANT ALL ON TABLE "public"."customer_intelligence_profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."customer_intelligence_profiles" TO "service_role";



GRANT ALL ON TABLE "public"."customer_onboarding_submissions" TO "anon";
GRANT ALL ON TABLE "public"."customer_onboarding_submissions" TO "authenticated";
GRANT ALL ON TABLE "public"."customer_onboarding_submissions" TO "service_role";



GRANT ALL ON TABLE "public"."customer_priority_scores" TO "anon";
GRANT ALL ON TABLE "public"."customer_priority_scores" TO "authenticated";
GRANT ALL ON TABLE "public"."customer_priority_scores" TO "service_role";



GRANT ALL ON TABLE "public"."customer_provider_requests" TO "anon";
GRANT ALL ON TABLE "public"."customer_provider_requests" TO "authenticated";
GRANT ALL ON TABLE "public"."customer_provider_requests" TO "service_role";



GRANT ALL ON TABLE "public"."customer_requirement_evidence" TO "anon";
GRANT ALL ON TABLE "public"."customer_requirement_evidence" TO "authenticated";
GRANT ALL ON TABLE "public"."customer_requirement_evidence" TO "service_role";



GRANT ALL ON TABLE "public"."customer_requirement_items" TO "anon";
GRANT ALL ON TABLE "public"."customer_requirement_items" TO "authenticated";
GRANT ALL ON TABLE "public"."customer_requirement_items" TO "service_role";



GRANT ALL ON TABLE "public"."customer_sla_activations" TO "anon";
GRANT ALL ON TABLE "public"."customer_sla_activations" TO "authenticated";
GRANT ALL ON TABLE "public"."customer_sla_activations" TO "service_role";



GRANT ALL ON TABLE "public"."documents" TO "anon";
GRANT ALL ON TABLE "public"."documents" TO "authenticated";
GRANT ALL ON TABLE "public"."documents" TO "service_role";



GRANT ALL ON TABLE "public"."fulfillment_logs" TO "anon";
GRANT ALL ON TABLE "public"."fulfillment_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."fulfillment_logs" TO "service_role";



GRANT ALL ON TABLE "public"."industry_taxonomy" TO "anon";
GRANT ALL ON TABLE "public"."industry_taxonomy" TO "authenticated";
GRANT ALL ON TABLE "public"."industry_taxonomy" TO "service_role";



GRANT ALL ON TABLE "public"."inventory_movements" TO "anon";
GRANT ALL ON TABLE "public"."inventory_movements" TO "authenticated";
GRANT ALL ON TABLE "public"."inventory_movements" TO "service_role";



GRANT ALL ON TABLE "public"."invitations" TO "anon";
GRANT ALL ON TABLE "public"."invitations" TO "authenticated";
GRANT ALL ON TABLE "public"."invitations" TO "service_role";



GRANT ALL ON TABLE "public"."invoice_line_items" TO "anon";
GRANT ALL ON TABLE "public"."invoice_line_items" TO "authenticated";
GRANT ALL ON TABLE "public"."invoice_line_items" TO "service_role";



GRANT ALL ON TABLE "public"."invoices" TO "anon";
GRANT ALL ON TABLE "public"."invoices" TO "authenticated";
GRANT ALL ON TABLE "public"."invoices" TO "service_role";



GRANT ALL ON TABLE "public"."notifications" TO "anon";
GRANT ALL ON TABLE "public"."notifications" TO "authenticated";
GRANT ALL ON TABLE "public"."notifications" TO "service_role";



GRANT ALL ON TABLE "public"."onboarding_anomaly_alerts" TO "anon";
GRANT ALL ON TABLE "public"."onboarding_anomaly_alerts" TO "authenticated";
GRANT ALL ON TABLE "public"."onboarding_anomaly_alerts" TO "service_role";



GRANT ALL ON TABLE "public"."order_workflow_step_events" TO "anon";
GRANT ALL ON TABLE "public"."order_workflow_step_events" TO "authenticated";
GRANT ALL ON TABLE "public"."order_workflow_step_events" TO "service_role";



GRANT ALL ON TABLE "public"."order_workflow_step_inputs" TO "anon";
GRANT ALL ON TABLE "public"."order_workflow_step_inputs" TO "authenticated";
GRANT ALL ON TABLE "public"."order_workflow_step_inputs" TO "service_role";



GRANT ALL ON TABLE "public"."organization_memberships" TO "anon";
GRANT ALL ON TABLE "public"."organization_memberships" TO "authenticated";
GRANT ALL ON TABLE "public"."organization_memberships" TO "service_role";



GRANT ALL ON TABLE "public"."organizations" TO "anon";
GRANT ALL ON TABLE "public"."organizations" TO "authenticated";
GRANT ALL ON TABLE "public"."organizations" TO "service_role";



GRANT ALL ON TABLE "public"."outbound_emails" TO "anon";
GRANT ALL ON TABLE "public"."outbound_emails" TO "authenticated";
GRANT ALL ON TABLE "public"."outbound_emails" TO "service_role";



GRANT ALL ON TABLE "public"."pick_tickets" TO "anon";
GRANT ALL ON TABLE "public"."pick_tickets" TO "authenticated";
GRANT ALL ON TABLE "public"."pick_tickets" TO "service_role";



GRANT ALL ON TABLE "public"."provider_workflow_handoffs" TO "anon";
GRANT ALL ON TABLE "public"."provider_workflow_handoffs" TO "authenticated";
GRANT ALL ON TABLE "public"."provider_workflow_handoffs" TO "service_role";



GRANT ALL ON TABLE "public"."purchase_order_items" TO "anon";
GRANT ALL ON TABLE "public"."purchase_order_items" TO "authenticated";
GRANT ALL ON TABLE "public"."purchase_order_items" TO "service_role";



GRANT ALL ON TABLE "public"."purchase_orders" TO "anon";
GRANT ALL ON TABLE "public"."purchase_orders" TO "authenticated";
GRANT ALL ON TABLE "public"."purchase_orders" TO "service_role";



GRANT ALL ON TABLE "public"."request_messages" TO "anon";
GRANT ALL ON TABLE "public"."request_messages" TO "authenticated";
GRANT ALL ON TABLE "public"."request_messages" TO "service_role";



GRANT ALL ON TABLE "public"."requirement_templates" TO "anon";
GRANT ALL ON TABLE "public"."requirement_templates" TO "authenticated";
GRANT ALL ON TABLE "public"."requirement_templates" TO "service_role";



GRANT ALL ON TABLE "public"."sales_order_items" TO "anon";
GRANT ALL ON TABLE "public"."sales_order_items" TO "authenticated";
GRANT ALL ON TABLE "public"."sales_order_items" TO "service_role";



GRANT ALL ON TABLE "public"."sales_orders" TO "anon";
GRANT ALL ON TABLE "public"."sales_orders" TO "authenticated";
GRANT ALL ON TABLE "public"."sales_orders" TO "service_role";



GRANT ALL ON TABLE "public"."sales_partner_handoffs" TO "anon";
GRANT ALL ON TABLE "public"."sales_partner_handoffs" TO "authenticated";
GRANT ALL ON TABLE "public"."sales_partner_handoffs" TO "service_role";



GRANT ALL ON TABLE "public"."service_packages" TO "anon";
GRANT ALL ON TABLE "public"."service_packages" TO "authenticated";
GRANT ALL ON TABLE "public"."service_packages" TO "service_role";



GRANT ALL ON TABLE "public"."service_partners" TO "anon";
GRANT ALL ON TABLE "public"."service_partners" TO "authenticated";
GRANT ALL ON TABLE "public"."service_partners" TO "service_role";



GRANT ALL ON TABLE "public"."service_requests" TO "anon";
GRANT ALL ON TABLE "public"."service_requests" TO "authenticated";
GRANT ALL ON TABLE "public"."service_requests" TO "service_role";



GRANT ALL ON TABLE "public"."subscriptions" TO "anon";
GRANT ALL ON TABLE "public"."subscriptions" TO "authenticated";
GRANT ALL ON TABLE "public"."subscriptions" TO "service_role";



GRANT ALL ON TABLE "public"."user_profiles" TO "anon";
GRANT ALL ON TABLE "public"."user_profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."user_profiles" TO "service_role";



GRANT ALL ON TABLE "public"."work_orders" TO "anon";
GRANT ALL ON TABLE "public"."work_orders" TO "authenticated";
GRANT ALL ON TABLE "public"."work_orders" TO "service_role";



GRANT ALL ON TABLE "public"."workflow_events_queue" TO "anon";
GRANT ALL ON TABLE "public"."workflow_events_queue" TO "authenticated";
GRANT ALL ON TABLE "public"."workflow_events_queue" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";
