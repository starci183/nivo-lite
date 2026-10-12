/** The message body job_enqueue sends to pgmq (and a pg_cron tick mirrors): the job to run and what it needs. */
export interface QueueMessageRow {
    /** The job name inside the queue. */
    readonly name?: string
    /** The payload the producer wrote. */
    readonly payload?: object
    /** The identity of the job (its unique outbox key); absent on the tick of a scheduler. */
    readonly dedupe?: string
    /** The outbox row id of an enqueued job; absent on the tick of a scheduler. */
    readonly outbox_id?: string
}

/** One message `job_read` answers. */
export interface QueueReadRow {
    /** The pgmq message id (a bigint, which the driver returns as text). */
    readonly msg_id: string
    /** How many times the job really started, this start included. */
    readonly attempt: number
    /** The message body. */
    readonly message: QueueMessageRow
}

/** The answer of `job_enqueue`: the outbox row id, existing or new. */
export interface QueueEnqueuedRow {
    /** The outbox row id. */
    readonly id: string
}
