/** The longest a task and a business limit of a contract may be, and the most limits one contract may hold. */
export const MAX_TASK_LENGTH = 600
export const MAX_LIMIT_LENGTH = 400
export const MAX_LIMITS = 12

/** The events a trigger node matches: the event types, and the adapters it listens to (none: every adapter). */
export interface TriggerMatch {
    /** The event types. */
    readonly eventTypes: ReadonlyArray<string>
    /** The sources (the adapter keys); empty matches any. */
    readonly sources: ReadonlyArray<string>
}
