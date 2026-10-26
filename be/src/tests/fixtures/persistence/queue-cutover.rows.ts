/** The outbox identities and states observed across the migration boundary. */
export interface CutoverRow {
    /** Canonical outbox identity the broker job is published under. */
    readonly id: string
    /** Which seeded scenario the row carries. */
    readonly proof: string
    /** Durable lifecycle state. */
    readonly state: string
    /** Starts already spent. */
    readonly attempts: number
    /** When the relay last published it, or null while it still has to be published. */
    readonly sent_at: Date | null
    /** The lease of a delivery that was running at the cutover. */
    readonly run_lease_until: Date | null
}

/** One fenced claim, whose identity, token and checkpoint must survive raw-message adoption. */
export interface CutoverClaim {
    /** The claim row identity. */
    readonly id: string
    /** The delivery id the claim is keyed under. */
    readonly job_key: string
    /** The claim status. */
    readonly status: string
    /** The fencing token, as text. */
    readonly fencing_token: string
    /** The last checkpoint the legacy worker recorded. */
    readonly current_step: string | null
}

/** How many messages each pgmq table holds. */
export interface CutoverQueues {
    /** Messages still waiting in the job queue. */
    readonly pending: number
    /** Messages archived as dead letters. */
    readonly archived: number
    /** Messages on an event-bus queue, which the cutover must leave alone. */
    readonly event_bus: number
}

/** The legacy functions that must be gone after the contract migration. */
export interface CutoverFunctions {
    /** The legacy read, or null once dropped. */
    readonly legacy_read: string | null
    /** The legacy acknowledgement, or null once dropped. */
    readonly legacy_ack: string | null
}

/** The pgmq queue names that remain once the contract migration dropped every job queue. */
export interface CutoverQueueList {
    /** The queue names pgmq still holds, sorted. */
    readonly queues: Array<string>
}
