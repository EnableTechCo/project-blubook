import { describe, expect, it } from "vitest";
import {
  DEFAULT_MAX_OPEN_LOAD,
  scoreProvider,
  selectProviderForWorkOrder,
  type ProviderCandidate,
} from "./provider-router";

const provider = (
  id: string,
  overrides: Partial<ProviderCandidate> = {},
): ProviderCandidate => ({
  id,
  name: `Provider ${id}`,
  isActive: true,
  openLoad: 0,
  recentCompletions: 0,
  recentSlaBreaches: 0,
  ...overrides,
});

const select = (candidates: ProviderCandidate[], maxOpenLoad?: number) =>
  selectProviderForWorkOrder({ serviceName: "Sales Ops", candidates, maxOpenLoad });

describe("scoreProvider", () => {
  it("scores an idle, clean provider at the top", () => {
    expect(scoreProvider(provider("a"))).toBe(100);
  });

  it("penalises load proportionally", () => {
    // Half capacity => half the 60-point load weight.
    expect(scoreProvider(provider("a", { openLoad: 5 }), 10)).toBe(70);
  });

  it("penalises SLA breaches, capped", () => {
    expect(scoreProvider(provider("a", { recentSlaBreaches: 1 }))).toBe(90);
    // Capped at 30 — 5 breaches is not worse than 3.
    expect(scoreProvider(provider("a", { recentSlaBreaches: 3 }))).toBe(70);
    expect(scoreProvider(provider("a", { recentSlaBreaches: 5 }))).toBe(70);
  });

  it("never leaves the 0–100 range", () => {
    // Penalties are individually capped (load 60 + breaches 30), so the worst
    // reachable score is 10 rather than 0 — such a provider is excluded by the
    // availability guardrail long before its score matters.
    const awful = provider("a", { openLoad: 999, recentSlaBreaches: 99 });
    expect(scoreProvider(awful)).toBe(10);
    expect(scoreProvider(provider("a", { recentCompletions: 999 }))).toBe(100);
  });
});

describe("selectProviderForWorkOrder", () => {
  it("picks the least-loaded provider", () => {
    const res = select([
      provider("busy", { openLoad: 8 }),
      provider("light", { openLoad: 1 }),
      provider("mid", { openLoad: 4 }),
    ]);
    expect(res.providerId).toBe("light");
    expect(res.saturated).toBe(false);
    expect(res.alternatives.map((a) => a.id)).toEqual(["mid", "busy"]);
  });

  it("prefers the reliable provider when load is equal", () => {
    const res = select([
      provider("flaky", { openLoad: 2, recentSlaBreaches: 2 }),
      provider("solid", { openLoad: 2 }),
    ]);
    expect(res.providerId).toBe("solid");
  });

  it("lets a slightly busier but far more reliable provider win", () => {
    // breaches cost 30; one extra open order costs only 6.
    const res = select([
      provider("flaky", { openLoad: 1, recentSlaBreaches: 3 }),
      provider("solid", { openLoad: 2 }),
    ]);
    expect(res.providerId).toBe("solid");
  });

  it("skips inactive providers", () => {
    const res = select([
      provider("off", { isActive: false, openLoad: 0 }),
      provider("on", { openLoad: 6 }),
    ]);
    expect(res.providerId).toBe("on");
  });

  it("flags saturation when every provider is at capacity", () => {
    const res = select([
      provider("a", { openLoad: DEFAULT_MAX_OPEN_LOAD }),
      provider("b", { openLoad: DEFAULT_MAX_OPEN_LOAD + 3 }),
    ]);
    expect(res.providerId).toBeNull();
    expect(res.saturated).toBe(true);
    expect(res.reason).toMatch(/at capacity/);
  });

  it("flags saturation when every provider is inactive", () => {
    const res = select([provider("a", { isActive: false })]);
    expect(res.saturated).toBe(true);
    expect(res.providerId).toBeNull();
  });

  it("distinguishes 'no provider registered' from saturation", () => {
    const res = select([]);
    expect(res.providerId).toBeNull();
    expect(res.saturated).toBe(false);
    expect(res.reason).toMatch(/No provider is registered/);
  });

  it("is deterministic for identical candidates", () => {
    const candidates = [provider("zzz"), provider("aaa"), provider("mmm")];
    const first = select(candidates).providerId;
    expect(first).toBe("aaa"); // id tie-break
    expect(select([...candidates].reverse()).providerId).toBe(first);
  });

  it("explains the decision", () => {
    const res = select([provider("a", { openLoad: 1, recentCompletions: 4 })]);
    expect(res.reason).toContain("Sales Ops");
    expect(res.reason).toContain("1 open work order");
    expect(res.reason).toContain("4 recently completed");
  });
});
