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
};

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

export async function GET() {
  try {
    const auth = await requireAdminOrStaff();
    if ("error" in auth) {
      return auth.error;
    }

    const { data: docs, error: docsError } = await auth.admin
      .from("documents")
      .select(
        "id, organization_id, request_id, uploaded_by, bucket, path, file_name, mime_type, size_bytes, metadata, created_at, updated_at",
      )
      .order("created_at", { ascending: false })
      .limit(250);

    if (docsError) {
      return NextResponse.json({ error: docsError.message }, { status: 400 });
    }

    const docRows = (docs ?? []) as DocumentRow[];

    const organizationIds = Array.from(
      new Set(
        docRows
          .map((row) => row.organization_id)
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
        .select("user_id, full_name, email")
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

    const rows = docRows.map((doc) => {
      const organization = doc.organization_id
        ? (organizationById.get(doc.organization_id) ?? null)
        : null;
      const uploader = doc.uploaded_by
        ? (profileByUserId.get(doc.uploaded_by) ?? null)
        : null;

      const documentType =
        doc.metadata &&
        typeof doc.metadata === "object" &&
        typeof doc.metadata.documentType === "string"
          ? doc.metadata.documentType
          : null;

      return {
        id: doc.id,
        fileName: doc.file_name,
        bucket: doc.bucket,
        mimeType: doc.mime_type,
        sizeBytes: doc.size_bytes,
        documentType,
        organizationId: doc.organization_id,
        organizationName: organization?.name ?? null,
        uploaderEmail: uploader?.email ?? null,
        uploaderName: uploader?.full_name ?? null,
        createdAt: doc.created_at,
        updatedAt: doc.updated_at,
      };
    });

    const mimeGroups = rows.reduce<Record<string, number>>((acc, row) => {
      const key = row.mimeType ?? "unknown";
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {});

    const totalSizeBytes = rows.reduce(
      (sum, row) => sum + (row.sizeBytes ?? 0),
      0,
    );

    return NextResponse.json({
      metrics: {
        total: rows.length,
        totalSizeBytes,
        byMimeType: mimeGroups,
      },
      documents: rows,
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
