import { expect, test } from "@playwright/test";

const successResponse = {
  access_token: "test-access-token",
  token_type: "bearer",
  expires_in: 3600,
  expires_at: 9999999999,
  refresh_token: "test-refresh-token",
  user: {
    id: "user-1",
    aud: "authenticated",
    role: "authenticated",
    email: "customer@example.com",
    user_metadata: {
      role: "customer",
    },
  },
};

test.describe("login", () => {
  test("shows session expired banner", async ({ page }) => {
    await page.goto("/login?reason=session_expired");

    await expect(
      page.getByText("Your session expired. Please log in again."),
    ).toBeVisible();
  });

  test("navigates to forgot password from login", async ({ page }) => {
    await page.goto("/login");

    await page.getByRole("link", { name: "Forgot password" }).click();

    await expect(page).toHaveURL(/\/forgot-password$/);
    await expect(
      page.getByRole("heading", { name: "Forgot Password" }),
    ).toBeVisible();
  });

  test("redirects to next path after successful login", async ({ page }) => {
    await page.route("**/auth/v1/token*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(successResponse),
      });
    });

    await page.goto("/login?next=/onboarding");
    await page.getByLabel("Email address").fill("customer@example.com");
    await page.getByLabel("Password").fill("Password123");
    await page.getByRole("button", { name: "Login" }).click();

    await expect(page).toHaveURL(/\/onboarding$/);
  });
});
