/** A step that ran: its value. */
export interface AttemptDone<T> {
    /** Discriminant of the finished half. */
    readonly ok: true
    /** What the step returned. */
    readonly value: T
}

/** A step that threw: the error, kept as the cause of whatever the caller decides. */
export interface AttemptFailed {
    /** Discriminant of the failed half. */
    readonly ok: false
    /** What the step threw. */
    readonly cause: unknown
}

/** The result of a step that may throw. */
export type AttemptOutcome<T> = AttemptDone<T> | AttemptFailed

/** A synchronous step that may throw. */
export type AttemptStep<T> = () => T

/** An asynchronous step that may reject. */
export type AttemptAsyncStep<T> = () => Promise<T>
