import type { BreakerState } from "./mcp-gateway.contracts"

/** Failures within the window that open the breaker. */
export const BREAKER_FAILURES = 5
/** The failure window. */
export const BREAKER_WINDOW_MS = 60_000
/** How long the breaker stays open. */
export const BREAKER_OPEN_MS = 120_000

/** A closed breaker without failures. */
export const CLOSED: BreakerState = { failures: [], openUntil: null }

/** True when a call may go through: closed, or open long enough that one probe may try (half-open). */
export const breakerAllows = (state: BreakerState, now: number): boolean =>
    state.openUntil === null || now >= state.openUntil

/** The state after a call: a success closes it; a failure counts within the window, opens it at the threshold or re-opens a probe. */
export const breakerAfter = (state: BreakerState, ok: boolean, now: number): BreakerState => {
    if (ok) return CLOSED
    const failures = [...state.failures.filter((at) => now - at < BREAKER_WINDOW_MS), now]
    if (failures.length >= BREAKER_FAILURES || state.openUntil !== null) {
        return { failures: [], openUntil: now + BREAKER_OPEN_MS }
    }
    return { failures, openUntil: null }
}
