import { expect, test } from "@playwright/test";

test.describe("Customer onboarding and request creation", () => {
  test("user can onboard, pick a bundle, and submit a request", async ({
    page,
  }) => {
    // Stub Supabase auth endpoints used by register/login so flow is deterministic.
    await page.route("**/auth/v1/signup", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          user: {
            id: "user-onboarding-001",
            email: "hats@example.com",
          },
          session: null,
        }),
      });
    });

    await page.route("**/auth/v1/token?grant_type=password", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          access_token: "fake-access-token",
          token_type: "bearer",
          expires_in: 3600,
          refresh_token: "fake-refresh-token",
          user: {
            id: "user-onboarding-001",
            email: "hats@example.com",
          },
        }),
      });
    });

    await page.goto("/register");
    await expect(
      page.getByRole("heading", { name: "Register", exact: true }),
    ).toBeVisible();

    await page.getByPlaceholder("Full name").fill("Hats Seller");
    await page.getByPlaceholder("you@company.com").fill("hats@example.com");
    await page.getByPlaceholder("Strong password").fill("StrongPass123!");
    await page.getByRole("button", { name: "Create account" }).click();

    await page.goto("/login");
    await page.getByPlaceholder("you@company.com").fill("hats@example.com");
    await page.getByPlaceholder("Password").fill("StrongPass123!");
    await page.getByRole("button", { name: "Login" }).click();

    await page.getByRole("button", { name: "Open Customer Dashboard" }).click();

    await expect(
      page.getByRole("heading", { name: "Customer Onboarding", exact: true }),
    ).toBeVisible();

    await page
      .getByRole("button", { name: /Bronze/i })
      .first()
      .click();
    await page.getByRole("button", { name: "Pay for package" }).click();
    await page.getByRole("button", { name: "Continue" }).click();

    await page
      .getByPlaceholder("Example: BluBook Commerce")
      .fill("Hats Commerce");
    await page
      .getByPlaceholder("What does your business do?")
      .fill("We distribute lifestyle hats through retail and wholesale.");
    await page.getByPlaceholder("Country").fill("United States");
    await page.getByPlaceholder("City").fill("Austin");
    await page.getByRole("button", { name: "Continue" }).click();

    await page.getByRole("button", { name: "Continue" }).click();
    await page
      .getByText("I confirm the onboarding information is accurate.")
      .click();
    await page
      .getByRole("button", {
        name: "Finish onboarding and continue to dashboard",
      })
      .click();

    await expect(
      page.getByRole("heading", { name: "Customer Operations", exact: true }),
    ).toBeVisible();

    await page.goto("/customer/requests");
    await expect(
      page.getByRole("heading", { name: "Customer Requests", exact: true }),
    ).toBeVisible();

    await page.getByRole("button", { name: "Use This Bundle" }).first().click();

    const titleInput = page.getByPlaceholder("Request title");
    await expect(titleInput).not.toHaveValue("");
    const bundleTitle = await titleInput.inputValue();

    await page
      .getByPlaceholder("Describe what you need from the team")
      .fill(
        "Order intake and bookkeeping support for hat distribution, including monthly close and delivery handoffs.",
      );

    await page.getByRole("button", { name: "Create request" }).click();

    await expect(
      page
        .locator("article")
        .first()
        .getByRole("heading", { name: bundleTitle }),
    ).toBeVisible();
    await expect(
      page.locator("article").first().getByText("submitted", { exact: false }),
    ).toBeVisible();
  });
});
