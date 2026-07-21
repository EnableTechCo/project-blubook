import { describe, expect, it } from "vitest";
import {
  DEFAULT_MAX_OPEN_LOAD,
  placementSeverity,
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
  hasReachableUsers: true,
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
    expect(res.blockedReason).toBeNull();
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
    expect(res.blockedReason).toBe("all_at_capacity");
    expect(res.reason).toMatch(/at capacity/);
  });

  it("distinguishes inactive from at-capacity", () => {
    const res = select([provider("a", { isActive: false })]);
    expect(res.blockedReason).toBe("all_inactive");
    expect(res.providerId).toBeNull();
  });

  it("distinguishes 'no provider registered' from every other cause", () => {
    const res = select([]);
    expect(res.providerId).toBeNull();
    expect(res.blockedReason).toBe("no_providers_registered");
    expect(res.reason).toMatch(/No provider is registered/);
  });

  // ─── Reachability (P3-6) ────────────────────────────────────────────────
  // A provider nobody can act for is a black hole: work routed there is never
  // seen and never completed, silently stalling the dependency chain.

  it("never routes to a provider with no reachable users", () => {
    const res = select([
      provider("ghost", { hasReachableUsers: false, openLoad: 0 }),
      provider("real", { openLoad: 7 }),
    ]);
    // The idle provider would win on score, but nobody can act for it.
    expect(res.providerId).toBe("real");
  });

  it("reports none_reachable when no provider has a user account", () => {
    const res = select([
      provider("a", { hasReachableUsers: false }),
      provider("b", { hasReachableUsers: false }),
    ]);
    expect(res.providerId).toBeNull();
    expect(res.blockedReason).toBe("none_reachable");
    expect(res.reason).toMatch(/reachable user account/);
  });

  it("reports the mixed case when causes differ", () => {
    const res = select([
      provider("a", { isActive: false }),
      provider("b", { hasReachableUsers: false }),
      provider("c", { openLoad: DEFAULT_MAX_OPEN_LOAD }),
    ]);
    expect(res.blockedReason).toBe("all_unavailable");
  });

  it("rates capacity as transient but misconfiguration as urgent", () => {
    expect(placementSeverity("all_at_capacity")).toBe("medium");
    expect(placementSeverity("none_reachable")).toBe("high");
    expect(placementSeverity("no_providers_registered")).toBe("high");
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
