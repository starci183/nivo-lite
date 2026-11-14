/** Where one piece of work stands. */
export type WorkLogStatus = "queued" | "waiting" | "done" | "rejected" | "failed"

/** How much the agent was trusted with the work: it did it alone (`auto`) or a person decided (`ask`). */
export type WorkLogLevel = "auto" | "ask"

/** The connection the work went through, when the agent has exactly one grant for what the work is about. */
export interface WorkLogConnection {
    /** The connection. */
    readonly id: string
    /** Its display name. */
    readonly name: string
    /** Its provider key. */
    readonly provider: string
}

/** One thing the work knew when it acted. */
export interface WorkLogEvidence {
    /** What it is about. */
    readonly key: string
    /** The value, as text. */
    readonly value: string
}

/** One step of the work, as far as the record of the work item tells it. */
export interface WorkLogStep {
    /** `raised`, `gate`, `decided` or `closed`. */
    readonly key: string
    /** When it happened, ISO 8601, or null when the record holds no moment for it. */
    readonly at: string | null
    /** Whether the step is behind, under way, or ended badly. */
    readonly state: "done" | "current" | "failed"
}

/** One line of the work log. */
export interface WorkLogLine {
    /** The work item. */
    readonly id: string
    /** The action key. */
    readonly action: string
    /** When the work finished, or else when it was raised, ISO 8601. */
    readonly at: string
    /** What was done, or what is proposed. */
    readonly title: string
    /** The proposal's own sentence when it differs from the title, else empty. */
    readonly detail: string
    /** Where it stands. */
    readonly status: WorkLogStatus
    /** How it was decided, or null while nobody has. */
    readonly level: WorkLogLevel | null
    /** The connection it went through, or null. */
    readonly connection: WorkLogConnection | null
    /** The kind of record the work is about. */
    readonly evidenceKind: string
    /** The code that ties the work to its record (a payment reference), or null. */
    readonly evidenceCode: string | null
    /** What the proposal carried as evidence. */
    readonly evidence: ReadonlyArray<WorkLogEvidence>
    /** Why the gate asked a person, or null. */
    readonly reason: string | null
    /** The steps the record tells. */
    readonly steps: ReadonlyArray<WorkLogStep>
    /** Where the owner can see the result, or null. */
    readonly resultHref: string | null
    /** The failure, or null. */
    readonly error: string | null
}
