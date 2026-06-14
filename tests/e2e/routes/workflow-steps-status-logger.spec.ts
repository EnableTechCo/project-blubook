import { expect, test } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";

const CUSTOMER_EMAIL = "ignatius@e-t.co.za";
const CUSTOMER_PASSWORD = "DBPass123!";
const DASHBOARD_LOAD_TIMEOUT_MS = 420000;
const TEST_TIMEOUT_MS = 720000;

const WORKFLOW_STEPS = [
  "PO Submitted",
  "Sales Validated",
  "Inventory Reserved",
  "Handoff Created (Sales Confirmed PO)",
  "Handoff Confirmed (Logistics Accepted)",
  "Logistics Active",
  "In Transit",
  "Arrived",
  "POD Signed",
  "System Updated",
  "Delivered",
] as const;

test("logs workflow step statuses for ignatius@e-t.co.za", async ({
  page,
}, testInfo) => {
  test.setTimeout(TEST_TIMEOUT_MS);

  const logPrefix = "[workflow-status-logger]";
  const outputLines: string[] = ["[Workflow Step Statuses]"];

  const log = (message: string, data?: unknown) => {
    if (data === undefined) {
      console.log(`${logPrefix} ${message}`);
      outputLines.push(`- ${message}`);
      return;
    }

    const serialized =
      typeof data === "string"
        ? data
        : JSON.stringify(
            data,
            (_key, value) => {
              if (value instanceof Error) {
                return { name: value.name, message: value.message };
              }
              return value;
            },
            2,
          );

    console.log(`${logPrefix} ${message}: ${serialized}`);
    outputLines.push(`- ${message}: ${serialized}`);
  };

  page.on("console", (msg) => {
    log(`browser console [${msg.type()}]`, msg.text());
  });

  page.on("pageerror", (error) => {
    log("browser pageerror", error.message);
  });

  page.on("requestfailed", (request) => {
    log("request failed", {
      url: request.url(),
      method: request.method(),
      errorText: request.failure()?.errorText ?? "unknown",
    });
  });

  const performLogin = async () => {
    log("login flow started", {
      email: CUSTOMER_EMAIL,
      dashboardTimeoutMs: DASHBOARD_LOAD_TIMEOUT_MS,
    });

    await page.goto("/login", { waitUntil: "domcontentloaded" });
    log("navigated to /login", { url: page.url() });

    const emailInput = page.locator("#login-email");
    const passwordInput = page.locator("#login-password");
    const statusMessage = page.locator("p.text-sm.text-red-300");

    await emailInput.waitFor({ state: "visible" });
    log("email input visible");
    await passwordInput.waitFor({ state: "visible" });
    log("password input visible");
    await expect(emailInput).toBeEditable();
    log("email input editable assertion passed");
    await expect(passwordInput).toBeEditable();
    log("password input editable assertion passed");
    await page.waitForLoadState("networkidle");
    log("login page reached networkidle");
    await page.evaluate(
      () =>
        new Promise<void>((resolve) => {
          requestAnimationFrame(() => {
            requestAnimationFrame(() => resolve());
          });
        }),
    );
    log("double requestAnimationFrame hydration wait complete");

    const loginButton = page
      .getByRole("button", { name: "Login", exact: true })
      .first();
    await loginButton.waitFor({ state: "visible" });
    log("login button visible");

    const fillInput = async (
      input: typeof emailInput,
      value: string,
      fieldName: string,
    ) => {
      for (let attempt = 1; attempt <= 3; attempt += 1) {
        await input.focus();
        await input.evaluate((element, nextValue) => {
          const descriptor = Object.getOwnPropertyDescriptor(
            HTMLInputElement.prototype,
            "value",
          );

          descriptor?.set?.call(element, nextValue);
          element.dispatchEvent(new Event("input", { bubbles: true }));
          element.dispatchEvent(new Event("change", { bubbles: true }));
        }, value);
        await input.blur();

        const actualValue = await input.inputValue();
        log(`fill attempt ${attempt} for ${fieldName}`, {
          expected: value,
          actual: actualValue,
        });
        if (actualValue === value) {
          log(`${fieldName} filled successfully`, { attempt });
          return;
        }
      }

      throw new Error(`Could not reliably fill ${fieldName}.`);
    };

    for (let attempt = 1; attempt <= 3; attempt += 1) {
      log(`login attempt started`, { attempt });
      await fillInput(emailInput, CUSTOMER_EMAIL, "email");
      await fillInput(passwordInput, CUSTOMER_PASSWORD, "password");

      await expect(loginButton).toBeEnabled();
      log("login button enabled assertion passed", { attempt });
      await loginButton.scrollIntoViewIfNeeded();
      log("login button scrolled into view", { attempt });
      await loginButton.click();
      log("login button clicked", { attempt });

      const loginOutcome = (await page
        .waitForFunction(
          () => {
            if (
              /^\/customer\/dashboard(?:\/|$)/.test(window.location.pathname)
            ) {
              return "dashboard";
            }

            const statusText = document
              .querySelector("p.text-sm.text-red-300")
              ?.textContent?.trim();

            return statusText ? `error:${statusText}` : null;
          },
          undefined,
          {
            timeout: DASHBOARD_LOAD_TIMEOUT_MS,
          },
        )
        .then((handle) => handle.jsonValue())) as string;

      log("login outcome observed", {
        attempt,
        loginOutcome,
        currentUrl: page.url(),
      });

      if (loginOutcome === "dashboard") {
        log("login succeeded, dashboard reached", { attempt, url: page.url() });
        return;
      }

      const statusText = loginOutcome.replace(/^error:/, "");
      if (statusText === "Email and password are required." && attempt < 3) {
        log("retrying login due to transient empty credentials error", {
          attempt,
          statusText,
        });
        await page.goto("/login", { waitUntil: "domcontentloaded" });
        await emailInput.waitFor({ state: "visible" });
        await passwordInput.waitFor({ state: "visible" });
        await loginButton.waitFor({ state: "visible" });
        log("login page ready for retry", { attempt: attempt + 1 });
        continue;
      }

      throw new Error(
        `Login click executed but authentication failed: ${statusText}`,
      );
    }

    const finalStatusText = (await statusMessage.textContent())?.trim();
    log("login failed after retries", {
      finalStatusText: finalStatusText ?? null,
      finalUrl: page.url(),
    });
    throw new Error(
      finalStatusText
        ? `Login click executed but authentication failed after 3 attempts: ${finalStatusText}`
        : "Login did not reach /customer/dashboard after 3 attempts.",
    );
  };

  // 1) Visit login page.
  log("STEP 1: performing login");
  await performLogin();
  log("STEP 1 complete: logged in", { url: page.url() });

  const postLoginRenderStart = Date.now();
  outputLines.push(`- URL (start): ${page.url()}`);

  // 5) Wait for the PO card and its upload button to render.
  log("STEP 2: waiting for Purchase Order Upload section");
  const purchaseOrderCard = page
    .locator("section")
    .filter({
      has: page.getByRole("heading", {
        name: "Purchase Order Upload",
        exact: true,
      }),
    })
    .first();

  await purchaseOrderCard.waitFor({
    state: "visible",
    timeout: DASHBOARD_LOAD_TIMEOUT_MS,
  });
  const purchaseOrderCardRenderMs = Date.now() - postLoginRenderStart;
  outputLines.push(
    `- Purchase Order Upload section rendered in: ${purchaseOrderCardRenderMs} ms`,
  );
  log("Purchase Order Upload section rendered", {
    purchaseOrderCardRenderMs,
  });

  const uploadButton = purchaseOrderCard
    .getByRole("button", { name: /^Upload\b/i })
    .first();

  await uploadButton.waitFor({
    state: "visible",
    timeout: DASHBOARD_LOAD_TIMEOUT_MS,
  });
  const uploadButtonRenderMs = Date.now() - postLoginRenderStart;
  outputLines.push(`- Upload button rendered in: ${uploadButtonRenderMs} ms`);
  log("Upload button rendered", { uploadButtonRenderMs });
  await expect(uploadButton).toBeEnabled({
    timeout: DASHBOARD_LOAD_TIMEOUT_MS,
  });
  log("upload button enabled assertion passed");

  // 7) Pick any PDF from public/test-docs.
  log("STEP 3: selecting PDF for upload");
  const docsDir = path.resolve(process.cwd(), "public/test-docs");
  const docEntries = await fs.readdir(docsDir);
  const firstPdf = docEntries.find((entry) =>
    entry.toLowerCase().endsWith(".pdf"),
  );
  if (!firstPdf) {
    throw new Error("No PDF file found in public/test-docs.");
  }
  const filePath = path.resolve(docsDir, firstPdf);
  log("selected PDF", { filePath, docsDir, totalEntries: docEntries.length });

  const kickoffResponsePromise = page.waitForResponse(
    (response) =>
      response.url().includes("/api/customer/workflow/po-uploaded") &&
      response.request().method() === "POST",
  );
  log("waiting for /api/customer/workflow/po-uploaded POST response");

  // 6) Click Upload Purchase Order.
  log("STEP 4: opening file chooser and uploading");
  const [fileChooser] = await Promise.all([
    page.waitForEvent("filechooser"),
    uploadButton.click(),
  ]);
  log("file chooser opened");

  await fileChooser.setFiles(filePath);
  log("file set on chooser", { filePath });

  // 8) Wait for upload + kickoff completion.
  const kickoffResponse = await kickoffResponsePromise;
  const kickoffBody = await kickoffResponse.text().catch(() => "<no-body>");
  log("kickoff response received", {
    status: kickoffResponse.status(),
    ok: kickoffResponse.ok(),
    body: kickoffBody,
  });
  outputLines.push(`- API /po-uploaded status: ${kickoffResponse.status()}`);
  outputLines.push(`- API /po-uploaded ok: ${kickoffResponse.ok()}`);

  expect(kickoffResponse.ok()).toBeTruthy();
  log("kickoff response ok assertion passed");

  await expect(
    page.getByText(/Purchase Order uploaded:/i).first(),
  ).toBeVisible();
  log("upload success toast visible assertion passed");
  await expect(
    page
      .getByText(/Workflow started for|Workflow kickoff is processing/i)
      .first(),
  ).toBeVisible();
  log("workflow kickoff toast visible assertion passed");

  await expect(page).toHaveURL(/\/customer\/dashboard/);
  log("dashboard URL assertion passed", { url: page.url() });
  outputLines.push(`- URL (after upload): ${page.url()}`);

  await expect(
    page.getByRole("heading", { name: "PO Workflow Progress", exact: true }),
  ).toBeVisible({ timeout: DASHBOARD_LOAD_TIMEOUT_MS });
  log("PO Workflow Progress heading visible assertion passed");

  const workflowProgressCard = page
    .locator("section")
    .filter({
      has: page.getByRole("heading", {
        name: "PO Workflow Progress",
        exact: true,
      }),
    })
    .first();

  await workflowProgressCard.waitFor({
    state: "visible",
    timeout: DASHBOARD_LOAD_TIMEOUT_MS,
  });
  log("workflow progress card visible");

  // The test is only successful when workflow steps are actually rendered.
  await expect(
    workflowProgressCard.getByText("PO Submitted", { exact: true }),
  ).toBeVisible({ timeout: DASHBOARD_LOAD_TIMEOUT_MS });
  log("PO Submitted step visible assertion passed");

  // 9) Read rendered workflow step labels and log complete ones.
  log("STEP 5: collecting rendered/complete workflow steps");
  const progressRows = workflowProgressCard.locator(
    "div.flex.min-w-\\[170px\\].items-center.gap-2",
  );
  await progressRows.first().waitFor({
    state: "visible",
    timeout: DASHBOARD_LOAD_TIMEOUT_MS,
  });

  const rightScrollButton = workflowProgressCard
    .getByRole("button", { name: "Scroll workflow steps right" })
    .first();

  const leftScrollButton = workflowProgressCard
    .getByRole("button", { name: "Scroll workflow steps left" })
    .first();

  if (await leftScrollButton.isVisible()) {
    const leftDisabled = await leftScrollButton.isDisabled();
    if (!leftDisabled) {
      await leftScrollButton.click();
    }
  }

  const seenSteps = new Set<string>();
  const completeSteps = new Set<string>();

  const collectVisibleSteps = async () => {
    const count = await progressRows.count();
    log("collectVisibleSteps iteration", { rowCount: count });

    for (let i = 0; i < count; i += 1) {
      const row = progressRows.nth(i);
      const label =
        (await row.locator("p").first().textContent())?.trim() ?? "";
      if (!WORKFLOW_STEPS.includes(label as (typeof WORKFLOW_STEPS)[number])) {
        continue;
      }

      seenSteps.add(label);
      const iconClasses =
        (await row
          .locator("div.inline-flex.rounded-full")
          .first()
          .getAttribute("class")) ?? "";

      log("row inspected", {
        index: i,
        label,
        iconClasses,
      });

      if (iconClasses.includes("emerald")) {
        completeSteps.add(label);
        log("step marked complete", { label });
      }
    }
  };

  await collectVisibleSteps();
  for (let i = 0; i < WORKFLOW_STEPS.length; i += 1) {
    if (!(await rightScrollButton.isVisible())) {
      break;
    }

    const disabled = await rightScrollButton.isDisabled();
    if (disabled) {
      break;
    }

    await rightScrollButton.click();
    await page.waitForTimeout(150);
    await collectVisibleSteps();
  }

  expect(seenSteps.size).toBeGreaterThan(0);
  log("seen steps assertion passed", {
    seenStepsCount: seenSteps.size,
    completeStepsCount: completeSteps.size,
  });

  outputLines.push(`- URL (final): ${page.url()}`);
  outputLines.push(`- Steps rendered: ${seenSteps.size}`);
  outputLines.push(`- Steps marked complete: ${completeSteps.size}`);

  outputLines.push("- Completed workflow steps:");
  for (const step of WORKFLOW_STEPS) {
    if (completeSteps.has(step)) {
      outputLines.push(`  - ${step}`);
    }
  }

  outputLines.push("- Rendered workflow steps (shown/not shown):");
  for (const step of WORKFLOW_STEPS) {
    const shown = seenSteps.has(step);
    outputLines.push(`  - ${step}: ${shown ? "shown" : "not shown"}`);
  }

  outputLines.push(`- API /po-uploaded response body: ${kickoffBody}`);

  const output = outputLines.join("\n");
  console.log(output);
  await testInfo.attach("workflow-statuses", {
    contentType: "text/plain",
    body: Buffer.from(output, "utf-8"),
  });
});
