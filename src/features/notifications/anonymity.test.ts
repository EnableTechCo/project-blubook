import { describe, expect, it } from "vitest";
import {
  assertNoIdentityLeak,
  opaqueReference,
  providerLabel,
  serializeCustomerNotification,
  serializeProviderNotification,
  type CustomerNotificationEvent,
} from "./anonymity";

const WR = "3f6b2c9a-1111-4111-8111-111111111111";
const ITEM = "aa11bb22-2222-4222-8222-222222222222";

// Values a message must never contain, whichever side is reading.
const PROVIDER_NAME = "WNS";
const CUSTOMER_ORG = "QA Test Org (Customer)";

describe("opaqueReference", () => {
  it("is deterministic and prefixed by kind", () => {
    expect(opaqueReference(WR, "REQ")).toBe("REQ-3F6B2C9A");
    expect(opaqueReference(ITEM, "WO")).toBe("WO-AA11BB22");
    expect(opaqueReference(WR, "REQ")).toBe(opaqueReference(WR, "REQ"));
  });

  it("reveals nothing beyond a fragment of the id", () => {
    const ref = opaqueReference(WR, "REQ");
    expect(ref).not.toContain(CUSTOMER_ORG);
    expect(ref.length).toBeLessThan(WR.length);
  });
});

describe("providerLabel", () => {
  it("names the service, never the provider", () => {
    expect(providerLabel("Logistics")).toBe("your Logistics provider");
    expect(providerLabel("Logistics")).not.toContain(PROVIDER_NAME);
  });

  it("degrades gracefully without a service name", () => {
    expect(providerLabel("")).toBe("your provider");
    expect(providerLabel("   ")).toBe("your provider");
  });
});

describe("serializeCustomerNotification", () => {
  const base = { workRequestId: WR, workRequestItemId: ITEM };

  it("explains auto-added prerequisites, with correct singular/plural", () => {
    expect(
      serializeCustomerNotification({
        ...base,
        event: "work_orders_auto_added",
        itemCount: 1,
      }).message,
    ).toContain("1 required step to your request");

    expect(
      serializeCustomerNotification({
        ...base,
        event: "work_orders_auto_added",
        itemCount: 4,
      }).message,
    ).toContain("4 required steps");
  });

  it("says what a queued item is waiting for", () => {
    const { message } = serializeCustomerNotification({
      ...base,
      event: "work_order_queued",
      label: "Invoicing",
      blockedByLabel: "Order processing",
    });
    expect(message).toContain("Invoicing");
    expect(message).toContain("Order processing");
  });

  it("falls back when the blocking item is unknown", () => {
    const { message } = serializeCustomerNotification({
      ...base,
      event: "work_order_queued",
      label: "Invoicing",
    });
    expect(message).toContain("queued behind other work");
  });

  it("refers to the provider only by their service", () => {
    const { message } = serializeCustomerNotification({
      ...base,
      event: "work_order_started",
      label: "Invoicing",
      serviceName: "Sales Ops",
    });
    expect(message).toContain("your Sales Ops provider");
    expect(message).not.toContain(PROVIDER_NAME);
  });

  it("uses an opaque reference when the request completes", () => {
    const { message } = serializeCustomerNotification({
      ...base,
      event: "work_request_completed",
    });
    expect(message).toContain("REQ-3F6B2C9A");
    expect(message).not.toContain(WR); // never the raw id
  });

  it("produces a message for every customer event", () => {
    const events: CustomerNotificationEvent[] = [
      "work_orders_auto_added",
      "work_order_queued",
      "work_order_started",
      "work_order_completed",
      "work_request_completed",
    ];
    for (const event of events) {
      const { message, metadata } = serializeCustomerNotification({
        ...base,
        event,
        label: "Invoicing",
        serviceName: "Sales Ops",
        itemCount: 2,
      });
      expect(message.length).toBeGreaterThan(0);
      expect(metadata.audience).toBe("customer");
      expect(metadata.event).toBe(event);
      // A customer is never told which company is doing the work.
      expect(message).not.toContain(PROVIDER_NAME);
    }
  });
});

describe("serializeProviderNotification", () => {
  const input = {
    event: "work_order_assigned" as const,
    workRequestItemId: ITEM,
    label: "Invoicing",
    serviceName: "Sales Ops",
  };

  it("tells the provider what the work is", () => {
    const { message } = serializeProviderNotification(input);
    expect(message).toContain("Sales Ops");
    expect(message).toContain("Invoicing");
    expect(message).toContain("WO-AA11BB22");
  });

  it("says nothing about the customer or their request", () => {
    const { message, metadata } = serializeProviderNotification(input);

    expect(message).not.toContain(CUSTOMER_ORG);
    expect(message).not.toContain(WR);
    expect(message.toLowerCase()).not.toContain("customer");

    expect(metadata).toEqual({
      source: "work_request_lifecycle",
      event: "work_order_assigned",
      audience: "provider",
      work_request_item_id: ITEM,
    });
  });
});

describe("assertNoIdentityLeak", () => {
  it("blocks a provider payload carrying identity", () => {
    expect(() =>
      assertNoIdentityLeak({ work_request_id: WR }, "provider"),
    ).toThrow(/customer identity/);
    expect(() =>
      assertNoIdentityLeak({ organization_id: "org1" }, "provider"),
    ).toThrow();
  });

  it("allows a clean provider payload", () => {
    expect(() =>
      assertNoIdentityLeak({ work_request_item_id: ITEM }, "provider"),
    ).not.toThrow();
  });

  it("does not restrict customer payloads — their own request is not a leak", () => {
    expect(() =>
      assertNoIdentityLeak({ work_request_id: WR }, "customer"),
    ).not.toThrow();
  });
});
