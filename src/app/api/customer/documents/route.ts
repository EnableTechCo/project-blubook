import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

type DocumentRow = {
  id: string;
  organization_id: string | null;
  request_id: string | null;
  bucket: string;
  path: string;
  file_name: string;
  mime_type: string | null;
  size_bytes: number | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

type RequirementEvidenceRow = {
  storage_bucket: string | null;
  storage_path: string | null;
  requirement_item_id: string | null;
};

type RequirementItemRow = {
  id: string;
  evidence_type: string | null;
};

type PurchaseOrderDocRow = {
  customer_document_id: string | null;
};

type DocumentGroupKey =
  | "requirements-docs"
  | "service-request-docs"
  | "delivery-docs"
  | "purchase-orders"
  | "commercial-docs"
  | "compliance-docs";

function isDocumentGroupKey(value: string): value is DocumentGroupKey {
  return [
    "requirements-docs",
    "service-request-docs",
    "delivery-docs",
    "purchase-orders",
    "commercial-docs",
    "compliance-docs",
  ].includes(value);
}

const DOCUMENT_GROUP_LABELS: Record<DocumentGroupKey, string> = {
  "requirements-docs": "Requirements Docs",
  "service-request-docs": "Service Request Docs",
  "delivery-docs": "Delivery Docs",
  "purchase-orders": "Purchase Orders",
  "commercial-docs": "Commercial Docs",
  "compliance-docs": "Compliance Docs",
};

function normalizeText(input: string | null | undefined) {
  return (input ?? "").toLowerCase();
}

function hasAnyKeyword(input: string, keywords: string[]) {
  return keywords.some((keyword) => input.includes(keyword));
}

function makeStorageKey(
  bucket: string | null | undefined,
  path: string | null | undefined,
) {
  if (!bucket || !path) {
    return null;
  }

  return `${bucket}::${path}`;
}

function chunkArray<T>(items: T[], size: number) {
  if (size <= 0) {
    return [items];
  }

  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

function toPositiveInt(value: string | null, fallback: number) {
  const parsed = Number.parseInt(value ?? "", 10);
  if (Number.isNaN(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
}

export async function GET(request: Request) {
  try {
    const server = await createServerClient();
    const {
      data: { user },
    } = await server.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(request.url);
    const organizationId = url.searchParams.get("organizationId")?.trim() ?? "";
    const bucket = url.searchParams.get("bucket")?.trim() ?? "";
    const prefix = url.searchParams.get("prefix")?.trim() ?? "";
    const page = toPositiveInt(url.searchParams.get("page"), 1);
    const requestedPageSize = toPositiveInt(
      url.searchParams.get("pageSize"),
      15,
    );
    const pageSize = Math.min(Math.max(requestedPageSize, 10), 100);
    const groupParam = (url.searchParams.get("group") ?? "").trim();
    const selectedGroup = isDocumentGroupKey(groupParam) ? groupParam : null;
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    if (!organizationId) {
      return NextResponse.json(
        { error: "organizationId is required." },
        { status: 400 },
      );
    }

    const orgPrefix = `organizations/${organizationId}/`;
    if (prefix.length > 0 && !prefix.startsWith(orgPrefix)) {
      return NextResponse.json(
        { error: "Invalid prefix for organization scope." },
        { status: 400 },
      );
    }

    const admin = createAdminClient();

    const [{ data: profile }, { data: membership }] = await Promise.all([
      admin
        .from("user_profiles")
        .select("user_id")
        .eq("user_id", user.id)
        .eq("organization_id", organizationId)
        .maybeSingle(),
      admin
        .from("organization_memberships")
        .select("user_id")
        .eq("user_id", user.id)
        .eq("organization_id", organizationId)
        .eq("status", "active")
        .maybeSingle(),
    ]);

    if (!profile && !membership) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    let docsQuery = admin
      .from("documents")
      .select(
        "id, organization_id, request_id, bucket, path, file_name, mime_type, size_bytes, metadata, created_at, updated_at",
        { count: "exact" },
      )
      .order("updated_at", { ascending: false });

    if (bucket.length > 0) {
      docsQuery = docsQuery.eq("bucket", bucket);
    }

    if (prefix.length > 0) {
      docsQuery = docsQuery.like("path", `${prefix}/%`);
    }

    const {
      data: docs,
      error: docsError,
      count,
    } = await docsQuery.range(from, to);

    if (docsError) {
      return NextResponse.json({ error: docsError.message }, { status: 400 });
    }

    const docRows = (docs ?? []) as DocumentRow[];
    const total = count ?? 0;

    const allDocRows: DocumentRow[] = [];
    if (total > 0) {
      const chunkSize = 1000;
      for (let start = 0; start < total; start += chunkSize) {
        const end = Math.min(start + chunkSize - 1, total - 1);

        let allDocsQuery = admin
          .from("documents")
          .select(
            "id, organization_id, request_id, bucket, path, file_name, mime_type, size_bytes, metadata, created_at, updated_at",
          )
          .order("updated_at", { ascending: false });

        if (bucket.length > 0) {
          allDocsQuery = allDocsQuery.eq("bucket", bucket);
        }

        if (prefix.length > 0) {
          allDocsQuery = allDocsQuery.like("path", `${prefix}/%`);
        }

        const { data: chunkRows, error: chunkError } = await allDocsQuery.range(
          start,
          end,
        );

        if (chunkError) {
          return NextResponse.json(
            { error: chunkError.message },
            { status: 400 },
          );
        }

        allDocRows.push(...((chunkRows ?? []) as DocumentRow[]));
      }
    }

    const metricSourceRows = allDocRows.length > 0 ? allDocRows : docRows;

    const docIds = metricSourceRows.map((row) => row.id);
    const buckets = Array.from(
      new Set(metricSourceRows.map((row) => row.bucket)),
    );
    const paths = Array.from(new Set(metricSourceRows.map((row) => row.path)));

    const requirementEvidenceRows: RequirementEvidenceRow[] = [];
    if (buckets.length > 0 && paths.length > 0) {
      const pathChunks = chunkArray(paths, 100);
      for (const pathChunk of pathChunks) {
        const { data: evidenceRows, error: evidenceError } = await admin
          .from("customer_requirement_evidence")
          .select("storage_bucket, storage_path, requirement_item_id")
          .in("storage_bucket", buckets)
          .in("storage_path", pathChunk)
          .limit(2000);

        if (evidenceError) {
          return NextResponse.json(
            { error: evidenceError.message },
            { status: 400 },
          );
        }

        requirementEvidenceRows.push(
          ...((evidenceRows ?? []) as RequirementEvidenceRow[]),
        );
      }
    }

    const requirementItemIds = Array.from(
      new Set(
        requirementEvidenceRows
          .map((row) => row.requirement_item_id)
          .filter((value): value is string => Boolean(value)),
      ),
    );

    const poRequirementItemIds = new Set<string>();
    if (requirementItemIds.length > 0) {
      const requirementIdChunks = chunkArray(requirementItemIds, 500);
      for (const requirementIdChunk of requirementIdChunks) {
        const { data: itemRows } = await admin
          .from("customer_requirement_items")
          .select("id, evidence_type")
          .in("id", requirementIdChunk)
          .limit(2000);

        for (const row of (itemRows ?? []) as RequirementItemRow[]) {
          const type = (row.evidence_type ?? "").toLowerCase();
          if (
            type.includes("purchase_order") ||
            type.includes("purchase-order") ||
            (type.includes("purchase") && type.includes("order"))
          ) {
            poRequirementItemIds.add(row.id);
          }
        }
      }
    }

    const requirementEvidenceKeys = new Set(
      requirementEvidenceRows
        .filter(
          (row) => !poRequirementItemIds.has(row.requirement_item_id ?? ""),
        )
        .map((row) => makeStorageKey(row.storage_bucket, row.storage_path))
        .filter((value): value is string => Boolean(value)),
    );

    const purchaseOrderEvidenceKeys = new Set(
      requirementEvidenceRows
        .filter((row) =>
          poRequirementItemIds.has(row.requirement_item_id ?? ""),
        )
        .map((row) => makeStorageKey(row.storage_bucket, row.storage_path))
        .filter((value): value is string => Boolean(value)),
    );

    const purchaseOrderDocRows: PurchaseOrderDocRow[] = [];
    if (docIds.length > 0) {
      const docIdChunks = chunkArray(docIds, 500);
      for (const docIdChunk of docIdChunks) {
        const { data: poRows, error: poError } = await admin
          .from("purchase_orders")
          .select("customer_document_id")
          .in("customer_document_id", docIdChunk)
          .limit(2000);

        if (poError) {
          return NextResponse.json({ error: poError.message }, { status: 400 });
        }

        purchaseOrderDocRows.push(...((poRows ?? []) as PurchaseOrderDocRow[]));
      }
    }

    const purchaseOrderDocIds = new Set(
      purchaseOrderDocRows
        .map((row) => row.customer_document_id)
        .filter((value): value is string => Boolean(value)),
    );

    const buildResponseRow = (doc: DocumentRow) => {
      const documentType =
        typeof doc.metadata?.documentType === "string"
          ? doc.metadata.documentType
          : null;

      const documentTypeLabel =
        typeof doc.metadata?.documentTypeLabel === "string"
          ? doc.metadata.documentTypeLabel
          : null;

      const storageKey = makeStorageKey(doc.bucket, doc.path);
      const searchBlob = normalizeText(
        `${doc.file_name} ${doc.path} ${documentType ?? ""} ${documentTypeLabel ?? ""}`,
      );

      const isPurchaseOrder =
        purchaseOrderDocIds.has(doc.id) ||
        (Boolean(storageKey) &&
          purchaseOrderEvidenceKeys.has(storageKey as string));

      const isRequirementDoc =
        !isPurchaseOrder &&
        Boolean(storageKey) &&
        requirementEvidenceKeys.has(storageKey as string);

      const isCommercialDoc = hasAnyKeyword(searchBlob, ["invoice", "quote"]);

      const isDeliveryDoc = hasAnyKeyword(searchBlob, [
        "proof-of-delivery",
        "proof of delivery",
        "pod",
        "handover",
        "delivery",
      ]);

      const isComplianceDoc = hasAnyKeyword(searchBlob, [
        "license",
        "licence",
        "credential",
        "declaration",
        "compliance",
        "registration",
      ]);

      let groupKey: DocumentGroupKey = "service-request-docs";
      if (isPurchaseOrder) {
        groupKey = "purchase-orders";
      } else if (isRequirementDoc) {
        groupKey = "requirements-docs";
      } else if (isCommercialDoc) {
        groupKey = "commercial-docs";
      } else if (isDeliveryDoc) {
        groupKey = "delivery-docs";
      } else if (isComplianceDoc) {
        groupKey = "compliance-docs";
      } else if (doc.request_id) {
        groupKey = "service-request-docs";
      }

      return {
        name: doc.file_name,
        path: doc.path,
        size: doc.size_bytes ?? undefined,
        createdAt: doc.created_at,
        updatedAt: doc.updated_at,
        documentType: documentType ?? undefined,
        documentTypeLabel: documentTypeLabel ?? undefined,
        groupKey,
        groupLabel: DOCUMENT_GROUP_LABELS[groupKey],
      };
    };

    const rows = docRows.map(buildResponseRow);
    const metricRows = metricSourceRows.map(buildResponseRow);
    const groupedRows = selectedGroup
      ? metricRows.filter((row) => row.groupKey === selectedGroup)
      : metricRows;

    const paginatedRows = selectedGroup
      ? groupedRows.slice(from, to + 1)
      : rows;

    const byGroup = metricRows.reduce<Record<DocumentGroupKey, number>>(
      (acc, doc) => {
        const key = doc.groupKey;
        acc[key] = (acc[key] ?? 0) + 1;
        return acc;
      },
      {
        "requirements-docs": 0,
        "service-request-docs": 0,
        "delivery-docs": 0,
        "purchase-orders": 0,
        "commercial-docs": 0,
        "compliance-docs": 0,
      },
    );

    const paginationTotal = selectedGroup ? groupedRows.length : total;
    const totalPages =
      paginationTotal === 0 ? 1 : Math.ceil(paginationTotal / pageSize);

    return NextResponse.json({
      metrics: {
        total,
        pageCount: paginatedRows.length,
        byGroup,
      },
      pagination: {
        page,
        pageSize,
        total: paginationTotal,
        totalPages,
        hasPrevPage: page > 1,
        hasNextPage: page < totalPages,
      },
      filters: {
        selectedGroup,
        availableGroups: Object.entries(DOCUMENT_GROUP_LABELS).map(
          ([key, label]) => ({ key, label }),
        ),
      },
      documents: paginatedRows,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not load customer documents.",
      },
      { status: 500 },
    );
  }
}
