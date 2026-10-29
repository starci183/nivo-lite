/** One queued reply and its stored delivery result, scoped by workspace. */
export interface ReplyProgressRow {
    /** The message id. */
    readonly id: string
    /** The actual delivery result; null until the worker attempts it. */
    readonly delivery_status: string | null
    /** The outbox's state; null for an older message without a delivery job. */
    readonly job_state: string | null
}

/** One escalation and the deterministic message written by its approved performer. */
export interface AnswerProgressRow {
    /** The work item id. */
    readonly id: string
    /** The work item's progress. */
    readonly work_status: string
    /** The stored answer id, absent for rejection or before performance. */
    readonly message_id: string | null
    /** The answer's delivery result. */
    readonly delivery_status: string | null
    /** The decision job's state. */
    readonly job_state: string | null
}

/** The state `public.job_status` answers for one job. */
export interface JobStateRow {
    /** The job id. */
    readonly id: string
    /** The outbox state. */
    readonly state: string
}
