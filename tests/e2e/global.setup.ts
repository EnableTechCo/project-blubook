import { execSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import path from "node:path";
import type { FullConfig } from "@playwright/test";
import { chromium } from "@playwright/test";

const AUTH_STATE_DIR = path.resolve(process.cwd(), "playwright", ".auth");
const CUSTOMER_STATE_PATH = path.join(AUTH_STATE_DIR, "customer.json");
const SALES_STATE_PATH = path.join(AUTH_STATE_DIR, "sales.json");
const LOGISTICS_STATE_PATH = path.join(AUTH_STATE_DIR, "logistics.json");

type AccountSetup = {
  label: string;
  email: string;
  password: string;
  expectedUrl: RegExp;
  protectedPath: string;
  storageStatePath: string;
};

function runScript(command: string) {
  execSync(command, {
    stdio: "inherit",
    cwd: process.cwd(),
    env: process.env,
  });
}

async function loginAndSaveState(input: {
  baseUrl: string;
  account: AccountSetup;
}) {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    let lastStatus = "none";
    let lastUrl = "<unknown>";

    for (let attempt = 1; attempt <= 3; attempt += 1) {
      await page.goto(`${input.baseUrl}/login`, {
        waitUntil: "domcontentloaded",
        timeout: 120000,
      });

      await page.locator("#login-email").fill(input.account.email);
      await page.locator("#login-password").fill(input.account.password);
      await page.getByRole("button", { name: "Login", exact: true }).click();

      try {
        await page.waitForURL(input.account.expectedUrl, {
          timeout: 20000,
          waitUntil: "commit",
        });
      } catch {
        // Redirect can be flaky in dev; probe protected route directly.
      }

      if (input.account.expectedUrl.test(page.url())) {
        break;
      }

      await page.goto(`${input.baseUrl}${input.account.protectedPath}`, {
        waitUntil: "domcontentloaded",
        timeout: 30000,
      });

      if (input.account.expectedUrl.test(page.url())) {
        break;
      }

      const loginStatus = page.locator("p.text-red-300").first();
      const hasStatus = (await loginStatus.count()) > 0;
      lastStatus = hasStatus
        ? ((await loginStatus.textContent())?.trim() ?? "none")
        : "none";
      lastUrl = page.url();

      if (attempt === 3) {
        throw new Error(
          `[global-setup] Could not establish session for ${input.account.label} (${input.account.email}). URL=${lastUrl} status=${lastStatus}`,
        );
      }
    }

    await context.storageState({ path: input.account.storageStatePath });

    console.log(
      `[global-setup] auth state ready for ${input.account.label}: ${input.account.storageStatePath}`,
    );
  } finally {
    await context.close();
    await browser.close();
  }
}

export default async function globalSetup(config: FullConfig) {
  const baseUrl =
    config.projects[0]?.use?.baseURL?.toString() ?? "http://127.0.0.1:3000";

  mkdirSync(AUTH_STATE_DIR, { recursive: true });

  console.log("[global-setup] provisioning workflow actors");
  runScript("node --env-file=.env.local scripts/provision-sales-workflow-partner.mjs");
  runScript("node --env-file=.env.local scripts/seed-logistics-account.mjs");

  const accounts: AccountSetup[] = [
    {
      label: "customer",
      email: "ignatius@e-t.co.za",
      password: "DBPass123!",
      expectedUrl: /\/customer\/(dashboard|requests)/,
      protectedPath: "/customer/dashboard",
      storageStatePath: CUSTOMER_STATE_PATH,
    },
    {
      label: "sales-partner",
      email: "sales-ticks.partner@mock.blubook.local",
      password: "DBPass123!",
      expectedUrl: /\/partner\//,
      protectedPath: "/partner/dashboard",
      storageStatePath: SALES_STATE_PATH,
    },
    {
      label: "logistics-partner",
      email: "call-force-outsourcing.partner@mock.blubook.local",
      password: "DBPass123!",
      expectedUrl: /\/partner\//,
      protectedPath: "/partner/dashboard",
      storageStatePath: LOGISTICS_STATE_PATH,
    },
  ];

  for (const account of accounts) {
    await loginAndSaveState({
      baseUrl,
      account,
    });
  }
}
