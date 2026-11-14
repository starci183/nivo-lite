import type { AiFailure } from "@modules/integrations/ai"
import { AiTasksError, type AiTasksErrorCode } from "./errors/ai-tasks.error"

/**
 * The tries one model call gets in all, the first included: an AI failure (the deadline, a cut or empty answer, the provider, an
 * answer that is no JSON) is tried again until this many tries were made, then the call fails. It is the only count there is: the
 * gateway makes one attempt per try, and nothing above this layer loops over a model call.
 */
export const MODEL_TRIES = 3

/**
 * How long the call waits before it tries again after the endpoint or the provider failed, milliseconds: an upstream that is
 * overloaded or restarting is not hit again in the same instant. A deadline that passed, a cut, an empty or a non-JSON answer is
 * tried again at once: the time was already spent, or the endpoint is healthy.
 */
export const PROVIDER_RETRY_PAUSE_MS = 2000

/** How long to wait before the next try, given what the last one failed as. */
export const pauseBeforeRetryMs = (failure: TryFailure): number => (failure === "provider" ? PROVIDER_RETRY_PAUSE_MS : 0)

/** The failure of a try whose answer came but was no JSON object. */
export const NOT_JSON = "not_json"

/** What one try failed as. */
export type TryFailure = AiFailure | typeof NOT_JSON

/** The tries of one model call so far: how many were made, and what each failed one failed as, in order. */
export interface Tries {
    /** Calls made to the endpoint. */
    made: number
    /** The failure of each failed try, oldest first. */
    readonly failures: Array<TryFailure>
}

/** The count of a call that has made no try yet. */
export const newTries = (): Tries => ({ made: 0, failures: [] })

/** True while the call may try again. */
export const triesRemain = (tries: Tries): boolean => tries.made < MODEL_TRIES

/**
 * The error of a model call whose every try failed: the tries made and the failure of each, as facts for whoever tells a person
 * that the AI failed (scalar values, so they read as lines of a report).
 */
export const failedTries = (code: AiTasksErrorCode, tries: Tries): AiTasksError =>
    new AiTasksError({ code, params: { tries: tries.made, failures: tries.failures.join(", ") } })

/** The fallback ask of a try: `fallback: true` when it takes the next protocol, nothing when it keeps its client. */
export interface FallbackAsk {
    /** True when the try takes its name's client through the next protocol; absent when it keeps its client. */
    readonly fallback?: true
}

/**
 * Whether a try takes its name's client through the next protocol (`AiTurnRequest.fallback`): only a retry whose previous try failed
 * at the provider or ran out of time. A profile whose candidates speak one protocol has no next one, and the try keeps its client.
 */
export const fallbackOf = (tries: Tries): FallbackAsk => {
    const last = tries.failures.at(-1)
    return last === "provider" || last === "timeout" ? { fallback: true } : {}
}
