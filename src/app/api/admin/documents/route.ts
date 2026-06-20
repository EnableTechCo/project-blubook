import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

type DocumentRow = {
  id: string;
  organization_id: string | null;
  request_id: string | null;
  uploaded_by: string;
  bucket: string;
  path: string;
  file_name: string;
  mime_type: string | null;
  size_bytes: number | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

type OrganizationRow = {
  id: string;
  name: string;
};

type UserProfileRow = {
  user_id: string;
  full_name: string | null;
  email: string;
  organization_id: string | null;
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

type ServicePartnerRow = {
  id: string;
  name: string;
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

function toPositiveInt(value: string | null, fallback: number) {
  const parsed = Number.parseInt(value ?? "", 10);
  if (Number.isNaN(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
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

async function requireAdminOrStaff() {
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
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!profile || !["admin", "staff"].includes(profile.role)) {
    return {
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  return { admin };
}

export async function GET(request: Request) {
  try {
    const auth = await requireAdminOrStaff();
    if ("error" in auth) {
      return auth.error;
    }

    const url = new URL(request.url);
    const page = toPositiveInt(url.searchParams.get("page"), 1);
    const requestedPageSize = toPositiveInt(
      url.searchParams.get("pageSize"),
      15,
    );
    const pageSize = Math.min(Math.max(requestedPageSize, 10), 100);
    const search = (url.searchParams.get("search") ?? "").trim();
    const bucket = (url.searchParams.get("bucket") ?? "").trim();
    const groupParam = (url.searchParams.get("group") ?? "").trim();
    const selectedGroup = isDocumentGroupKey(groupParam) ? groupParam : null;
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    const documentSelectFields =
      "id, organization_id, request_id, uploaded_by, bucket, path, file_name, mime_type, size_bytes, metadata, created_at, updated_at";

    let docsQuery = auth.admin
      .from("documents")
      .select(documentSelectFields, { count: "exact" })
      .order("created_at", { ascending: false });

    if (search.length > 0) {
      docsQuery = docsQuery.ilike("file_name", `%${search}%`);
    }

    if (bucket.length > 0) {
      docsQuery = docsQuery.eq("bucket", bucket);
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

        let allDocsQuery = auth.admin
          .from("documents")
          .select(documentSelectFields)
          .order("created_at", { ascending: false });

        if (search.length > 0) {
          allDocsQuery = allDocsQuery.ilike("file_name", `%${search}%`);
        }

        if (bucket.length > 0) {
          allDocsQuery = allDocsQuery.eq("bucket", bucket);
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

    let bucketOptionsQuery = auth.admin
      .from("documents")
      .select("bucket")
      .limit(1000);
    if (search.length > 0) {
      bucketOptionsQuery = bucketOptionsQuery.ilike("file_name", `%${search}%`);
    }

    const { data: bucketRows } = await bucketOptionsQuery;
    const availableBuckets = Array.from(
      new Set(
        (bucketRows ?? [])
          .map((row) => (typeof row.bucket === "string" ? row.bucket : ""))
          .filter(Boolean),
      ),
    ).sort((a, b) => a.localeCompare(b));

    const UUID_RE =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    function extractOrgIdFromPath(path: string): string | null {
      // Paths follow: organizations/{org_id}/...
      const match = path.match(/^organizations\/([^/]+)/);
      if (match && UUID_RE.test(match[1])) return match[1];
      return null;
    }

    function extractPartnerIdFromPath(path: string): string | null {
      // Paths follow: partners/{partner_id}/...
      const match = path.match(/^partners\/([^/]+)/);
      if (match && UUID_RE.test(match[1])) return match[1];
      return null;
    }

    const organizationIds = Array.from(
      new Set(
        docRows
          .map(
            (row) =>
              row.organization_id ?? extractOrgIdFromPath(row.path ?? ""),
          )
          .filter((value): value is string => Boolean(value)),
      ),
    );

    let organizationRows: OrganizationRow[] = [];
    if (organizationIds.length > 0) {
      const { data: organizations, error: organizationsError } =
        await auth.admin
          .from("organizations")
          .select("id, name")
          .in("id", organizationIds);

      if (organizationsError) {
        return NextResponse.json(
          { error: organizationsError.message },
          { status: 400 },
        );
      }

      organizationRows = (organizations ?? []) as OrganizationRow[];
    }

    const organizationById = new Map(
      organizationRows.map((organization) => [organization.id, organization]),
    );

    const partnerIds = Array.from(
      new Set(
        docRows
          .map((row) => extractPartnerIdFromPath(row.path ?? ""))
          .filter((value): value is string => Boolean(value)),
      ),
    );

    let servicePartnerRows: ServicePartnerRow[] = [];
    if (partnerIds.length > 0) {
      const { data: partners, error: partnersError } = await auth.admin
        .from("service_partners")
        .select("id, name")
        .in("id", partnerIds);

      if (partnersError) {
        return NextResponse.json(
          { error: partnersError.message },
          { status: 400 },
        );
      }

      servicePartnerRows = (partners ?? []) as ServicePartnerRow[];
    }

    const servicePartnerById = new Map(
      servicePartnerRows.map((p) => [p.id, p]),
    );

    const uploaderIds = Array.from(
      new Set(
        docRows
          .map((row) => row.uploaded_by)
          .filter((value): value is string => Boolean(value)),
      ),
    );

    let userProfileRows: UserProfileRow[] = [];
    if (uploaderIds.length > 0) {
      const { data: profiles, error: profilesError } = await auth.admin
        .from("user_profiles")
        .select("user_id, full_name, email, organization_id")
        .in("user_id", uploaderIds);

      if (profilesError) {
        return NextResponse.json(
          { error: profilesError.message },
          { status: 400 },
        );
      }

      userProfileRows = (profiles ?? []) as UserProfileRow[];
    }

    const profileByUserId = new Map(
      userProfileRows.map((profile) => [profile.user_id, profile]),
    );

    const uploaderOrganizationIds = Array.from(
      new Set(
        userProfileRows
          .map((profile) => profile.organization_id)
          .filter((value): value is string => Boolean(value)),
      ),
    ).filter((id) => !organizationById.has(id));

    if (uploaderOrganizationIds.length > 0) {
      const { data: uploaderOrganizations, error: uploaderOrganizationsError } =
        await auth.admin
          .from("organizations")
          .select("id, name")
          .in("id", uploaderOrganizationIds);

      if (uploaderOrganizationsError) {
        return NextResponse.json(
          { error: uploaderOrganizationsError.message },
          { status: 400 },
        );
      }

      for (const org of (uploaderOrganizations ?? []) as OrganizationRow[]) {
        organizationById.set(org.id, org);
      }
    }

    const buckets = Array.from(
      new Set(metricSourceRows.map((row) => row.bucket)),
    );
    const paths = Array.from(new Set(metricSourceRows.map((row) => row.path)));
    const docIds = metricSourceRows.map((row) => row.id);

    const requirementEvidenceRows: RequirementEvidenceRow[] = [];
    if (buckets.length > 0 && paths.length > 0) {
      const pathChunks = chunkArray(paths, 100);
      for (const pathChunk of pathChunks) {
        const { data: evidenceRows, error: evidenceError } = await auth.admin
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

    // Fetch requirement items to determine which evidence rows are PO-type.
    // purchase_orders upserts on conflict(sales_order_id), so only the LATEST
    // PO upload has a customer_document_id link. All previous uploads are only
    // traceable through customer_requirement_items.evidence_type.
    const requirementItemIds = Array.from(
      new Set(
        requirementEvidenceRows
          .map((row) => row.requirement_item_id)
          .filter((v): v is string => Boolean(v)),
      ),
    );

    const poRequirementItemIds = new Set<string>();
    if (requirementItemIds.length > 0) {
      const requirementIdChunks = chunkArray(requirementItemIds, 500);
      for (const requirementIdChunk of requirementIdChunks) {
        const { data: itemRows } = await auth.admin
          .from("customer_requirement_items")
          .select("id, evidence_type")
          .in("id", requirementIdChunk)
          .limit(2000);
        for (const row of (itemRows ?? []) as RequirementItemRow[]) {
          const t = (row.evidence_type ?? "").toLowerCase();
          if (
            t.includes("purchase_order") ||
            t.includes("purchase-order") ||
            (t.includes("purchase") && t.includes("order"))
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
        const { data: poRows, error: poError } = await auth.admin
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
      const uploader = doc.uploaded_by
        ? (profileByUserId.get(doc.uploaded_by) ?? null)
        : null;
      const resolvedOrgId =
        doc.organization_id ??
        extractOrgIdFromPath(doc.path ?? "") ??
        uploader?.organization_id ??
        null;
      const resolvedPartnerId = extractPartnerIdFromPath(doc.path ?? "");
      const organization =
        (resolvedOrgId ? organizationById.get(resolvedOrgId) : null) ??
        (resolvedPartnerId
          ? (servicePartnerById.get(resolvedPartnerId) ?? null)
          : null);

      const documentType =
        doc.metadata &&
        typeof doc.metadata === "object" &&
        typeof doc.metadata.documentType === "string"
          ? doc.metadata.documentType
          : null;

      const documentTypeLabel =
        doc.metadata &&
        typeof doc.metadata === "object" &&
        typeof doc.metadata.documentTypeLabel === "string"
          ? doc.metadata.documentTypeLabel
          : null;

      const storageKey = makeStorageKey(doc.bucket, doc.path);

      const searchBlob = normalizeText(
        `${doc.file_name} ${doc.path} ${documentType ?? ""} ${documentTypeLabel ?? ""}`,
      );

      // A doc is a PO if:
      // 1. It is the current linked doc in purchase_orders.customer_document_id, OR
      // 2. It was uploaded as evidence for a PO-type requirement item
      //    (catches previous uploads superseded by newer PO upserts)
      const isPurchaseOrder =
        purchaseOrderDocIds.has(doc.id) ||
        (Boolean(storageKey) &&
          purchaseOrderEvidenceKeys.has(storageKey as string));

      // Only a requirement doc if NOT a PO
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
        id: doc.id,
        fileName: doc.file_name,
        bucket: doc.bucket,
        mimeType: doc.mime_type,
        sizeBytes: doc.size_bytes,
        documentType,
        documentTypeLabel,
        groupKey,
        groupLabel: DOCUMENT_GROUP_LABELS[groupKey],
        organizationId: doc.organization_id,
        organizationName: organization?.name ?? null,
        uploaderEmail: uploader?.email ?? null,
        uploaderName: uploader?.full_name ?? null,
        createdAt: doc.created_at,
        updatedAt: doc.updated_at,
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

    const mimeGroups = paginatedRows.reduce<Record<string, number>>(
      (acc, row) => {
        const key = row.mimeType ?? "unknown";
        acc[key] = (acc[key] ?? 0) + 1;
        return acc;
      },
      {},
    );

    const byGroup = metricRows.reduce<Record<DocumentGroupKey, number>>(
      (acc, row) => {
        acc[row.groupKey] = (acc[row.groupKey] ?? 0) + 1;
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

    const totalSizeBytes = paginatedRows.reduce(
      (sum, row) => sum + (row.sizeBytes ?? 0),
      0,
    );

    const paginationTotal = selectedGroup ? groupedRows.length : total;
    const totalPages =
      paginationTotal === 0 ? 1 : Math.ceil(paginationTotal / pageSize);

    return NextResponse.json({
      metrics: {
        total,
        pageCount: paginatedRows.length,
        totalSizeBytes,
        byMimeType: mimeGroups,
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
        search,
        bucket,
        selectedGroup,
        availableBuckets,
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
          error instanceof Error ? error.message : "Could not load documents.",
      },
      { status: 500 },
    );
  }
}
