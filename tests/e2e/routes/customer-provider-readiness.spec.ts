import path from "node:path";
import { expect, test, type Locator, type Page } from "@playwright/test";

const EXPECTED_PACKAGE_LABEL = "Premium Plus";
const EXPECTED_PRIMARY_INDUSTRY = "Retail";
const EXPECTED_SUB_INDUSTRY = "Ecommerce";

type ProviderReadinessResponse = {
  providerRequests: {
    total: number;
    sent: number;
    allSent: boolean;
  };
  customerRequirements: {
    required: number;
    submittedOrApproved: number;
    allSubmitted: boolean;
  };
  slas: {
    total: number;
    active: number;
    allActive: boolean;
  };
  generatedCustomerRequests: number;
};

async function getReadiness(page: Page) {
  const response = await page.request.get("/api/customer/provider-readiness");
  if (!response.ok()) {
    const body = await response.text().catch(() => "<no-body>");
    throw new Error(
      `Provider readiness request failed (${response.status()}): ${body}`,
    );
  }
  return (await response.json()) as ProviderReadinessResponse;
}

async function selectPackageByLabel(page: Page, packageLabel: string) {
  const packageCard = page
    .getByRole("button", { name: new RegExp(packageLabel, "i") })
    .first();

  await expect(packageCard).toBeVisible();
  await packageCard.click();
}

async function ensureCustomerSession(
  page: Page,
  email: string,
  password: string,
) {
  const isInCustomerArea = () =>
    /\/customer\/(dashboard|requests)/.test(page.url());

  if (isInCustomerArea()) {
    return;
  }

  await page.goto("/customer/requests", { waitUntil: "domcontentloaded" });
  if (isInCustomerArea()) {
    return;
  }

  await page.goto("/login", { waitUntil: "domcontentloaded" });
  await page.getByLabel("Email address", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Login", exact: true }).click();

  try {
    await expect(page).toHaveURL(/\/customer\/(dashboard|requests)/, {
      timeout: 20000,
    });
  } catch {
    const loginStatus = page.locator("p.text-red-300").first();
    const hasLoginStatus = (await loginStatus.count()) > 0;
    const statusText = hasLoginStatus
      ? (await loginStatus.textContent())?.trim()
      : null;

    throw new Error(
      `Could not establish customer session for ${email}. Current URL: ${page.url()}. Login status: ${statusText ?? "none"}`,
    );
  }
}

async function assertCreateAccountSucceededOrUserExists(response: Response) {
  if (response.ok()) {
    return;
  }

  const payload = (await response.json().catch(() => null)) as {
    error?: string;
  } | null;
  const errorMessage = payload?.error?.toLowerCase() ?? "";

  if (
    errorMessage.includes("already been registered") ||
    errorMessage.includes("already registered") ||
    errorMessage.includes("already exists")
  ) {
    return;
  }

  throw new Error(
    `Customer account creation failed: ${payload?.error ?? response.statusText}`,
  );
}

async function openDocumentsWorkspace(page: Page) {
  const checklistHeading = page.getByText("Requirements Checklist", {
    exact: true,
  });
  const workspaceError = page.getByText(
    "Could not load your document workspace right now.",
    { exact: true },
  );

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    await page.goto("/customer/documents", { waitUntil: "domcontentloaded" });

    try {
      await expect(checklistHeading).toBeVisible({ timeout: 10000 });
      return;
    } catch {
      const hasWorkspaceError = (await workspaceError.count()) > 0;
      if (attempt === 2) {
        throw new Error(
          hasWorkspaceError
            ? "Documents workspace failed to load customer context after retry."
            : "Requirements checklist did not render in documents workspace.",
        );
      }
    }
  }
}

test.describe("Customer provider dispatch and SLA activation", () => {
  test("onboarding dispatches providers and activates SLAs after all required uploads", async ({
    page,
  }) => {
    test.setTimeout(180000);

    const customerEmail = "ignatius@e-t.co.za";
    const customerPassword = "DBPass123!";
    const pdfFile = path.resolve(
      process.cwd(),
      "public/test-docs/BluBook Workflow Process.pdf",
    );
    const imageFile = path.resolve(
      process.cwd(),
      "public/test-docs/blubook.png",
    );

    const servicePackagesResponse = page.waitForResponse(
      (response) =>
        response.url().includes("/rest/v1/service_packages") &&
        response.request().method() === "GET",
    );
    const industryTaxonomyResponse = page.waitForResponse(
      (response) =>
        response.url().includes("/rest/v1/industry_taxonomy") &&
        response.request().method() === "GET",
    );

    await page.goto("/onboarding", { waitUntil: "domcontentloaded" });

    const [servicePackagesResult, industryTaxonomyResult] = await Promise.all([
      servicePackagesResponse,
      industryTaxonomyResponse,
    ]);
    expect(servicePackagesResult.ok()).toBeTruthy();
    expect(industryTaxonomyResult.ok()).toBeTruthy();
    await expect(
      page.getByText("No active packages found.", { exact: true }),
    ).toHaveCount(0);

    await selectPackageByLabel(page, EXPECTED_PACKAGE_LABEL);

    await expect(
      page.getByRole("heading", { name: "Payment", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("Selected package", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText(EXPECTED_PACKAGE_LABEL, { exact: true }),
    ).toBeVisible();

    const payButton = page.getByRole("button", {
      name: "Pay for package",
      exact: true,
    });
    await expect(payButton).toBeEnabled();
    await payButton.click();
    await expect(
      page.getByRole("heading", { name: "About your business", exact: true }),
    ).toBeVisible();

    await page.getByLabel("Business title *").fill("Ignatius Commerce");
    await page
      .getByLabel("Business summary *")
      .fill("Provider dispatch and SLA onboarding validation.");
    await page.getByLabel("Country *").fill("South Africa");
    await page.getByLabel("City *").fill("Johannesburg");

    await page.getByLabel("Company type").selectOption("corporation");
    await page.getByLabel("Employees").selectOption("50+");
    await page.getByLabel("Primary industry *").selectOption({
      label: EXPECTED_PRIMARY_INDUSTRY,
    });

    const subIndustrySelect = page.getByLabel("Sub-industry");
    await expect(subIndustrySelect).toBeEnabled();
    await subIndustrySelect.selectOption({ label: EXPECTED_SUB_INDUSTRY });
    await page.getByLabel("Business model").selectOption("reseller");
    await page.getByLabel("Customer segment").selectOption("hybrid");

    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await expect(
      page.getByRole("heading", {
        name: "Operational profile",
        exact: true,
      }),
    ).toBeVisible();

    await page.getByLabel("Inventory handling").selectOption("third_party");
    await page.getByLabel("Inventory model").selectOption("hybrid");
    await page.getByLabel("Fulfillment model").selectOption("third_party");
    await page.getByLabel("Annual revenue band").selectOption("10m_50m");
    await page
      .getByLabel("Monthly order volume band")
      .selectOption("1000_10000");

    await page
      .getByRole("checkbox", { name: "Own website", exact: true })
      .check();
    await page
      .getByRole("checkbox", { name: "Marketplace", exact: true })
      .check();
    await page.getByRole("checkbox", { name: "Retail", exact: true }).check();
    await page
      .getByRole("checkbox", { name: "Wholesale", exact: true })
      .check();
    await page.getByRole("checkbox", { name: "Social", exact: true }).check();
    await page
      .getByRole("checkbox", { name: "Direct sales", exact: true })
      .check();
    await page.getByRole("checkbox", { name: "Domestic", exact: true }).check();
    await page
      .getByRole("checkbox", { name: "Cross-border", exact: true })
      .check();
    await page
      .getByRole("checkbox", {
        name: "Regulated compliance context",
        exact: true,
      })
      .check();

    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await expect(
      page.getByRole("heading", {
        name: "Create your customer account",
        exact: true,
      }),
    ).toBeVisible();

    await page.getByLabel("Full name *").fill("Ignatius Mutizwa");
    await page.getByLabel("Email address *").fill(customerEmail);
    await page.getByPlaceholder("Create password").fill(customerPassword);
    await page.getByPlaceholder("Confirm password").fill(customerPassword);
    await page
      .getByRole("checkbox", {
        name: "I confirm the onboarding information is accurate and I want this email/password to activate my customer account.",
        exact: true,
      })
      .check();

    const createAccountResponse = page.waitForResponse(
      (response) =>
        response.url().includes("/api/auth/customer-account") &&
        response.request().method() === "POST",
      { timeout: 60000 },
    );

    await page
      .getByRole("button", {
        name: "Create account and submit onboarding",
        exact: true,
      })
      .click();

    const createAccountResult = await createAccountResponse;
    await assertCreateAccountSucceededOrUserExists(createAccountResult);

    await ensureCustomerSession(page, customerEmail, customerPassword);
    await expect(page.getByRole("link", { name: /Requests/i })).toBeVisible();

    const readinessAfterOnboarding = await getReadiness(page);
    expect(readinessAfterOnboarding.providerRequests.total).toBeGreaterThan(0);
    expect(readinessAfterOnboarding.providerRequests.allSent).toBeTruthy();
    expect(readinessAfterOnboarding.generatedCustomerRequests).toBeGreaterThan(
      0,
    );

    await openDocumentsWorkspace(page);

    const initialRequired =
      readinessAfterOnboarding.customerRequirements.required;
    expect(initialRequired).toBeGreaterThan(0);

    const uploadsToDo = Math.max(initialRequired, 1);
    for (let index = 0; index < uploadsToDo; index += 1) {
      const enabledRequirementInputs = page.locator(
        "article input[type='file']:not([disabled])",
      );
      const enabledCount = await enabledRequirementInputs.count();
      if (enabledCount === 0) {
        break;
      }

      await enabledRequirementInputs
        .first()
        .setInputFiles(index % 2 === 0 ? pdfFile : imageFile);
    }

    await expect(page.getByText(/Missing\s+0/i)).toBeVisible();

    await expect
      .poll(async () => getReadiness(page), {
        message: "Provider readiness and SLA activation should complete",
        timeout: 90000,
      })
      .toEqual(
        expect.objectContaining({
          customerRequirements: expect.objectContaining({
            allSubmitted: true,
          }),
          slas: expect.objectContaining({
            allActive: true,
          }),
        }),
      );
  });
});
