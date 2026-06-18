import { expect, test } from "@playwright/test";

test.describe("verify email", () => {
  test("loads the verify email page and shows login CTA", async ({ page }) => {
    await page.goto("/verify-email");

    await expect(page).toHaveURL(/\/verify-email\/?$/);
    await expect(
      page.getByRole("heading", { name: "Verify Email" }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "Go to Login" })).toBeVisible();
  });
});
