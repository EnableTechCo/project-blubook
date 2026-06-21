import { describe, expect, it } from "vitest";
import { appStore } from "@/store/redux/store";

describe("redux store", () => {
  it("registers RTK Query reducer path", () => {
    const state = appStore.getState() as Record<string, unknown>;
    expect(state).toHaveProperty("baseApi");
  });

  it("has dispatch and getState functions", () => {
    expect(typeof appStore.dispatch).toBe("function");
    expect(typeof appStore.getState).toBe("function");
  });
});
