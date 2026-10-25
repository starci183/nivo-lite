/** One committed outbox row the relay hands to the broker (or checks against it). */
export interface QueueRelayRow {
    /** The outbox row id: the BullMQ job id of the delivery. */
    readonly id: string
    /** The queue. */
    readonly queue: string
    /** The job name inside the queue. */
    readonly name: string
    /** The payload the producer wrote. */
    readonly payload: object
}

/** A nonterminal outbox row the relay reconciles against the broker. */
export interface QueueReconcileRow extends QueueRelayRow {
    /** The durable outbox state. */
    readonly state: string
}

/** The answer of `job_start`: what the worker may do with the delivery. */
export interface QueueStartRow {
    /**
     * 'started' counts a real start and holds the workspace slot; 'busy' defers the job without spending a start;
     * 'terminal' and 'missing' drop it (the row already ended or does not exist).
     */
    readonly outcome: "started" | "busy" | "terminal" | "missing"
    /** How many times the job really started, this start included. */
    readonly attempt: number
}

/** The answer of `job_enqueue`: the outbox row id, existing or new. */
export interface QueueEnqueuedRow {
    /** The outbox row id. */
    readonly id: string
}
