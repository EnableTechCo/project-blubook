import { test } from "@playwright/test";

test("visits login page", async ({ page }) => {
  test.setTimeout(0);
  page.setDefaultTimeout(0);
  page.setDefaultNavigationTimeout(0);

  await page.goto("/login", { waitUntil: "domcontentloaded" });

  await page.waitForLoadState("networkidle");
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => resolve());
        });
      }),
  );

  const emailField = page.locator("#login-email");
  const passwordField = page.locator("#login-password");
  const loginButton = page.getByRole("button", { name: "Login", exact: true });
  const emailAddress = "ignatius@e-t.co.za";
  const password = "DBPass123!";

  const emailFound = await emailField.count().then((count) => count > 0);
  const passwordFound = await passwordField.count().then((count) => count > 0);
  const loginFound = await loginButton.count().then((count) => count > 0);

  console.log(`[login-page] email found: ${emailFound}`);
  console.log(`[login-page] password found: ${passwordFound}`);
  console.log(`[login-page] login found: ${loginFound}`);

  const fillAndConfirm = async (field: typeof emailField, value: string) => {
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      await field.fill(value);
      const fieldFilled = (await field.inputValue()) === value;
      console.log(
        `[login-page] filled ${value === emailAddress ? "email" : "password"}: ${fieldFilled}`,
      );

      if (fieldFilled) {
        return true;
      }

      console.log(
        `[login-page] retrying ${value === emailAddress ? "email" : "password"} fill, attempt ${attempt}`,
      );
    }

    return false;
  };

  const emailFilled = await fillAndConfirm(emailField, emailAddress);
  const passwordFilled = await fillAndConfirm(passwordField, password);

  console.log(`[login-page] final email filled: ${emailFilled}`);
  console.log(`[login-page] final password filled: ${passwordFilled}`);
  console.log(`[login-page] email value: ${await emailField.inputValue()}`);
  console.log(
    `[login-page] password value: ${await passwordField.inputValue()}`,
  );

  if (!emailFilled || !passwordFilled) {
    throw new Error("Email or password could not be filled after 3 attempts.");
  }

  await page.waitForLoadState("networkidle");
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => resolve());
        });
      }),
  );

  const loginClicked = true;

  await loginButton.click({ noWaitAfter: true });
  console.log(`[login-page] login clicked: ${loginClicked}`);

  await page.waitForURL(/\/customer\/dashboard|\/partner\/|\/login(?:\?|$)/);
  await page.waitForTimeout(1000);

  // Log any visible status/error text from the login page.
  const statusMsg = await page
    .locator("text=/Email and password|invalid|error|authentication/i")
    .first()
    .textContent()
    .catch(() => null);
  if (statusMsg) {
    console.log(`[login-page] error on page: ${statusMsg}`);
  }

  const navigatedToCustomerDashboard = /\/customer\/dashboard(?:\/|$)/.test(
    page.url(),
  );
  console.log(
    `[login-page] navigated to customer/dashboard after login: ${navigatedToCustomerDashboard}`,
  );
  console.log(`[login-page] final url after login: ${page.url()}`);

  if (navigatedToCustomerDashboard) {
    const postLoginRenderStart = Date.now();
    console.log("[login-page] waiting for dashboard to render...");

    // Wait for Purchase Order section heading
    const poHeading = page.getByRole("heading", { name: /purchase order/i });
    await poHeading.waitFor({ state: "visible" });
    const poRenderTime = Date.now() - postLoginRenderStart;
    console.log(`[login-page] PO section visible after ${poRenderTime}ms`);

    // Wait for upload button
    const uploadButton = page.getByRole("button", { name: /upload/i }).first();
    await uploadButton.waitFor({ state: "visible" });
    const uploadButtonRenderTime = Date.now() - postLoginRenderStart;
    console.log(
      `[login-page] Upload button visible after ${uploadButtonRenderTime}ms`,
    );

    console.log(
      "[login-page] dashboard and PO section confirmed. Keeping page open for 15 seconds...",
    );
    await page.waitForTimeout(15000);
  } else {
    console.log(
      "[login-page] did not reach customer dashboard; leaving additional 15s for manual inspection.",
    );
    await page.waitForTimeout(15000);
  }
});
