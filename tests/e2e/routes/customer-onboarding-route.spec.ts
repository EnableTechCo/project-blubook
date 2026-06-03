import { expect, test } from "@playwright/test";

test.describe("Customer onboarding route", () => {
  test("renders the customer onboarding summary route", async ({ page }) => {
    await page.goto("/customer/onboarding", { waitUntil: "domcontentloaded" });

    await expect(
      page.getByRole("heading", { name: "Onboarding Summary", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "View onboarding flow", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Business Profile", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", {
        name: "Operational Profile",
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", {
        name: "Activated Suite Requests",
        exact: true,
      }),
    ).toBeVisible();
  });
});
