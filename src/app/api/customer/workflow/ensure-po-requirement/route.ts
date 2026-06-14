import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

function isPurchaseOrderShape(input: { title: string; evidenceType: string }) {
  const title = input.title.toLowerCase();
  const evidenceType = input.evidenceType.toLowerCase();

  return (
    title.includes("purchase order") ||
    title.includes("purchase-order") ||
    evidenceType.includes("purchase_order") ||
    (evidenceType.includes("purchase") && evidenceType.includes("order"))
  );
}

function isPendingRequirementStatus(status: string) {
  return status === "missing" || status === "rejected";
}

function stripWorkflowKickoffMetadata(metadata: unknown) {
  if (!metadata || typeof metadata !== "object") {
    return {} as Record<string, unknown>;
  }

  const cleaned = { ...(metadata as Record<string, unknown>) };
  delete cleaned.sales_order_id;
  delete cleaned.po_reference;
  delete cleaned.workflow_kickoff_source;
  delete cleaned.preferred_logistics_partner_email;
  delete cleaned.preferred_sales_partner_email;
  return cleaned;
}

export async function POST(request: Request) {
  try {
    if (process.env.NODE_ENV === "production") {
      return NextResponse.json({ error: "Not available." }, { status: 404 });
    }

    const server = await createServerClient();
    const {
      data: { user },
    } = await server.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = createAdminClient();

    const { data: profile } = await admin
      .from("user_profiles")
      .select("organization_id, role")
      .eq("user_id", user.id)
      .maybeSingle();

    let organizationId = profile?.organization_id ?? null;
    const role = profile?.role ?? null;

    if (!organizationId) {
      const { data: membership } = await admin
        .from("organization_memberships")
        .select("organization_id")
        .eq("user_id", user.id)
        .eq("status", "active")
        .maybeSingle();
      organizationId = membership?.organization_id ?? null;
    }

    if (!organizationId || role !== "customer") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { data: existingRequirements } = await admin
      .from("customer_requirement_items")
      .select(
        "id, onboarding_submission_id, package_id, template_id, package_stream, provider_id, title, description, why_required, evidence_type, sort_order, is_required, status, metadata",
      )
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false });

    const existingPoRequirement = (existingRequirements ?? []).find((item) => {
      const isPo = isPurchaseOrderShape({
        title: item.title,
        evidenceType: item.evidence_type,
      });
      return isPo;
    });

    if (existingPoRequirement?.id) {
      const metadata = {
        ...stripWorkflowKickoffMetadata(existingPoRequirement.metadata),
        source: "e2e-po-workflow-setup",
      };

      if (
        !isPendingRequirementStatus(existingPoRequirement.status) ||
        !existingPoRequirement.is_required
      ) {
        const { error: resetError } = await admin
          .from("customer_requirement_items")
          .update({
            is_required: true,
            metadata,
            ...(isPendingRequirementStatus(existingPoRequirement.status)
              ? {}
              : {
                  status: "missing",
                  status_reason: "Reset for workflow E2E validation.",
                  submitted_at: null,
                  approved_at: null,
                  rejected_at: null,
                }),
          })
          .eq("id", existingPoRequirement.id);

        if (resetError) {
          return NextResponse.json(
            { error: resetError.message },
            { status: 400 },
          );
        }
      } else {
        const { error: resetError } = await admin
          .from("customer_requirement_items")
          .update({ metadata })
          .eq("id", existingPoRequirement.id);

        if (resetError) {
          return NextResponse.json(
            { error: resetError.message },
            { status: 400 },
          );
        }
      }

      return NextResponse.json({
        ok: true,
        requirementId: existingPoRequirement.id,
      });
    }

    const { data: poTemplate } = await admin
      .from("requirement_templates")
      .select(
        "id, package_stream, provider_id, title, description, why_required, evidence_type, is_required, sort_order, metadata",
      )
      .eq("is_active", true)
      .order("sort_order", { ascending: true });

    const selectedTemplate = (poTemplate ?? []).find((item) =>
      isPurchaseOrderShape({
        title: item.title,
        evidenceType: item.evidence_type,
      }),
    );

    const fallbackTemplate = selectedTemplate
      ? null
      : ((poTemplate ?? [])[0] ?? null);

    const fallbackRequirement = selectedTemplate
      ? null
      : ((existingRequirements ?? [])[0] ?? null);

    const templateId =
      selectedTemplate?.id ??
      fallbackRequirement?.template_id ??
      fallbackTemplate?.id ??
      null;

    if (!templateId) {
      return NextResponse.json(
        {
          error:
            "No requirement template or existing requirement seed found for PO setup.",
        },
        { status: 404 },
      );
    }

    const { data: seedReference } = await admin
      .from("customer_requirement_items")
      .select("onboarding_submission_id, package_id")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const { data: insertedRequirement, error: insertError } = await admin
      .from("customer_requirement_items")
      .insert({
        organization_id: organizationId,
        onboarding_submission_id:
          seedReference?.onboarding_submission_id ??
          fallbackRequirement?.onboarding_submission_id ??
          null,
        package_id: seedReference?.package_id ?? null,
        template_id: templateId,
        package_stream:
          selectedTemplate?.package_stream ??
          fallbackRequirement?.package_stream ??
          fallbackTemplate?.package_stream ??
          "Sales Ops",
        provider_id:
          selectedTemplate?.provider_id ??
          fallbackRequirement?.provider_id ??
          fallbackTemplate?.provider_id ??
          null,
        title: "Purchase Order Upload",
        description:
          selectedTemplate?.description ??
          fallbackRequirement?.description ??
          "Upload your purchase order to start workflow execution.",
        why_required:
          selectedTemplate?.why_required ??
          fallbackRequirement?.why_required ??
          "A purchase order is required before execution can begin.",
        evidence_type: "purchase_order",
        is_required: true,
        sort_order:
          selectedTemplate?.sort_order ??
          fallbackRequirement?.sort_order ??
          fallbackTemplate?.sort_order ??
          999,
        status: "missing",
        status_reason: "Provisioned for workflow E2E validation.",
        metadata: {
          ...(selectedTemplate?.metadata &&
          typeof selectedTemplate.metadata === "object"
            ? selectedTemplate.metadata
            : fallbackRequirement?.metadata &&
                typeof fallbackRequirement.metadata === "object"
              ? fallbackRequirement.metadata
              : fallbackTemplate?.metadata &&
                  typeof fallbackTemplate.metadata === "object"
                ? fallbackTemplate.metadata
                : {}),
          source: "e2e-po-workflow-setup",
          synthetic_purchase_order_requirement: !selectedTemplate,
        },
      })
      .select("id")
      .single();

    if (insertError || !insertedRequirement?.id) {
      const duplicateConflict =
        insertError?.code === "23505" ||
        (typeof insertError?.message === "string" &&
          insertError.message.includes(
            "idx_customer_requirement_items_unique",
          ));

      if (duplicateConflict) {
        const { data: conflictRequirements } = await admin
          .from("customer_requirement_items")
          .select(
            "id, template_id, title, evidence_type, is_required, status, metadata",
          )
          .eq("organization_id", organizationId)
          .order("created_at", { ascending: false });

        const conflictByTemplate = (conflictRequirements ?? []).find(
          (item) => item.template_id === templateId,
        );

        if (conflictByTemplate?.id) {
          const metadata = {
            ...stripWorkflowKickoffMetadata(conflictByTemplate.metadata),
            source: "e2e-po-workflow-setup",
          };

          const { error: resetError } = await admin
            .from("customer_requirement_items")
            .update({
              title: "Purchase Order Upload",
              evidence_type: "purchase_order",
              is_required: true,
              metadata,
              ...(isPendingRequirementStatus(conflictByTemplate.status)
                ? {}
                : {
                    status: "missing",
                    status_reason: "Reset for workflow E2E validation.",
                    submitted_at: null,
                    approved_at: null,
                    rejected_at: null,
                  }),
            })
            .eq("id", conflictByTemplate.id);

          if (resetError) {
            return NextResponse.json(
              { error: resetError.message },
              { status: 400 },
            );
          }

          return NextResponse.json({
            ok: true,
            requirementId: conflictByTemplate.id,
          });
        }

        const conflictPoRequirement = (conflictRequirements ?? []).find(
          (item) =>
            isPurchaseOrderShape({
              title: item.title,
              evidenceType: item.evidence_type,
            }),
        );

        if (conflictPoRequirement?.id) {
          const metadata = {
            ...stripWorkflowKickoffMetadata(conflictPoRequirement.metadata),
            source: "e2e-po-workflow-setup",
          };

          if (
            !isPendingRequirementStatus(conflictPoRequirement.status) ||
            !conflictPoRequirement.is_required
          ) {
            const { error: resetError } = await admin
              .from("customer_requirement_items")
              .update({
                is_required: true,
                metadata,
                ...(isPendingRequirementStatus(conflictPoRequirement.status)
                  ? {}
                  : {
                      status: "missing",
                      status_reason: "Reset for workflow E2E validation.",
                      submitted_at: null,
                      approved_at: null,
                      rejected_at: null,
                    }),
              })
              .eq("id", conflictPoRequirement.id);

            if (resetError) {
              return NextResponse.json(
                { error: resetError.message },
                { status: 400 },
              );
            }
          } else {
            const { error: resetError } = await admin
              .from("customer_requirement_items")
              .update({ metadata })
              .eq("id", conflictPoRequirement.id);

            if (resetError) {
              return NextResponse.json(
                { error: resetError.message },
                { status: 400 },
              );
            }
          }

          return NextResponse.json({
            ok: true,
            requirementId: conflictPoRequirement.id,
          });
        }
      }

      return NextResponse.json(
        { error: insertError?.message ?? "Could not create PO requirement." },
        { status: 400 },
      );
    }

    return NextResponse.json({
      ok: true,
      requirementId: insertedRequirement.id,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not ensure PO requirement.",
      },
      { status: 500 },
    );
  }
}
