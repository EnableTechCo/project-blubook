// Load-balancing provider router (Phase 3, P3-1)
//
// Chooses which provider gets a released work order. The existing onboarding
// router (features/ai/automations/provider-routing.ts) picks the first partner
// in the stream alphabetically; this replaces that with a deterministic score
// over current open load, recent performance, and an availability guardrail.
//
// This is the AI swap-point: the scoring body can later be replaced by an LLM
// API call without changing the interface, because the function is pure — all
// signals are passed in and the result is a plain decision object.

/** Per-provider signals, gathered by the dispatcher and passed in. */
export interface ProviderCandidate {
  /** service_partners.id */
  id: string;
  name: string;
  isActive: boolean;
  /** Work orders currently assigned or in progress with this provider. */
  openLoad: number;
  /** Recently completed work orders — a throughput signal. */
  recentCompletions: number;
  /** Recent SLA breaches — a reliability penalty. */
  recentSlaBreaches: number;
}

export interface ScoredProvider {
  id: string;
  name: string;
  score: number;
}

export interface ProviderSelection {
  /** null when nothing could be placed — see `saturated`. */
  providerId: string | null;
  providerName: string;
  score: number | null;
  reason: string;
  /**
   * True when candidates existed but every one was unavailable (inactive or at
   * capacity). The bottleneck guardrail (P3-6) surfaces this as a flagged risk
   * instead of letting the item silently stall.
   */
  saturated: boolean;
  /** Runner-up providers, best first — useful for reassignment and audit. */
  alternatives: ScoredProvider[];
}

/** Open work orders a provider may hold before it is considered at capacity. */
export const DEFAULT_MAX_OPEN_LOAD = 10;

// Score weights. Load dominates (that is the point of load-balancing);
// reliability corrects for providers that miss deadlines; throughput is a
// small tie-breaker so proven providers edge out idle unknowns.
const LOAD_WEIGHT = 60;
const BREACH_PENALTY = 10;
const MAX_BREACH_PENALTY = 30;
const MAX_THROUGHPUT_BONUS = 10;

const clamp = (n: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, n));

/**
 * Score a candidate from 0–100 (higher is better).
 *
 * Exported so the dispatcher and admin tooling can explain a routing decision
 * without re-deriving the formula.
 */
export function scoreProvider(
  candidate: ProviderCandidate,
  maxOpenLoad: number = DEFAULT_MAX_OPEN_LOAD,
): number {
  const loadRatio = clamp(candidate.openLoad / Math.max(1, maxOpenLoad), 0, 1);
  const loadPenalty = loadRatio * LOAD_WEIGHT;
  const breachPenalty = Math.min(
    MAX_BREACH_PENALTY,
    candidate.recentSlaBreaches * BREACH_PENALTY,
  );
  const throughputBonus = Math.min(
    MAX_THROUGHPUT_BONUS,
    candidate.recentCompletions,
  );

  return clamp(
    Math.round(100 - loadPenalty - breachPenalty + throughputBonus),
    0,
    100,
  );
}

/** Available = active and not already at capacity. */
function isAvailable(c: ProviderCandidate, maxOpenLoad: number): boolean {
  return c.isActive && c.openLoad < maxOpenLoad;
}

/**
 * Pick the provider for one released work order.
 *
 * Candidates must already be filtered to the item's service. Ordering is fully
 * deterministic: score desc, then lower open load, then id — so the same inputs
 * always produce the same assignment (important for replay and for tests).
 */
export function selectProviderForWorkOrder(input: {
  serviceName: string;
  candidates: ProviderCandidate[];
  maxOpenLoad?: number;
}): ProviderSelection {
  const maxOpenLoad = input.maxOpenLoad ?? DEFAULT_MAX_OPEN_LOAD;

  if (input.candidates.length === 0) {
    return {
      providerId: null,
      providerName: "Unassigned",
      score: null,
      reason: `No provider is registered for ${input.serviceName}.`,
      saturated: false,
      alternatives: [],
    };
  }

  const available = input.candidates.filter((c) => isAvailable(c, maxOpenLoad));

  if (available.length === 0) {
    return {
      providerId: null,
      providerName: "Unassigned",
      score: null,
      reason:
        `Every ${input.serviceName} provider is unavailable — ` +
        `all are inactive or at capacity (${maxOpenLoad} open work orders).`,
      saturated: true,
      alternatives: [],
    };
  }

  const ranked = available
    .map((c) => ({ candidate: c, score: scoreProvider(c, maxOpenLoad) }))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (a.candidate.openLoad !== b.candidate.openLoad) {
        return a.candidate.openLoad - b.candidate.openLoad;
      }
      return a.candidate.id.localeCompare(b.candidate.id);
    });

  const winner = ranked[0];
  const reasonParts = [
    `${winner.candidate.openLoad} open work order${winner.candidate.openLoad === 1 ? "" : "s"}`,
  ];
  if (winner.candidate.recentSlaBreaches > 0) {
    reasonParts.push(`${winner.candidate.recentSlaBreaches} recent SLA breach(es)`);
  }
  if (winner.candidate.recentCompletions > 0) {
    reasonParts.push(`${winner.candidate.recentCompletions} recently completed`);
  }

  return {
    providerId: winner.candidate.id,
    providerName: winner.candidate.name,
    score: winner.score,
    reason:
      `Lowest-loaded available ${input.serviceName} provider ` +
      `(${reasonParts.join(", ")}).`,
    saturated: false,
    alternatives: ranked.slice(1).map((r) => ({
      id: r.candidate.id,
      name: r.candidate.name,
      score: r.score,
    })),
  };
}
