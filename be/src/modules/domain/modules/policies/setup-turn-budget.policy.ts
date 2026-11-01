import type { GenerationFailureReason } from "@modules/domain/ai-generations"

/** The longest one model call of a turn may take. */
export const TURN_TIMEOUT_MS = 90_000

/**
 * How long after the owner message the chat may still be answered: the web app stops waiting for a turn at 120 s (TURN_STALE_MS of
 * agentSetup.shared.ts), so the queue attempts, their pauses and the busy reply all end before it.
 */
export const TURN_BUDGET_MS = 110_000

/** An attempt that has less time left than this is not started: the owner is told NIVO is busy instead. */
export const MIN_ATTEMPT_MS = 15_000

/** The first pause the queue leaves between two attempts (BACKOFF_MS of the queue policy). */
export const RETRY_PAUSE_MS = 5000

/** The failures that heal by trying again; the others (quota, engine off or not set up) answer at once with their own sentence. */
const TRANSIENT_REASONS: ReadonlySet<GenerationFailureReason> = new Set(["error", "timeout"])

/** How much of the budget of a turn is left at `now`, counted from the time of the owner message. */
export const budgetLeftMs = (messageAt: string, now: Date): number =>
    Date.parse(messageAt) + TURN_BUDGET_MS - now.getTime()

/** True when an attempt may start with this much budget left. */
export const canAttempt = (leftMs: number): boolean => leftMs >= MIN_ATTEMPT_MS

/** True when a failed attempt leaves room for the pause of the queue and one more attempt. */
export const canRetry = (leftMs: number): boolean => leftMs >= RETRY_PAUSE_MS + MIN_ATTEMPT_MS

/** How long the model call of an attempt may take: the turn timeout, cut to the budget left. */
export const attemptTimeoutOf = (leftMs: number): number => Math.min(TURN_TIMEOUT_MS, leftMs)

/** True when a failed generation may heal by trying again. */
export const isTransient = (reason: GenerationFailureReason): boolean => TRANSIENT_REASONS.has(reason)
