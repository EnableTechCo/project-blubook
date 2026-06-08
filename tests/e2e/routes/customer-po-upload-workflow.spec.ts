import { promises as fs } from "node:fs";
import path from "node:path";
import { expect, test, type Browser, type Page } from "@playwright/test";

const TEST_ACCOUNTS = {
  customer: {
    email: "ignatius@e-t.co.za",
    password: "DBPass123!",
  },
  sales: {
    email: "sales-ticks.partner@mock.blubook.local",
    password: "DBPass123!",
  },
  logistics: {
    email: "call-force-outsourcing.partner@mock.blubook.local",
    password: "DBPass123!",
  },
} as const;

const CUSTOMER_EMAIL = TEST_ACCOUNTS.customer.email;
const CUSTOMER_PASSWORD = TEST_ACCOUNTS.customer.password;
const SALES_EMAIL = TEST_ACCOUNTS.sales.email;
const SALES_PASSWORD = TEST_ACCOUNTS.sales.password;
const LOGISTICS_EMAIL = TEST_ACCOUNTS.logistics.email;
const LOGISTICS_PASSWORD = TEST_ACCOUNTS.logistics.password;
const MAX_LOG_BODY_CHARS = 2000;

function logDiag(scope: string, message: string, details?: unknown) {
  const timestamp = new Date().toISOString();
  if (details === undefined) {
    console.log(`[e2e][${timestamp}][${scope}] ${message}`);
    return;
  }

  console.log(`[e2e][${timestamp}][${scope}] ${message}`, details);
}

function truncate(value: string, max = MAX_LOG_BODY_CHARS) {
  if (value.length <= max) {
    return value;
  }

  return `${value.slice(0, max)}...<truncated ${value.length - max} chars>`;
}

function attachPageDiagnostics(page: Page, label: string) {
  page.on("console", (msg) => {
    logDiag(label, `browser-console:${msg.type()}`, msg.text());
  });

  page.on("pageerror", (error) => {
    logDiag(
      label,
      "pageerror",
      error instanceof Error ? (error.stack ?? error.message) : String(error),
    );
  });

  page.on("requestfailed", (request) => {
    logDiag(label, "requestfailed", {
      method: request.method(),
      url: request.url(),
      failure: request.failure()?.errorText ?? "unknown",
      postData: request.postData()
        ? truncate(request.postData() as string)
        : null,
    });
  });

  page.on("request", (request) => {
    const url = request.url();
    const method = request.method();
    const isApi = url.includes("/api/");
    const hasPayload = Boolean(request.postData());

    if (isApi || hasPayload || method !== "GET") {
      logDiag(label, "request", {
        method,
        url,
        resourceType: request.resourceType(),
        postData: request.postData()
          ? truncate(request.postData() as string)
          : null,
      });
    }
  });

  page.on("response", (response) => {
    const url = response.url();
    const status = response.status();
    const method = response.request().method();
    const isApi = url.includes("/api/");
    const shouldLogBody = isApi && (status >= 400 || method !== "GET");

    if (isApi || status >= 400) {
      if (!shouldLogBody) {
        logDiag(label, "response", { method, url, status });
        return;
      }

      void (async () => {
        const body = await response.text().catch(() => "<unreadable-body>");
        logDiag(label, "response", {
          method,
          url,
          status,
          body: truncate(body),
        });
      })();
    }
  });
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
  logDiag("login", `open login page for ${email}`);
  await page.goto("/login", { waitUntil: "domcontentloaded", timeout: 120000 });
  await page
    .waitForLoadState("networkidle", { timeout: 10000 })
    .catch(() => undefined);
  await expect(
    page.getByRole("heading", { name: "Login", exact: true }),
  ).toBeVisible();

  const emailInput = page.locator("#login-email");
  const passwordInput = page.locator("#login-password");
  const loginButton = page.getByRole("button", { name: "Login", exact: true });
  const loginStatus = page.locator("p.text-red-300").first();

  await expect(emailInput).toBeVisible();
  await expect(passwordInput).toBeVisible();
  await expect(emailInput).toBeEditable();
  await expect(passwordInput).toBeEditable();

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

  await emailInput.fill(email);
  await passwordInput.fill(password);
  await expect(emailInput).toHaveValue(email);
  await expect(passwordInput).toHaveValue(password);

  logDiag("login", `submit login form for ${email}`);
  await loginButton.click({ noWaitAfter: true });
  await waitForLoginTransition();

  const statusTextAfterFirstSubmit = await readLoginStatusText();
  const stillOnLoginAfterFirstSubmit = /\/login(?:\?|$)/.test(page.url());

  // In local dev, hydration/state races can drop controlled input values before submit.
  if (stillOnLoginAfterFirstSubmit && !statusTextAfterFirstSubmit) {
    logDiag(
      "login",
      `no post-submit transition detected for ${email}; retry with keyboard submit`,
    );
    await emailInput.click({ clickCount: 3 });
    await page.keyboard.type(email, { delay: 20 });
    await passwordInput.click({ clickCount: 3 });
    await page.keyboard.type(password, { delay: 20 });
    await expect(emailInput).toHaveValue(email);
    await expect(passwordInput).toHaveValue(password);
    await passwordInput.press("Enter", { noWaitAfter: true });
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
    logDiag("session-customer", `attempt ${attempt} start`);
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
      logDiag("session-customer", `attempt ${attempt} success`, {
        url: page.url(),
      });
      return;
    } catch {
      if (page.isClosed()) {
        throw new Error(
          `Could not establish customer session for ${CUSTOMER_EMAIL}. Page was closed while waiting for authenticated navigation (likely overall test timeout).`,
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
    logDiag("session-partner", `attempt ${attempt} start`, { email });
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
      logDiag("session-partner", `attempt ${attempt} success`, {
        email,
        url: page.url(),
      });
      return;
    } catch {
      if (page.isClosed()) {
        throw new Error(
          `Could not establish partner session for ${email}. Page was closed while waiting for authenticated navigation (likely overall test timeout).`,
        );
      }

      const partnerDashboardHeading = page.getByRole("heading", {
        name: "Partner Dashboard",
        exact: true,
      });
      const salesOrdersHeading = page.getByText("Sales Orders Queue", {
        exact: true,
      });
      const isOnAuthenticatedView =
        (await partnerDashboardHeading.isVisible().catch(() => false)) ||
        (await salesOrdersHeading.isVisible().catch(() => false));

      if (isOnAuthenticatedView) {
        logDiag(
          "session-partner",
          `attempt ${attempt} success via heading fallback`,
          {
            email,
            url: page.url(),
          },
        );
        return;
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

async function openCustomerDashboard(page: Page) {
  await ensureCustomerSession(page);

  logDiag(
    "customer-dashboard",
    "POST /api/customer/workflow/ensure-po-requirement start",
  );
  const setupResult = await page.evaluate(async () => {
    const response = await fetch(
      "/api/customer/workflow/ensure-po-requirement",
      {
        method: "POST",
        credentials: "include",
      },
    );
    const body = await response.text().catch(() => "<no-body>");
    return {
      ok: response.ok,
      status: response.status,
      body,
    };
  });
  logDiag(
    "customer-dashboard",
    "POST /api/customer/workflow/ensure-po-requirement result",
    {
      status: setupResult.status,
      body: truncate(setupResult.body),
    },
  );

  if (!setupResult.ok) {
    throw new Error(
      `Could not ensure PO requirement (${setupResult.status}): ${setupResult.body}`,
    );
  }

  await page.goto("/customer/dashboard", { waitUntil: "domcontentloaded" });
  await page
    .waitForLoadState("networkidle", { timeout: 10000 })
    .catch(() => undefined);

  if (/\/login(?:\?|$)/.test(page.url())) {
    logDiag(
      "customer-dashboard",
      "redirected to login while opening dashboard; re-establish session",
    );
    await ensureCustomerSession(page);
    await page.goto("/customer/dashboard", { waitUntil: "domcontentloaded" });
    await page
      .waitForLoadState("networkidle", { timeout: 10000 })
      .catch(() => undefined);
  }

  const dashboardHeading = page.getByRole("heading", {
    name: "Customer Dashboard",
    exact: true,
  });

  try {
    await expect(page).toHaveURL(/\/customer\/dashboard/, { timeout: 15000 });
    await expect(dashboardHeading).toBeVisible({ timeout: 15000 });
    return;
  } catch {
    // Fall back to the requests workspace link if direct navigation does not settle.
  }

  await page.goto("/customer/requests", { waitUntil: "domcontentloaded" });
  await page
    .waitForLoadState("networkidle", { timeout: 10000 })
    .catch(() => undefined);

  if (/\/login(?:\?|$)/.test(page.url())) {
    logDiag(
      "customer-dashboard",
      "redirected to login while opening requests; re-establish session",
    );
    await ensureCustomerSession(page);
    await page.goto("/customer/requests", { waitUntil: "domcontentloaded" });
    await page
      .waitForLoadState("networkidle", { timeout: 10000 })
      .catch(() => undefined);
  }

  const requestsHeading = page.getByRole("heading", {
    name: "Customer Requests",
    exact: true,
  });
  await expect(requestsHeading).toBeVisible({ timeout: 30000 });

  const uploadPoLink = page.getByRole("link", {
    name: /Upload PO/i,
  });

  await expect(uploadPoLink).toBeVisible({ timeout: 30000 });
  await uploadPoLink.click();

  await expect(page).toHaveURL(/\/customer\/dashboard/, { timeout: 30000 });
  await expect(dashboardHeading).toBeVisible({ timeout: 30000 });
}

async function openLogisticsWorkOrders(page: Page) {
  logDiag("logistics", "open logistics work orders start", {
    email: LOGISTICS_EMAIL,
  });
  await login(page, LOGISTICS_EMAIL, LOGISTICS_PASSWORD);
  await Promise.all([
    page.waitForResponse(
      (response) =>
        response.url().includes("/api/partner/work-orders") &&
        response.request().method() === "GET",
      { timeout: 60000 },
    ),
    page.goto("/partner/work-orders", { waitUntil: "domcontentloaded" }),
  ]);

  await expect(page).toHaveURL(/\/partner\/work-orders/, {
    timeout: 30000,
  });

  await expect(
    page.locator('[aria-busy="true"][aria-live="polite"]'),
  ).toHaveCount(0, {
    timeout: 60000,
  });

  await expect(
    page.getByRole("heading", {
      name: "Inbound Provider Handoffs",
      exact: true,
    }),
  ).toBeVisible({ timeout: 30000 });
}

async function openSalesOrders(page: Page) {
  logDiag("sales", "open sales orders start", { email: SALES_EMAIL });
  await login(page, SALES_EMAIL, SALES_PASSWORD);
}

async function waitForInboundHandoffRow(page: Page, poReference: string) {
  await Promise.all([
    page.waitForResponse(
      (response) =>
        response.url().includes("/api/partner/work-orders") &&
        response.request().method() === "GET",
      { timeout: 30000 },
    ),
    page.goto("/partner/work-orders", { waitUntil: "domcontentloaded" }),
  ]);

  const row = page.locator("tbody tr").filter({
    has: page.getByText(poReference, { exact: true }),
  });

  await expect(row.first()).toBeVisible({ timeout: 90000 });
  return row.first();
}

async function uploadPartnerDocument(
  page: Page,
  documentType: "shipping-label" | "proof-of-delivery",
  fileName: string,
  buffer: Buffer,
) {
  await page.goto("/partner/documents", { waitUntil: "domcontentloaded" });
  await expect(
    page.getByText("Partner Workspace Documents", { exact: true }),
  ).toBeVisible({
    timeout: 30000,
  });

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

async function completeLogisticsHandoff(page: Page, poReference: string) {
  const row = await waitForInboundHandoffRow(page, poReference);

  const acceptButton = row.getByRole("button", { name: "Accept", exact: true });
  if (await acceptButton.count()) {
    await acceptButton.click();
    await expect(
      row.getByRole("button", { name: "Start Work", exact: true }),
    ).toBeVisible({
      timeout: 30000,
    });
  }

  const startButton = row.getByRole("button", {
    name: "Start Work",
    exact: true,
  });
  if (await startButton.count()) {
    await startButton.click();
    await expect(
      row.getByRole("button", { name: "Mark Complete", exact: true }),
    ).toBeVisible({
      timeout: 30000,
    });
  }

  await row.getByRole("button", { name: "Mark Complete", exact: true }).click();
  await expect(row.getByText("Completed", { exact: true })).toBeVisible({
    timeout: 60000,
  });
}

async function expectSalesOrderVisible(page: Page, poReference: string) {
  logDiag("sales", "verify incoming sales request visibility", { poReference });

  await expect(
    page.getByRole("heading", { name: "Partner Dashboard", exact: true }),
  ).toBeVisible({ timeout: 30000 });

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

  const actionableRequestButton = incomingRequestsCard
    .getByRole("button", { name: "Accept", exact: true })
    .first();

  await expect(actionableRequestButton).toBeVisible({ timeout: 60000 });
}

async function expectCustomerDeliveredOutcome(page: Page, poReference: string) {
  await page.goto("/customer/orders", { waitUntil: "domcontentloaded" });
  await expect(
    page.getByRole("heading", { name: "Customer Orders", exact: true }),
  ).toBeVisible({
    timeout: 30000,
  });

  const orderCard = page
    .locator("section")
    .filter({
      has: page.getByText(poReference, { exact: true }),
    })
    .first();

  await expect(
    orderCard.getByText("Delivered", { exact: true }).first(),
  ).toBeVisible({ timeout: 90000 });
  await expect(orderCard.getByText("SLA Met", { exact: true })).toBeVisible({
    timeout: 90000,
  });
  await expect(orderCard.getByText(/delivered to/i)).toBeVisible({
    timeout: 90000,
  });

  await page.goto("/customer/messages", { waitUntil: "domcontentloaded" });
  await expect(
    page.getByText(new RegExp(`${poReference} was delivered`, "i")).first(),
  ).toBeVisible({
    timeout: 90000,
  });
}

async function signOut(page: Page, actor: string) {
  logDiag("signout", `signing out ${actor}`);

  const signOutButton = page.getByRole("button", {
    name: "Sign Out",
    exact: true,
  });
  await expect(signOutButton).toBeVisible({ timeout: 30000 });
  await signOutButton.click();

  await expect(page).toHaveURL(/\/login/, { timeout: 30000 });
}

test.describe("Customer PO upload workflow kickoff", () => {
  test.setTimeout(600000);

  test("uploading PO on dashboard triggers workflow and creates logistics handoff", async ({
    browser,
  }: {
    browser: Browser;
  }) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    attachPageDiagnostics(page, "workflow-page");
    logDiag("test", "diagnostics listeners attached");

    try {
      await openCustomerDashboard(page);

      const poCard = page
        .locator("section")
        .filter({
          has: page.getByRole("heading", {
            name: "Purchase Order Upload",
            exact: true,
          }),
        })
        .first();

      const noPendingText = poCard.getByText(
        "No pending purchase orders right now.",
        {
          exact: true,
        },
      );

      const uploadButton = poCard.getByRole("button", {
        name: /Upload /i,
      });

      await expect
        .poll(async () => uploadButton.count(), {
          timeout: 30000,
          message:
            "Expected at least one PO upload button after setup route ensured a pending PO requirement.",
        })
        .toBeGreaterThan(0);

      await expect(noPendingText).toHaveCount(0);

      const filePath = path.resolve(
        process.cwd(),
        "public/test-docs/BluBook Workflow Process.pdf",
      );

      const fileBuffer = await fs.readFile(filePath);
      const uniqueFileName = `blubook-po-e2e-${Date.now()}.pdf`;
      const expectedPoReference = deriveExpectedPoReference(uniqueFileName);

      if (!expectedPoReference) {
        throw new Error(
          "Could not derive expected PO reference for uploaded test file.",
        );
      }

      const [fileChooser] = await Promise.all([
        page.waitForEvent("filechooser"),
        uploadButton.first().click(),
      ]);

      const kickoffResponsePromise = page.waitForResponse(
        (response) =>
          response.url().includes("/api/customer/workflow/po-uploaded") &&
          response.request().method() === "POST",
        { timeout: 120000 },
      );

      await fileChooser.setFiles({
        name: uniqueFileName,
        mimeType: "application/pdf",
        buffer: fileBuffer,
      });

      await expect(poCard.getByText(/Purchase Order uploaded:/i)).toBeVisible({
        timeout: 45000,
      });

      await expect(
        poCard.getByText(
          /Workflow started for|Workflow kickoff is processing/i,
        ),
      ).toBeVisible({ timeout: 45000 });

      const kickoffResponse = await kickoffResponsePromise;
      const kickoffBody = await kickoffResponse.text().catch(() => "<no-body>");
      logDiag(
        "customer-dashboard",
        "POST /api/customer/workflow/po-uploaded result",
        {
          status: kickoffResponse.status(),
          body: truncate(kickoffBody),
        },
      );

      if (!kickoffResponse.ok()) {
        throw new Error(
          `Could not complete PO workflow kickoff (${kickoffResponse.status()}): ${kickoffBody}`,
        );
      }

      await signOut(page, "customer");

      await openSalesOrders(page);
      await expectSalesOrderVisible(page, expectedPoReference);
      await signOut(page, "sales partner");

      await openLogisticsWorkOrders(page);
      await waitForInboundHandoffRow(page, expectedPoReference);
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
      await completeLogisticsHandoff(page, expectedPoReference);
      await signOut(page, "logistics partner");

      await ensureCustomerSession(page);
      await expectCustomerDeliveredOutcome(page, expectedPoReference);
    } finally {
      await Promise.allSettled([context.close()]);
    }
  });
});
