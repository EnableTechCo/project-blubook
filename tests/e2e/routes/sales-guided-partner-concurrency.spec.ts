import { expect, test, type Browser, type Page } from "@playwright/test";

const STAFF_EMAIL =
  process.env.SALES_WORKFLOW_TEST_EMAIL ??
  "staff.workflow.test@mock.blubook.local";
const STAFF_PASSWORD = process.env.SALES_WORKFLOW_TEST_PASSWORD ?? "DBPass123!";
const PARTNER_EMAIL =
  process.env.SALES_WORKFLOW_PARTNER_EMAIL ??
  "partner.workflow.test@mock.blubook.local";
const PARTNER_PASSWORD =
  process.env.SALES_WORKFLOW_PARTNER_PASSWORD ?? "DBPass123!";

async function safeCloseContext(
  context: Awaited<ReturnType<Browser["newContext"]>>,
) {
  if (context.isClosed()) {
    return;
  }

  await context.close().catch(() => {
    // Ignore teardown errors when Playwright already closed the context on timeout.
  });
}

async function login(page: Page, email: string, password: string) {
  await page.goto("/login", { waitUntil: "domcontentloaded" });
  await page.getByLabel("Email address", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Login", exact: true }).click();
}

async function openStaffSalesOrders(page: Page) {
  await login(page, STAFF_EMAIL, STAFF_PASSWORD);
  await page.goto("/sales/orders", { waitUntil: "domcontentloaded" });

  const loadingIndicator = page.getByText("Loading sales orders dashboard...", {
    exact: true,
  });
  await expect(loadingIndicator).toBeHidden({ timeout: 45000 });

  await expect(
    page.getByRole("button", { name: "Start Guided Test", exact: true }),
  ).toBeVisible({ timeout: 30000 });
}

async function openPartnerWorkOrders(page: Page) {
  await login(page, PARTNER_EMAIL, PARTNER_PASSWORD);
  await page.goto("/partner/work-orders", { waitUntil: "domcontentloaded" });

  const loadingIndicator = page.getByText("Loading partner work orders...", {
    exact: true,
  });
  await expect(loadingIndicator).toBeHidden({ timeout: 45000 });

  await expect(
    page.getByText("Partner Fulfillment Queue", { exact: true }),
  ).toBeVisible({ timeout: 30000 });
}

async function completePartnerTask(page: Page) {
  const noTasksText = page.getByText("No partner handoffs assigned yet.", {
    exact: true,
  });

  await expect
    .poll(
      async () => {
        await page.reload({ waitUntil: "domcontentloaded" });
        const hasNoTasks = await noTasksText.isVisible().catch(() => false);
        if (hasNoTasks) return "empty";

        const acceptButton = page.getByRole("button", {
          name: "Accept",
          exact: true,
        });
        const startButton = page.getByRole("button", {
          name: "Start Work",
          exact: true,
        });
        const completeButton = page.getByRole("button", {
          name: "Mark Complete",
          exact: true,
        });

        if (
          await acceptButton
            .first()
            .isVisible()
            .catch(() => false)
        )
          return "pending";
        if (
          await startButton
            .first()
            .isVisible()
            .catch(() => false)
        )
          return "accepted";
        if (
          await completeButton
            .first()
            .isVisible()
            .catch(() => false)
        )
          return "in_progress";

        return "unknown";
      },
      {
        timeout: 45000,
        message: "A partner handoff should appear in partner queue.",
      },
    )
    .not.toBe("empty");

  const acceptButton = page.getByRole("button", {
    name: "Accept",
    exact: true,
  });
  if (
    await acceptButton
      .first()
      .isVisible()
      .catch(() => false)
  ) {
    await acceptButton.first().click();
  }

  const startButton = page.getByRole("button", {
    name: "Start Work",
    exact: true,
  });
  await expect(startButton.first()).toBeVisible({ timeout: 15000 });
  await startButton.first().click();

  const completeButton = page.getByRole("button", {
    name: "Mark Complete",
    exact: true,
  });
  await expect(completeButton.first()).toBeVisible({ timeout: 15000 });
  await completeButton.first().click();

  await expect(
    page.getByText(
      "Partner work completed and pushed back into sales workflow.",
      {
        exact: true,
      },
    ),
  ).toBeVisible({ timeout: 20000 });
}

test.describe("Sales guided workflow with partner concurrency", () => {
  test.setTimeout(180000);

  test("staff guided test pauses for partner and resumes after partner completion", async ({
    browser,
  }: {
    browser: Browser;
  }) => {
    const staffContext = await browser.newContext();
    const partnerContext = await browser.newContext();
    const staffPage = await staffContext.newPage();
    const partnerPage = await partnerContext.newPage();

    try {
      await openStaffSalesOrders(staffPage);
      await openPartnerWorkOrders(partnerPage);

      await staffPage
        .getByRole("button", { name: "Start Guided Test", exact: true })
        .click();

      const staffGuidedError = staffPage.getByText("Guided test error:", {
        exact: false,
      });

      await expect
        .poll(
          async () => {
            const hasPartnerActionBanner = await staffPage
              .getByText(
                "Action required: sign in as the partner test user in another session",
                { exact: false },
              )
              .isVisible()
              .catch(() => false);

            if (hasPartnerActionBanner) {
              return "partner_action";
            }

            const hasGuidedError = await staffGuidedError
              .isVisible()
              .catch(() => false);
            if (hasGuidedError) {
              const errorText =
                (await staffGuidedError.textContent())?.trim() ?? "unknown";
              return `error:${errorText}`;
            }

            return "waiting";
          },
          {
            timeout: 75000,
            message:
              "Guided workflow should either pause for partner action or surface a guided error.",
          },
        )
        .toBe("partner_action");

      await completePartnerTask(partnerPage);

      await expect
        .poll(
          async () =>
            await staffPage
              .getByText(
                "Partner completion detected. Review the final order details, then finish the guided test.",
                {
                  exact: true,
                },
              )
              .isVisible()
              .catch(() => false),
          { timeout: 90000 },
        )
        .toBeTruthy();

      const continueButton = staffPage.getByRole("button", {
        name: "Continue",
        exact: true,
      });
      await expect(continueButton).toBeEnabled({ timeout: 15000 });
      await continueButton.click();

      await expect(
        staffPage.getByText(/Guided workflow test completed/i),
      ).toBeVisible({ timeout: 20000 });
    } finally {
      await Promise.allSettled([
        safeCloseContext(partnerContext),
        safeCloseContext(staffContext),
      ]);
    }
  });
});
