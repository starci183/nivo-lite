/** One committed outbox row leased by a relay, with no database transaction held while Redis is called. */
export interface QueueRelayRow {
    /** The outbox row id: the BullMQ job id of the delivery. */
    readonly id: string
    /** The queue. */
    readonly queue: string
    /** The job name inside the queue. */
    readonly name: string
    /** The payload the producer wrote. */
    readonly payload: object
    /** The token fencing marks and resets against another relay's later claim. */
    readonly lease_token: string
    /** True when an operator requested a fresh broker retry budget. */
    readonly retry_requested: boolean
}

/** A nonterminal outbox row leased for reconciliation against the broker. */
export interface QueueReconcileRow extends QueueRelayRow {
    /** The durable outbox state at the claim. */
    readonly state: string
    /** The start count at the claim, for operator diagnostics. */
    readonly attempts: number
    /** The worker admission token at the claim; null before the first start. */
    readonly run_token: string | null
}

/** The common outcome of a durable admission check. */
interface QueueStartOutcome {
    /** How many times the job really started, this start included. */
    readonly attempt: number
    /** Durable state distinguishes a failed terminal delivery from a completed one. */
    readonly state: string
}

/** A started delivery always carries its unique admission fence; a refused delivery may never have started. */
export type QueueStartRow = QueueStartOutcome &
    (
        | { readonly outcome: "started"; readonly run_token: string }
        | { readonly outcome: "busy" | "terminal" | "missing"; readonly run_token: string | null }
    )

/** The answer of job_enqueue: the outbox row id, existing or new. */
export interface QueueEnqueuedRow {
    /** The outbox row id. */
    readonly id: string
}
