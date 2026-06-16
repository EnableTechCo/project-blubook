import { expect, test, type Page } from "@playwright/test";

async function openForgotPassword(page: Page) {
  await page.goto("/forgot-password");
  await expect(page).toHaveURL(/\/forgot-password\/?$/);
  await expect(
    page.getByRole("heading", { name: "Forgot Password" }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "404" })).toHaveCount(0);
}

test.describe("forgot password", () => {
  test("submits and shows success status", async ({ page }) => {
    await page.route("**/auth/v1/recover*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({}),
      });
    });

    await openForgotPassword(page);
    await page.getByPlaceholder("you@company.com").fill("person@example.com");
    await page.getByRole("button", { name: "Send reset link" }).click();

    await expect(
      page.getByText("Password reset email sent. Check your inbox."),
    ).toBeVisible();
  });

  test("shows backend error status", async ({ page }) => {
    await page.route("**/auth/v1/recover*", async (route) => {
      await route.fulfill({
        status: 400,
        contentType: "application/json",
        body: JSON.stringify({
          message: "Request blocked",
          error_description: "Request blocked",
        }),
      });
    });

    await openForgotPassword(page);
    await page.getByPlaceholder("you@company.com").fill("person@example.com");
    await page.getByRole("button", { name: "Send reset link" }).click();

    await expect(page.getByText(/Reset request failed:/)).toBeVisible();
  });
});
