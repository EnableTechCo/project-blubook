import { expect, test } from "@playwright/test";

test.describe("invite", () => {
  test("loads invite page with prefilled details", async ({ page }) => {
    await page.goto(
      "/invite?token=abc123&email=user@example.com&name=Invite%20User",
    );

    await expect(page).toHaveURL(/\/invite/);
    await expect(
      page.getByRole("heading", { name: "Accept Invite" }),
    ).toBeVisible();
    await expect(page.getByPlaceholder("Email")).toHaveValue(
      "user@example.com",
    );
    await expect(page.getByPlaceholder("Full name")).toHaveValue("Invite User");
  });

  test("shows activation failure status", async ({ page }) => {
    await page.route("**/api/auth/invitations/accept", async (route) => {
      await route.fulfill({
        status: 400,
        contentType: "application/json",
        body: JSON.stringify({ error: "Invite is expired" }),
      });
    });

    await page.goto(
      "/invite?token=abc123&email=user@example.com&name=Invite%20User",
    );
    await page.getByPlaceholder("Create password").fill("Password123");
    await page.getByRole("button", { name: "Activate account" }).click();

    await expect(
      page.getByText("Invite verification failed: Invite is expired"),
    ).toBeVisible();
  });

  test("shows success status when activation and login succeed", async ({
    page,
  }) => {
    await page.route("**/api/auth/invitations/accept", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({}),
      });
    });

    await page.route("**/auth/v1/token*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          access_token: "test-access-token",
          token_type: "bearer",
          expires_in: 3600,
          expires_at: 9999999999,
          refresh_token: "test-refresh-token",
          user: {
            id: "user-1",
            aud: "authenticated",
            role: "authenticated",
            email: "user@example.com",
            user_metadata: {
              role: "customer",
            },
          },
        }),
      });
    });

    await page.goto(
      "/invite?token=abc123&email=user@example.com&name=Invite%20User",
    );
    await page.getByPlaceholder("Create password").fill("Password123");
    await page.getByRole("button", { name: "Activate account" }).click();

    await expect(
      page.getByText(
        "Invite accepted. You can now continue into the platform.",
      ),
    ).toBeVisible();
  });
});
