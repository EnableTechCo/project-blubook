import { promises as fs } from "node:fs";
import path from "node:path";
import { expect, test, type Browser, type Page } from "@playwright/test";

const CUSTOMER_EMAIL = process.env.E2E_CUSTOMER_EMAIL ?? "ignatius@e-t.co.za";
const CUSTOMER_PASSWORD = process.env.E2E_CUSTOMER_PASSWORD ?? "DBPass123!";

const SALES_EMAIL =
  process.env.E2E_SALES_EMAIL ?? "sales-ticks.partner@mock.blubook.local";
const SALES_PASSWORD = process.env.E2E_SALES_PASSWORD ?? "DBPass123!";

const LOGISTICS_EMAIL =
  process.env.E2E_LOGISTICS_EMAIL ?? "logistics.partner@mock.blubook.local";
const LOGISTICS_PASSWORD = process.env.E2E_LOGISTICS_PASSWORD ?? "DBPass123!";

function toDiagnosticJson(value: unknown) {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

async function gotoWithRetry(page: Page, path: string) {
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      await page.goto(path, {
        waitUntil: "domcontentloaded",
        timeout: 120000,
      });
      return;
    } catch (error) {
      if (attempt === 2) {
        throw error;
      }

      await page.goto("/partner/dashboard", {
        waitUntil: "domcontentloaded",
        timeout: 120000,
      });
    }
  }
}

async function fetchPartnerDashboardDiagnostics(
  page: Page,
  poReference: string,
) {
  const response = await page.request.get("/api/partner/dashboard");
  const rawBody = await response.text().catch(() => "<no-body>");

  let parsed: unknown = null;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    parsed = null;
  }

  const requests = Array.isArray(
    (parsed as { requests?: unknown } | null)?.requests,
  )
    ? (((parsed as { requests?: unknown[] }).requests ?? []) as Array<
        Record<string, unknown>
      >)
    : [];

  return {
    status: response.status(),
    requestCount: requests.length,
    containsPoReference: rawBody.includes(poReference),
    requestStatusBreakdown: requests.reduce<Record<string, number>>(
      (acc, req) => {
        const status =
          typeof req.requestStatus === "string" ? req.requestStatus : "unknown";
        acc[status] = (acc[status] ?? 0) + 1;
        return acc;
      },
      {},
    ),
    sampleRequests: requests.slice(0, 5).map((req) => ({
      id: typeof req.id === "string" ? req.id : null,
      organization:
        typeof req.organizationName === "string"
          ? req.organizationName
          : typeof req.organizationId === "string"
            ? req.organizationId
            : null,
      packageStream:
        typeof req.packageStream === "string" ? req.packageStream : null,
      requestStatus:
        typeof req.requestStatus === "string" ? req.requestStatus : null,
      requiredDocsPending:
        typeof req.requiredDocsPending === "number"
          ? req.requiredDocsPending
          : null,
      requiredDocsTotal:
        typeof req.requiredDocsTotal === "number"
          ? req.requiredDocsTotal
          : null,
    })),
  };
}

async function fetchPartnerWorkOrdersDiagnostics(
  page: Page,
  poReference: string,
) {
  const response = await page.request.get("/api/partner/work-orders");
  const rawBody = await response.text().catch(() => "<no-body>");

  let parsed: unknown = null;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    parsed = null;
  }

  const handoffs = Array.isArray(
    (parsed as { inboundProviderHandoffs?: unknown } | null)
      ?.inboundProviderHandoffs,
  )
    ? (((parsed as { inboundProviderHandoffs?: unknown[] })
        .inboundProviderHandoffs ?? []) as Array<Record<string, unknown>>)
    : [];

  const sample = handoffs.slice(0, 5).map((handoff) => {
    const salesOrderItems = Array.isArray(handoff.sales_order_items)
      ? (handoff.sales_order_items as Array<Record<string, unknown>>)
      : [];

    const poReferenceFromItems = salesOrderItems
      .map((item) => {
        const salesOrders = Array.isArray(item.sales_orders)
          ? (item.sales_orders[0] as Record<string, unknown> | undefined)
          : (item.sales_orders as Record<string, unknown> | undefined);

        return typeof salesOrders?.po_reference === "string"
          ? salesOrders.po_reference
          : null;
      })
      .find((value): value is string => Boolean(value));

    return {
      id: typeof handoff.id === "string" ? handoff.id : null,
      status: typeof handoff.status === "string" ? handoff.status : null,
      handoffType:
        typeof handoff.handoff_type === "string" ? handoff.handoff_type : null,
      packageStream:
        typeof handoff.package_stream === "string"
          ? handoff.package_stream
          : null,
      poReference: poReferenceFromItems,
    };
  });

  return {
    status: response.status(),
    handoffCount: handoffs.length,
    containsPoReference: rawBody.includes(poReference),
    sampleHandoffs: sample,
  };
}

function deriveExpectedPoReference(fileName: string) {
  const cleaned = fileName
    .replace(/\.[^.]+$/, "")
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/(^-|-$)/g, "")
    .toUpperCase()
    .slice(0, 24);

  return cleaned.length > 0 ? `PO-${cleaned}` : null;
}

async function login(page: Page, email: string, password: string) {
  await page.goto("/login", { waitUntil: "domcontentloaded" });
  await page
    .waitForLoadState("networkidle", { timeout: 10000 })
    .catch(() => undefined);

  const emailByLabel = page.getByLabel("Email address", { exact: true });
  const passwordByLabel = page.getByLabel("Password", { exact: true });

  if ((await emailByLabel.count()) > 0) {
    await emailByLabel.fill(email);
    await passwordByLabel.fill(password);
  } else {
    await page.locator("#login-email").fill(email);
    await page.locator("#login-password").fill(password);
  }

  const loginStatus = page.locator("p.text-red-300").first();

  const waitForLoginTransition = async () => {
    await page
      .waitForURL((url) => !/\/login(?:\?|$)/.test(url.pathname + url.search), {
        timeout: 15000,
      })
      .catch(() => undefined);
  };

  const readLoginStatusText = async () => {
    if ((await loginStatus.count()) === 0) {
      return null;
    }

    return (await loginStatus.textContent().catch(() => null))?.trim() ?? null;
  };

  await page
    .getByRole("button", { name: "Login", exact: true })
    .click({ noWaitAfter: true });
  await waitForLoginTransition();

  const statusTextAfterFirstSubmit = await readLoginStatusText();
  const stillOnLoginAfterFirstSubmit = /\/login(?:\?|$)/.test(page.url());

  if (stillOnLoginAfterFirstSubmit && !statusTextAfterFirstSubmit) {
    const loginButton = page.getByRole("button", {
      name: "Login",
      exact: true,
    });
    const emailInput =
      (await emailByLabel.count()) > 0
        ? emailByLabel
        : page.locator("#login-email");
    const passwordInput =
      (await passwordByLabel.count()) > 0
        ? passwordByLabel
        : page.locator("#login-password");

    await emailInput.click({ clickCount: 3 });
    await page.keyboard.type(email, { delay: 20 });
    await passwordInput.click({ clickCount: 3 });
    await page.keyboard.type(password, { delay: 20 });
    await expect(loginButton).toBeVisible();
    await expect(loginButton).toBeEnabled();
    await loginButton.click({ noWaitAfter: true });
    await waitForLoginTransition();

    const stillOnLoginAfterRetry = /\/login(?:\?|$)/.test(page.url());
    const statusTextAfterRetry = await readLoginStatusText();

    if (stillOnLoginAfterRetry && statusTextAfterRetry) {
      throw new Error(
        `Could not establish session for ${email}. Login status: ${statusTextAfterRetry}`,
      );
    }
  }
}

async function ensureCustomerSession(page: Page) {
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    await login(page, CUSTOMER_EMAIL, CUSTOMER_PASSWORD);

    try {
      await expect
        .poll(
          async () => {
            if (page.isClosed()) {
              return "page-closed";
            }

            return page.url();
          },
          { timeout: 30000 },
        )
        .toMatch(/\/customer\/(dashboard|requests)/);
      return;
    } catch {
      if (page.isClosed()) {
        throw new Error(
          `Could not establish customer session for ${CUSTOMER_EMAIL}. Page closed while waiting for authenticated navigation.`,
        );
      }

      const loginStatus = page.locator("p.text-red-300").first();
      const hasLoginStatus = (await loginStatus.count()) > 0;
      const statusText = hasLoginStatus
        ? (await loginStatus.textContent())?.trim()
        : null;

      if (statusText) {
        throw new Error(
          `Could not establish customer session for ${CUSTOMER_EMAIL}. Current URL: ${page.url()}. Login status: ${statusText}`,
        );
      }

      if (attempt === 2) {
        throw new Error(
          `Could not establish customer session for ${CUSTOMER_EMAIL}. Current URL: ${page.url()}. Login status: none`,
        );
      }
    }
  }
}

async function ensurePartnerSession(
  page: Page,
  email: string,
  password: string,
) {
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    await login(page, email, password);

    try {
      await expect
        .poll(
          async () => {
            if (page.isClosed()) {
              return "page-closed";
            }

            return page.url();
          },
          { timeout: 30000 },
        )
        .toMatch(/\/(partner|sales|logistics)\//);
      return;
    } catch {
      if (page.isClosed()) {
        throw new Error(
          `Could not establish partner session for ${email}. Page closed while waiting for authenticated navigation.`,
        );
      }

      const loginStatus = page.locator("p.text-red-300").first();
      const hasLoginStatus = (await loginStatus.count()) > 0;
      const statusText = hasLoginStatus
        ? (await loginStatus.textContent())?.trim()
        : null;

      if (statusText) {
        throw new Error(
          `Could not establish partner session for ${email}. Current URL: ${page.url()}. Login status: ${statusText}`,
        );
      }

      if (attempt === 2) {
        throw new Error(
          `Could not establish partner session for ${email}. Current URL: ${page.url()}. Login status: none`,
        );
      }
    }
  }
}

async function ensureCustomerDashboard(page: Page) {
  await ensureCustomerSession(page);

  const callSetup = async (pg: typeof page) =>
    pg.evaluate(async () => {
      const response = await fetch(
        "/api/customer/workflow/ensure-po-requirement",
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        },
      );
      return {
        ok: response.ok,
        status: response.status,
        body: await response.text().catch(() => "<no-body>"),
      };
    });

  let setupResult = await callSetup(page);

  if (setupResult.status === 401) {
    await ensureCustomerSession(page);
    setupResult = await callSetup(page);
  }

  if (!setupResult.ok) {
    throw new Error(
      `Could not ensure PO requirement (${setupResult.status}): ${setupResult.body}`,
    );
  }

  await page.goto("/customer/dashboard", { waitUntil: "domcontentloaded" });
  await expect(
    page.getByRole("heading", { name: "Customer Dashboard", exact: true }),
  ).toBeVisible({ timeout: 30000 });
}

async function uploadCustomerPo(page: Page) {
  const filePath = path.resolve(
    process.cwd(),
    "public/test-docs/BluBook Workflow Process.pdf",
  );
  const fileBuffer = await fs.readFile(filePath);

  const poCard = page
    .locator("section")
    .filter({
      has: page.getByRole("heading", {
        name: "Purchase Order Upload",
        exact: true,
      }),
    })
    .first();

  const uploadButton = poCard.getByRole("button", {
    name: /Upload Purchase Order/i,
  });

  await expect(uploadButton.first()).toBeVisible({ timeout: 45000 });

  const uniqueFileName = `blubook-po-e2e-${Date.now()}.pdf`;
  const expectedPoReference = deriveExpectedPoReference(uniqueFileName);

  if (!expectedPoReference) {
    throw new Error("Could not derive expected PO reference.");
  }

  const kickoffResponsePromise = page.waitForResponse(
    (response) =>
      response.url().includes("/api/customer/workflow/po-uploaded") &&
      response.request().method() === "POST",
    { timeout: 120000 },
  );

  const [fileChooser] = await Promise.all([
    page.waitForEvent("filechooser"),
    uploadButton.first().click(),
  ]);

  await fileChooser.setFiles({
    name: uniqueFileName,
    mimeType: "application/pdf",
    buffer: fileBuffer,
  });

  const kickoffResponse = await kickoffResponsePromise;
  const kickoffBody = await kickoffResponse.text().catch(() => "<no-body>");
  if (!kickoffResponse.ok()) {
    throw new Error(
      `PO kickoff failed (${kickoffResponse.status()}): ${kickoffBody}`,
    );
  }

  await expect(poCard.getByText(/Purchase Order uploaded:/i)).toBeVisible({
    timeout: 45000,
  });

  return { expectedPoReference };
}

async function runSalesValidation(page: Page, poReference: string) {
  await ensurePartnerSession(page, SALES_EMAIL, SALES_PASSWORD);
  await gotoWithRetry(page, "/partner/dashboard");

  await expect(
    page.getByText("Partner Dashboard", { exact: true }),
  ).toBeVisible({
    timeout: 30000,
  });

  const incomingRequestsCard = page
    .locator("section")
    .filter({
      has: page.getByRole("heading", {
        name: "Incoming Sales Requests",
        exact: true,
      }),
    })
    .first();

  await expect(incomingRequestsCard).toBeVisible({ timeout: 30000 });

  const requestWithPo = incomingRequestsCard
    .locator("section")
    .filter({ has: page.getByText(poReference, { exact: true }) })
    .first();

  const actionableRequestButton = incomingRequestsCard
    .getByRole("button", { name: "Accept", exact: true })
    .first();

  const deadline = Date.now() + 90000;
  let lastDashboardDiagnostics: unknown = null;
  let lastWorkOrderDiagnostics: unknown = null;

  while (Date.now() < deadline) {
    const hasPo = await requestWithPo.isVisible().catch(() => false);
    if (hasPo) {
      await actionableRequestButton.click();
      await expect(
        incomingRequestsCard.getByText(/accepted|processing/i),
      ).toBeVisible({ timeout: 30000 });
      return;
    }

    const hasActionableRequest = await actionableRequestButton
      .isVisible()
      .catch(() => false);
    if (hasActionableRequest) {
      await actionableRequestButton.click();
      await expect(
        incomingRequestsCard.getByText(/accepted|processing/i),
      ).toBeVisible({ timeout: 30000 });
      return;
    }

    lastDashboardDiagnostics = await fetchPartnerDashboardDiagnostics(
      page,
      poReference,
    ).catch((error) => ({
      error: error instanceof Error ? error.message : String(error),
    }));

    lastWorkOrderDiagnostics = await fetchPartnerWorkOrdersDiagnostics(
      page,
      poReference,
    ).catch((error) => ({
      error: error instanceof Error ? error.message : String(error),
    }));

    await page.reload({ waitUntil: "domcontentloaded" });
  }

  throw new Error(
    [
      `Expected sales dashboard to show PO ${poReference} or at least one actionable incoming request.`,
      `Dashboard diagnostics: ${toDiagnosticJson(lastDashboardDiagnostics)}`,
      `Work-orders diagnostics: ${toDiagnosticJson(lastWorkOrderDiagnostics)}`,
    ].join("\n"),
  );
}

async function waitForInboundHandoffRow(page: Page, poReference: string) {
  await gotoWithRetry(page, "/partner/work-orders");

  const row = page.locator("tbody tr").filter({
    has: page.getByText(poReference, { exact: true }),
  });

  const deadline = Date.now() + 90000;
  let lastWorkOrderDiagnostics: unknown = null;
  let lastPageState: unknown = null;

  while (Date.now() < deadline) {
    const hasRow = await row
      .first()
      .isVisible()
      .catch(() => false);
    if (hasRow) {
      return row.first();
    }

    lastPageState = {
      url: page.url(),
      hasLogisticsTitle: await page
        .getByText("Logistics Work Orders", { exact: true })
        .isVisible()
        .catch(() => false),
      hasInboundBanner: await page
        .getByText("Inbound Logistics Handoffs", { exact: true })
        .isVisible()
        .catch(() => false),
      hasEmptyState: await page
        .getByText("No active work orders yet.", { exact: true })
        .isVisible()
        .catch(() => false),
      hasLoadError: await page
        .getByText("Could not load work orders.", { exact: true })
        .isVisible()
        .catch(() => false),
    };

    lastWorkOrderDiagnostics = await fetchPartnerWorkOrdersDiagnostics(
      page,
      poReference,
    ).catch((error) => ({
      error: error instanceof Error ? error.message : String(error),
    }));

    await page.reload({ waitUntil: "domcontentloaded" });
  }

  throw new Error(
    [
      `Expected logistics work orders to show PO ${poReference}.`,
      `Page state: ${toDiagnosticJson(lastPageState)}`,
      `Work-orders diagnostics: ${toDiagnosticJson(lastWorkOrderDiagnostics)}`,
    ].join("\n"),
  );
}

async function uploadPartnerDocument(
  page: Page,
  documentType: "shipping-label" | "proof-of-delivery",
  fileName: string,
  buffer: Buffer,
) {
  await gotoWithRetry(page, "/partner/documents");
  await expect(
    page.getByText("Partner Workspace Documents", { exact: true }),
  ).toBeVisible({ timeout: 30000 });

  await page.locator("select").first().selectOption(documentType);

  const [fileChooser] = await Promise.all([
    page.waitForEvent("filechooser"),
    page
      .getByRole("button", { name: "Choose file", exact: true })
      .first()
      .click(),
  ]);

  await fileChooser.setFiles({
    name: fileName,
    mimeType: "application/pdf",
    buffer,
  });

  const successLabel =
    documentType === "shipping-label" ? "Shipping label" : "Proof of delivery";

  await expect(
    page.getByText(`File uploaded: ${fileName} (${successLabel}).`, {
      exact: true,
    }),
  ).toBeVisible({ timeout: 45000 });
}

async function runLogisticsStages(page: Page, poReference: string) {
  await ensurePartnerSession(page, LOGISTICS_EMAIL, LOGISTICS_PASSWORD);

  const filePath = path.resolve(
    process.cwd(),
    "public/test-docs/BluBook Workflow Process.pdf",
  );
  const fileBuffer = await fs.readFile(filePath);

  await uploadPartnerDocument(
    page,
    "shipping-label",
    `shipping-label-${Date.now()}.pdf`,
    fileBuffer,
  );
  await uploadPartnerDocument(
    page,
    "proof-of-delivery",
    `proof-of-delivery-${Date.now()}.pdf`,
    fileBuffer,
  );

  const row = await waitForInboundHandoffRow(page, poReference);

  const acceptButton = row.getByRole("button", { name: "Accept", exact: true });
  if (await acceptButton.count()) {
    await acceptButton.click();
    await expect(
      row.getByRole("button", { name: "Start Work", exact: true }),
    ).toBeVisible({ timeout: 30000 });
  }

  const startButton = row.getByRole("button", {
    name: "Start Work",
    exact: true,
  });
  if (await startButton.count()) {
    await startButton.click();
    await expect(
      row.getByRole("button", { name: "Mark Complete", exact: true }),
    ).toBeVisible({ timeout: 30000 });
  }

  await row.getByRole("button", { name: "Mark Complete", exact: true }).click();
  await expect(row.getByText("Completed", { exact: true })).toBeVisible({
    timeout: 60000,
  });
}

async function expectCustomerDelivered(page: Page, poReference: string) {
  await login(page, CUSTOMER_EMAIL, CUSTOMER_PASSWORD);
  await page.goto("/customer/orders", { waitUntil: "domcontentloaded" });

  await expect(
    page.getByRole("heading", { name: "Customer Orders", exact: true }),
  ).toBeVisible({ timeout: 30000 });

  const orderCard = page
    .locator("section")
    .filter({ has: page.getByText(poReference, { exact: true }) })
    .first();

  await expect(orderCard).toBeVisible({ timeout: 120000 });
  await expect(orderCard.getByText("Delivered", { exact: true })).toBeVisible({
    timeout: 120000,
  });
}

test.describe("Customer -> Sales -> Logistics sequential workflow", () => {
  test.setTimeout(600000);

  test("runs full three-role workflow and reaches delivered", async ({
    browser,
  }: {
    browser: Browser;
  }) => {
    const customerContext = await browser.newContext();
    const salesContext = await browser.newContext();
    const logisticsContext = await browser.newContext();

    const customerPage = await customerContext.newPage();
    const salesPage = await salesContext.newPage();
    const logisticsPage = await logisticsContext.newPage();

    try {
      await ensureCustomerDashboard(customerPage);
      const { expectedPoReference } = await uploadCustomerPo(customerPage);

      await runSalesValidation(salesPage, expectedPoReference);
      await runLogisticsStages(logisticsPage, expectedPoReference);
      await expectCustomerDelivered(customerPage, expectedPoReference);
    } finally {
      await Promise.allSettled([
        customerContext.close(),
        salesContext.close(),
        logisticsContext.close(),
      ]);
    }
  });
});
