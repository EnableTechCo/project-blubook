import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";

const {
  createAdminClientMock,
  queueEmailMock,
  dispatchQueuedEmailsMock,
  persistAutomationMock,
} = vi.hoisted(() => ({
  createAdminClientMock: vi.fn(),
  queueEmailMock: vi.fn(),
  dispatchQueuedEmailsMock: vi.fn(),
  persistAutomationMock: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: createAdminClientMock,
}));

vi.mock("@/lib/email/dispatcher", () => ({
  queueEmail: queueEmailMock,
  dispatchQueuedEmails: dispatchQueuedEmailsMock,
}));

vi.mock("@/features/ai/automations/onboarding-intelligence", () => ({
  persistCustomerOnboardingAutomation: persistAutomationMock,
}));

vi.mock("@/lib/env", () => ({
  assertCustomerOnboardingServerEnv: vi.fn(),
}));

import { POST } from "./route";

const originalServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

type QueryResult = { data?: unknown; error?: unknown };

type QueryChain = {
  select: () => QueryChain;
  eq: () => QueryChain;
  insert: () => QueryChain;
  update: () => QueryChain;
  upsert: () => QueryChain;
  single: () => Promise<QueryResult>;
  maybeSingle: () => Promise<QueryResult>;
};

function createChain(result: QueryResult) {
  const chain: QueryChain = {
    select: () => chain,
    eq: () => chain,
    insert: () => chain,
    update: () => chain,
    upsert: () => chain,
    single: async () => result,
    maybeSingle: async () => result,
  };

  chain.select = vi.fn(() => chain);
  chain.eq = vi.fn(() => chain);
  chain.insert = vi.fn(() => chain);
  chain.update = vi.fn(() => chain);
  chain.upsert = vi.fn(() => chain);
  chain.single = vi.fn(async () => result);
  chain.maybeSingle = vi.fn(async () => result);

  return chain;
}

function createAdminClient(results: Record<string, QueryResult>) {
  const chains = Object.fromEntries(
    Object.entries(results).map(([table, result]) => [
      table,
      createChain(result),
    ]),
  );

  const createUser = vi.fn(async () => ({
    data: { user: { id: "user-1", email: "customer@example.com" } },
    error: null,
  }));

  return {
    auth: {
      admin: {
        createUser,
        deleteUser: vi.fn(async () => ({ error: null })),
      },
    },
    from: vi.fn(
      (table: string) => chains[table] ?? createChain({ data: null }),
    ),
    rpc: vi.fn(async () => ({ error: null })),
  };
}

function buildValidPayload() {
  return {
    email: "customer@example.com",
    password: "password123",
    fullName: "Customer One",
    packageTier: "starter",
    onboarding: {
      businessTitle: "Customer One Trading",
      businessSummary: "A growing wholesale business.",
      primaryIndustry: "Retail",
      subIndustry: null,
      businessModel: "seller",
      customerSegment: "b2b",
      salesChannels: ["own_website"],
      inventoryModel: "own_stock",
      fulfillmentModel: "in_house",
      annualRevenueBand: "under_1m",
      monthlyOrderVolumeBand: "under_100",
      companyType: "llc",
      employees: "1-20",
      country: "South Africa",
      city: "Cape Town",
      inventoryHandling: "in_house",
      regions: ["domestic"],
      regulated: false,
    },
  };
}

describe("POST /api/auth/customer-account", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key";
  });

  afterEach(() => {
    if (originalServiceRoleKey === undefined) {
      delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    } else {
      process.env.SUPABASE_SERVICE_ROLE_KEY = originalServiceRoleKey;
    }
  });

  it("rejects invalid payloads before touching Supabase", async () => {
    const response = await POST(
      new Request("http://localhost/api/auth/customer-account", {
        method: "POST",
        body: JSON.stringify({ email: "invalid" }),
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: expect.any(String),
    });
    expect(createAdminClientMock).not.toHaveBeenCalled();
  });

  it("creates the customer account and onboarding records", async () => {
    const payload = buildValidPayload();
    const adminClient = createAdminClient({
      service_packages: {
        data: {
          id: "package-1",
          code: payload.packageTier,
          name: "Starter",
          billing_interval: "monthly",
          currency_code: "ZAR",
          unit_amount_cents: 125000,
        },
      },
      organizations: { data: { id: "org-1" } },
      user_profiles: { data: null },
      organization_memberships: { data: { id: "membership-1" } },
      customer_onboarding_submissions: { data: { id: "submission-1" } },
      subscriptions: { data: { id: "subscription-1" } },
      invoices: { data: { id: "invoice-1" } },
      invoice_line_items: { data: null },
    });

    createAdminClientMock.mockReturnValue(adminClient);
    queueEmailMock.mockResolvedValue(undefined);
    dispatchQueuedEmailsMock.mockResolvedValue(undefined);
    persistAutomationMock.mockResolvedValue(undefined);

    const response = await POST(
      new Request("http://localhost/api/auth/customer-account", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    );

    expect(response.status).toBe(200);
    const body = await response.json();

    expect(body).toMatchObject({
      userId: "user-1",
      email: payload.email,
      organizationId: "org-1",
      subscriptionId: "subscription-1",
    });
    expect(body.invoiceNumber).toMatch(/^INV-/);
    expect(adminClient.auth.admin.createUser).toHaveBeenCalledWith(
      expect.objectContaining({
        email: payload.email,
        password: payload.password,
        email_confirm: true,
      }),
    );
    expect(queueEmailMock).toHaveBeenCalledWith(
      expect.objectContaining({
        templateKey: "customer-onboarding-complete",
        toEmail: payload.email,
        organizationId: "org-1",
        invoiceId: "invoice-1",
      }),
    );
    expect(dispatchQueuedEmailsMock).toHaveBeenCalledWith(5);
    expect(persistAutomationMock).toHaveBeenCalledTimes(1);
  });
});
