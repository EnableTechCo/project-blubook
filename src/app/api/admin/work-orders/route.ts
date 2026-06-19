import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

type WorkOrderRow = {
  id: string;
  order_item_id: string;
  status: string;
  quantity_to_build: number;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

type SalesOrderItemRow = {
  id: string;
  order_id: string;
  product_name: string | null;
  sku: string | null;
  quantity: number | null;
  fulfillment_route: string | null;
};

type SalesOrderRow = {
  id: string;
  po_reference: string | null;
  status: string;
  organization_id: string;
};

type OrganizationRow = {
  id: string;
  name: string;
};

type PurchaseOrderRow = {
  id: string;
  sales_order_id: string;
  customer_document_id: string | null;
  po_number: string | null;
};

type DocumentRow = {
  id: string;
  bucket: string;
  path: string;
  file_name: string | null;
};

type HandoffRow = {
  id: string;
  sales_order_id: string;
  order_item_id: string;
  status: string;
  package_stream: string | null;
  assigned_at: string | null;
  completed_at: string | null;
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

function isCompletedStatus(status: string) {
  const normalized = status.toLowerCase();
  return (
    normalized.includes("complete") ||
    normalized.includes("done") ||
    normalized.includes("delivered")
  );
}

function isBlockedStatus(status: string) {
  const normalized = status.toLowerCase();
  return (
    normalized.includes("reject") ||
    normalized.includes("fail") ||
    normalized.includes("blocked") ||
    normalized.includes("cancel")
  );
}

export async function GET() {
  try {
    const auth = await requireAdminOrStaff();
    if ("error" in auth) {
      return auth.error;
    }

    const { data: workOrders, error: workOrdersError } = await auth.admin
      .from("work_orders")
      .select(
        "id, order_item_id, status, quantity_to_build, completed_at, created_at, updated_at",
      )
      .order("updated_at", { ascending: false })
      .limit(250);

    if (workOrdersError) {
      return NextResponse.json(
        { error: workOrdersError.message },
        { status: 400 },
      );
    }

    const workOrderRows = (workOrders ?? []) as WorkOrderRow[];

    let handoffRows: HandoffRow[] = [];
    if (workOrderRows.length === 0) {
      const { data: handoffs, error: handoffsError } = await auth.admin
        .from("provider_workflow_handoffs")
        .select(
          "id, sales_order_id, order_item_id, status, package_stream, assigned_at, completed_at",
        )
        .order("assigned_at", { ascending: false })
        .limit(250);

      if (handoffsError) {
        return NextResponse.json(
          { error: handoffsError.message },
          { status: 400 },
        );
      }

      handoffRows = (handoffs ?? []) as HandoffRow[];
    }

    const orderItemIds = Array.from(
      new Set(
        [
          ...workOrderRows.map((row) => row.order_item_id),
          ...handoffRows.map((row) => row.order_item_id),
        ].filter((value): value is string => Boolean(value)),
      ),
    );

    let itemRows: SalesOrderItemRow[] = [];
    if (orderItemIds.length > 0) {
      const { data: items, error: itemsError } = await auth.admin
        .from("sales_order_items")
        .select("id, order_id, product_name, sku, quantity, fulfillment_route")
        .in("id", orderItemIds);

      if (itemsError) {
        return NextResponse.json(
          { error: itemsError.message },
          { status: 400 },
        );
      }

      itemRows = (items ?? []) as SalesOrderItemRow[];
    }

    const itemsById = new Map(itemRows.map((row) => [row.id, row]));

    const orderIds = Array.from(
      new Set([
        ...itemRows
          .map((row) => row.order_id)
          .filter((value): value is string => Boolean(value)),
        ...handoffRows
          .map((row) => row.sales_order_id)
          .filter((value): value is string => Boolean(value)),
      ]),
    );

    let orderRows: SalesOrderRow[] = [];
    if (orderIds.length > 0) {
      const { data: orders, error: ordersError } = await auth.admin
        .from("sales_orders")
        .select("id, po_reference, status, organization_id")
        .in("id", orderIds);

      if (ordersError) {
        return NextResponse.json(
          { error: ordersError.message },
          { status: 400 },
        );
      }

      orderRows = (orders ?? []) as SalesOrderRow[];
    }

    const ordersById = new Map(orderRows.map((row) => [row.id, row]));

    const organizationIds = Array.from(
      new Set(
        orderRows
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

    const poDocByOrderId = new Map<
      string,
      { fileName: string; signedUrl: string }
    >();

    if (orderIds.length > 0) {
      const { data: purchaseOrders, error: purchaseOrdersError } =
        await auth.admin
          .from("purchase_orders")
          .select("id, sales_order_id, customer_document_id, po_number")
          .in("sales_order_id", orderIds);

      if (purchaseOrdersError) {
        return NextResponse.json(
          { error: purchaseOrdersError.message },
          { status: 400 },
        );
      }

      const purchaseOrderRows = (purchaseOrders ?? []) as PurchaseOrderRow[];
      const docIds = Array.from(
        new Set(
          purchaseOrderRows
            .map((row) => row.customer_document_id)
            .filter((value): value is string => Boolean(value)),
        ),
      );

      let documentRows: DocumentRow[] = [];
      if (docIds.length > 0) {
        const { data: documents, error: documentsError } = await auth.admin
          .from("documents")
          .select("id, bucket, path, file_name")
          .in("id", docIds);

        if (documentsError) {
          return NextResponse.json(
            { error: documentsError.message },
            { status: 400 },
          );
        }

        documentRows = (documents ?? []) as DocumentRow[];
      }

      const documentById = new Map(documentRows.map((row) => [row.id, row]));

      for (const po of purchaseOrderRows) {
        if (!po.customer_document_id) {
          continue;
        }

        const doc = documentById.get(po.customer_document_id);
        if (!doc) {
          continue;
        }

        const { data: signedData } = await auth.admin.storage
          .from(doc.bucket)
          .createSignedUrl(doc.path, 60 * 30);

        if (signedData?.signedUrl) {
          poDocByOrderId.set(po.sales_order_id, {
            fileName:
              doc.file_name ?? doc.path.split("/").pop() ?? "Purchase Order",
            signedUrl: signedData.signedUrl,
          });
        }
      }
    }

    const baseRows = workOrderRows.map((workOrder) => {
      const item = itemsById.get(workOrder.order_item_id) ?? null;
      const order = item ? (ordersById.get(item.order_id) ?? null) : null;
      const customer = order
        ? (organizationById.get(order.organization_id) ?? null)
        : null;

      return {
        id: workOrder.id,
        status: workOrder.status,
        quantityToBuild: workOrder.quantity_to_build,
        completedAt: workOrder.completed_at,
        createdAt: workOrder.created_at,
        updatedAt: workOrder.updated_at,
        source: "work_order" as const,
        packageStream: item?.fulfillment_route ?? null,
        orderItemId: workOrder.order_item_id,
        productName: item?.product_name ?? null,
        sku: item?.sku ?? null,
        itemQuantity: item?.quantity ?? null,
        salesOrderId: order?.id ?? null,
        poReference: order?.po_reference ?? null,
        salesOrderStatus: order?.status ?? null,
        customerName: customer?.name ?? null,
        poDocument: order?.id ? (poDocByOrderId.get(order.id) ?? null) : null,
      };
    });

    const fallbackRows =
      baseRows.length > 0
        ? []
        : handoffRows.map((handoff) => {
            const item = itemsById.get(handoff.order_item_id) ?? null;
            const order = handoff.sales_order_id
              ? (ordersById.get(handoff.sales_order_id) ?? null)
              : item
                ? (ordersById.get(item.order_id) ?? null)
                : null;
            const customer = order
              ? (organizationById.get(order.organization_id) ?? null)
              : null;

            return {
              id: handoff.id,
              status: handoff.status,
              quantityToBuild: item?.quantity ?? 1,
              completedAt: handoff.completed_at,
              createdAt: handoff.assigned_at,
              updatedAt: handoff.completed_at ?? handoff.assigned_at,
              source: "handoff" as const,
              packageStream:
                handoff.package_stream ?? item?.fulfillment_route ?? null,
              orderItemId: handoff.order_item_id,
              productName: item?.product_name ?? null,
              sku: item?.sku ?? null,
              itemQuantity: item?.quantity ?? null,
              salesOrderId: order?.id ?? null,
              poReference: order?.po_reference ?? null,
              salesOrderStatus: order?.status ?? null,
              customerName: customer?.name ?? null,
              poDocument: order?.id
                ? (poDocByOrderId.get(order.id) ?? null)
                : null,
            };
          });

    const rows = [...baseRows, ...fallbackRows];

    const completed = rows.filter(
      (row) => Boolean(row.completedAt) || isCompletedStatus(row.status),
    ).length;
    const blocked = rows.filter((row) => isBlockedStatus(row.status)).length;
    const active = Math.max(0, rows.length - completed - blocked);

    return NextResponse.json({
      metrics: {
        total: rows.length,
        active,
        completed,
        blocked,
      },
      workOrders: rows,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not load work orders.",
      },
      { status: 500 },
    );
  }
}
