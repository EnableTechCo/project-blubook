import { expect, test, type Page } from "@playwright/test";

const CUSTOMER_EMAIL = "ignatius@e-t.co.za";
const CUSTOMER_PASSWORD = "DBPass123!";

async function loginAsCustomer(page: Page) {
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    await page.goto("/login", { waitUntil: "networkidle" });
    await expect(
      page.getByRole("heading", { name: "Login", exact: true }),
    ).toBeVisible();

    const emailInput = page.getByLabel("Email address", { exact: true });
    const passwordInput = page.getByLabel("Password", { exact: true });
    await emailInput.fill(CUSTOMER_EMAIL);
    await passwordInput.fill(CUSTOMER_PASSWORD);
    await expect(emailInput).toHaveValue(CUSTOMER_EMAIL);
    await expect(passwordInput).toHaveValue(CUSTOMER_PASSWORD);

    await page.getByRole("button", { name: "Login", exact: true }).click();

    try {
      await expect(page).toHaveURL(/\/customer\/(dashboard|requests)/, {
        timeout: 30000,
      });
      return;
    } catch {
      const loginStatus = page.locator("p.text-red-300").first();
      const hasLoginStatus = (await loginStatus.count()) > 0;
      const statusText = hasLoginStatus
        ? (await loginStatus.textContent())?.trim()
        : null;

      if (statusText) {
        throw new Error(
          `Login did not establish a customer session for ${CUSTOMER_EMAIL}. Current URL: ${page.url()}. Login status: ${statusText}`,
        );
      }

      if (attempt === 2) {
        throw new Error(
          `Login did not establish a customer session for ${CUSTOMER_EMAIL}. Current URL: ${page.url()}. Login status: none`,
        );
      }
    }
  }
}

test.describe("Customer provider-readiness API", () => {
  test("returns 401 when unauthenticated", async ({ request }) => {
    const response = await request.get("/api/customer/provider-readiness");
    expect(response.status()).toBe(401);

    const payload = (await response.json()) as { error?: string };
    expect(payload.error).toBe("Unauthorized");
  });

  test("returns readiness payload for authenticated customer", async ({
    page,
  }) => {
    await loginAsCustomer(page);

    const response = await page.request.get("/api/customer/provider-readiness");
    expect(response.ok()).toBeTruthy();

    const payload = (await response.json()) as {
      providerRequests: { total: number; sent: number; allSent: boolean };
      customerRequirements: {
        required: number;
        submittedOrApproved: number;
        allSubmitted: boolean;
      };
      slas: { total: number; active: number; allActive: boolean };
      generatedCustomerRequests: number;
    };

    expect(payload.providerRequests.total).toEqual(expect.any(Number));
    expect(payload.providerRequests.sent).toEqual(expect.any(Number));
    expect(payload.providerRequests.allSent).toEqual(expect.any(Boolean));

    expect(payload.customerRequirements.required).toEqual(expect.any(Number));
    expect(payload.customerRequirements.submittedOrApproved).toEqual(
      expect.any(Number),
    );
    expect(payload.customerRequirements.allSubmitted).toEqual(
      expect.any(Boolean),
    );

    expect(payload.slas.total).toEqual(expect.any(Number));
    expect(payload.slas.active).toEqual(expect.any(Number));
    expect(payload.slas.allActive).toEqual(expect.any(Boolean));

    expect(payload.generatedCustomerRequests).toEqual(expect.any(Number));
  });
});
