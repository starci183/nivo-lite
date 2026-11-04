import type { PollLimits } from "./connection-poll.contracts"

/** The tokens a bucket holds and the instant they were counted at. */
export interface BucketState {
    /** Whole and fractional calls that may be made now. */
    readonly tokens: number
    /** When `tokens` was last counted, in epoch milliseconds. */
    readonly at: number
}

/** The answer to a request for one call. */
export interface BucketTaken {
    /** True when a call may be made now. */
    readonly allowed: boolean
    /** How long until a call may be made; 0 when it was allowed. */
    readonly waitMs: number
    /** The bucket after the request. */
    readonly state: BucketState
}

/**
 * Takes one call from a token bucket: it refills at `ratePerSecond` up to `burst` since it was last counted (a bucket never seen starts full),
 * spends one token when it holds one, and otherwise says how long until it will.
 */
export const takeToken = (state: BucketState | undefined, now: number, limits: PollLimits): BucketTaken => {
    const before = state ?? { tokens: limits.burst, at: now }
    const refilled = Math.min(
        limits.burst,
        before.tokens + (Math.max(0, now - before.at) * limits.ratePerSecond) / 1000,
    )
    if (refilled >= 1) return { allowed: true, waitMs: 0, state: { tokens: refilled - 1, at: now } }
    return {
        allowed: false,
        waitMs: Math.ceil(((1 - refilled) * 1000) / limits.ratePerSecond),
        state: { tokens: refilled, at: now },
    }
}
