import type { BreakerGate, BreakerState } from "./mcp-gateway.contracts"

/** Failures within the window that open the breaker. */
export const BREAKER_FAILURES = 5
/** The failure window. */
export const BREAKER_WINDOW_MS = 60_000
/** How long the breaker stays open before it lets one probe through. */
export const BREAKER_OPEN_MS = 120_000

/** A closed breaker without failures. */
export const CLOSED: BreakerState = { phase: "closed", failures: [], openUntil: null }

/** The breaker opened at `now`. */
const openedAt = (now: number): BreakerState => ({ phase: "open", failures: [], openUntil: now + BREAKER_OPEN_MS })

/**
 * Whether a call may run now. Closed: yes. Open: no, until the pause is over; then it turns half-open and lets this one call
 * through as the probe. Half-open: no, while the probe runs.
 */
export const breakerGate = (state: BreakerState, now: number): BreakerGate => {
    if (state.phase === "closed") return { allowed: true, state }
    if (state.phase === "open" && state.openUntil !== null && now >= state.openUntil) {
        return { allowed: true, state: { phase: "half_open", failures: [], openUntil: null } }
    }
    return { allowed: false, state }
}

/**
 * The state after a call ended. A success closes it. A failed probe opens it again. A failure while closed counts within the
 * window and opens it at the threshold. A call that started before the breaker opened and fails late leaves it open.
 */
export const breakerAfter = (state: BreakerState, ok: boolean, now: number): BreakerState => {
    if (ok) return CLOSED
    if (state.phase === "half_open") return openedAt(now)
    if (state.phase === "open") return state
    const failures = [...state.failures.filter((at) => now - at < BREAKER_WINDOW_MS), now]
    return failures.length >= BREAKER_FAILURES ? openedAt(now) : { phase: "closed", failures, openUntil: null }
}
