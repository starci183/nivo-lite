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

/** One thing a fact can be compared with: its type, unit and allowed values. */
export interface FactSpec {
    /** The key. */
    readonly key: string
    /** The type. */
    readonly type: "number" | "string" | "boolean"
    /** `vnd` makes the fact an amount the authority rules cap. */
    readonly unit: "vnd" | "percent" | "count" | null
    /** True when it says something about the turn or its text, so it is never taken for the amount of the work. */
    readonly notWorkAmount?: boolean | undefined
    /** The allowed. */
    readonly allowed?: ReadonlyArray<string> | undefined
    /** The key of the catalog sentence that names the fact in the owner words. */
    readonly labelKey: string
}

/** One fact a condition may be written on, in the words of the reader: what the editor offers as a row. */
export interface FactView {
    /** The key. */
    readonly key: string
    /** The words that name the fact. */
    readonly label: string
    /** The type: what operators and values fit it. */
    readonly type: FactSpec["type"]
    /** The unit: `vnd` makes it an amount of money. */
    readonly unit: FactSpec["unit"]
    /** The values it may hold, for a fact that is one of a few; empty for any. */
    readonly allowed: ReadonlyArray<string>
}
