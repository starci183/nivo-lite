import type { AttemptAsyncStep, AttemptOutcome, AttemptStep } from "./attempt.contracts"

/** Runs a synchronous step that may throw and answers an outcome that carries the thrown error: returned, never swallowed. */
export const attempt = <T>(step: AttemptStep<T>): AttemptOutcome<T> => {
    try {
        return { ok: true, value: step() }
    } catch (cause) {
        return { ok: false, cause }
    }
}

/** Runs an asynchronous step that may reject and answers an outcome that carries the rejection: returned, never swallowed. */
export const attemptAsync = async <T>(step: AttemptAsyncStep<T>): Promise<AttemptOutcome<T>> => {
    try {
        return { ok: true, value: await step() }
    } catch (cause) {
        return { ok: false, cause }
    }
}
