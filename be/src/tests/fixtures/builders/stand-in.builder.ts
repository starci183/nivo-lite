import type { DomainError } from "@modules/platform/errors"

/** What a fake call answers: the value, or the failure the test staged (read when the call is made). */
export const outcome = <T>(failure: DomainError<string> | undefined, value: T): Promise<T> =>
    Promise.resolve().then(() => {
        if (failure !== undefined) throw failure
        return value
    })
