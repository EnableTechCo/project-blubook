import { expect, test } from "@playwright/test";

test.describe("reset password", () => {
  test("shows mismatch validation error", async ({ page }) => {
    await page.goto("/reset-password");

    await expect(page).toHaveURL(/\/reset-password\/?$/);
    await expect(
      page.getByRole("heading", { name: "Reset Password" }),
    ).toBeVisible();

    await page
      .getByPlaceholder("New password", { exact: true })
      .fill("Password123");
    await page
      .getByPlaceholder("Confirm new password", { exact: true })
      .fill("Password124");
    await page.getByRole("button", { name: "Update password" }).click();

    await expect(page.getByText("Passwords do not match.")).toBeVisible();
  });

  test("shows backend error when reset update fails", async ({ page }) => {
    await page.route("**/auth/v1/user*", async (route) => {
      await route.fulfill({
        status: 400,
        contentType: "application/json",
        body: JSON.stringify({
          msg: "Session expired",
          error_description: "Session expired",
        }),
      });
    });

    await page.goto("/reset-password");

    await page
      .getByPlaceholder("New password", { exact: true })
      .fill("Password123");
    await page
      .getByPlaceholder("Confirm new password", { exact: true })
      .fill("Password123");
    await page.getByRole("button", { name: "Update password" }).click();

    await expect(page.getByText(/Password reset failed:/)).toBeVisible();
  });
});
