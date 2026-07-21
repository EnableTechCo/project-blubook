import { describe, expect, it } from "vitest";
import { asJsonObject, isJson, requireJsonString, toJson } from "./json";

describe("Supabase JSON helpers", () => {
  it("accepts nested JSON values", () => {
    const value = {
      source: "workflow",
      count: 2,
      active: true,
      details: [null, { status: "ready" }],
    };

    expect(isJson(value)).toBe(true);
    expect(toJson(value)).toBe(value);
  });

  it("rejects values that cannot be persisted as JSON", () => {
    expect(isJson(new Date())).toBe(false);
    expect(isJson({ callback: () => undefined })).toBe(false);
    expect(() => toJson({ value: Number.NaN })).toThrow(
      "value must be JSON-serializable",
    );
  });

  it("normalizes missing objects and validates required strings", () => {
    expect(asJsonObject(undefined)).toEqual({});
    expect(requireJsonString({ orderId: "order-1" }, "orderId")).toBe(
      "order-1",
    );
    expect(() => requireJsonString({}, "orderId")).toThrow(
      "Missing orderId in payload",
    );
  });
});
