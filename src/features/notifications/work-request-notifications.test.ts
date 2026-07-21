import { describe, expect, it } from "vitest";
import {
  ALL_WORK_REQUEST_NOTIFICATION_EVENTS,
  WORK_REQUEST_NOTIFICATIONS,
  WORK_REQUEST_NOTIFICATION_SOURCE,
  audienceFor,
  buildNotificationMetadata,
  eventsForAudience,
  leaksIdentity,
} from "./work-request-notifications";

describe("work-request notification catalog", () => {
  it("covers every moment in the request lifecycle", () => {
    expect(ALL_WORK_REQUEST_NOTIFICATION_EVENTS.sort()).toEqual(
      [
        "work_order_assigned",
        "work_order_completed",
        "work_order_queued",
        "work_order_started",
        "work_orders_auto_added",
        "work_request_completed",
      ].sort(),
    );
  });

  it("keys every definition to itself, so lookups cannot drift", () => {
    for (const [key, definition] of Object.entries(WORK_REQUEST_NOTIFICATIONS)) {
      expect(definition.event).toBe(key);
      expect(definition.description.length).toBeGreaterThan(0);
    }
  });

  it("routes each event to exactly one audience", () => {
    const customer = eventsForAudience("customer");
    const provider = eventsForAudience("provider");

    expect(provider).toEqual(["work_order_assigned"]);
    expect(customer).toHaveLength(5);
    // No event is announced to both sides.
    expect(customer.filter((e) => provider.includes(e))).toEqual([]);
    expect(customer.length + provider.length).toBe(
      ALL_WORK_REQUEST_NOTIFICATION_EVENTS.length,
    );
  });

  it("reports the audience for an event", () => {
    expect(audienceFor("work_request_completed")).toBe("customer");
    expect(audienceFor("work_order_assigned")).toBe("provider");
  });
});

describe("buildNotificationMetadata", () => {
  it("tags every row with a queryable source, event and audience", () => {
    const metadata = buildNotificationMetadata({
      audience: "customer",
      event: "work_request_completed",
      context: { workRequestId: "wr1" },
    });

    expect(metadata).toMatchObject({
      source: WORK_REQUEST_NOTIFICATION_SOURCE,
      event: "work_request_completed",
      audience: "customer",
      work_request_id: "wr1",
    });
  });

  it("carries optional customer detail only when supplied", () => {
    const lean = buildNotificationMetadata({
      audience: "customer",
      event: "work_order_completed",
      context: { workRequestId: "wr1" },
    });
    expect(lean).not.toHaveProperty("work_request_item_id");
    expect(lean).not.toHaveProperty("item_count");

    const full = buildNotificationMetadata({
      audience: "customer",
      event: "work_orders_auto_added",
      context: { workRequestId: "wr1", workRequestItemId: "i1", itemCount: 4 },
    });
    expect(full).toMatchObject({ work_request_item_id: "i1", item_count: 4 });
  });

  it("never gives a provider anything that identifies the customer", () => {
    const metadata = buildNotificationMetadata({
      audience: "provider",
      event: "work_order_assigned",
      context: { workRequestItemId: "i1" },
    });

    expect(metadata).toEqual({
      source: WORK_REQUEST_NOTIFICATION_SOURCE,
      event: "work_order_assigned",
      audience: "provider",
      work_request_item_id: "i1",
    });
    expect(leaksIdentity(metadata)).toBe(false);
  });

  it("detects a payload that would leak identity", () => {
    // The guard P4-2 enforces at the serialization boundary.
    expect(leaksIdentity({ work_request_id: "wr1" })).toBe(true);
    expect(leaksIdentity({ organization_id: "org1" })).toBe(true);
    expect(leaksIdentity({ provider_id: "p1" })).toBe(true);
    expect(leaksIdentity({ label: "Invoicing" })).toBe(false);
  });

  it("keeps the customer's own request id — that is not a leak", () => {
    // Anonymity is mutual between customer and provider; a customer seeing
    // their own request is expected.
    const metadata = buildNotificationMetadata({
      audience: "customer",
      event: "work_order_started",
      context: { workRequestId: "wr1", workRequestItemId: "i1" },
    });
    expect(metadata.work_request_id).toBe("wr1");
  });
});
