/** The inputs of a `runFlow` command, as the caller sent them. */
export interface RunFlowPayload {
    /** Any value the command carries. */
    readonly [name: string]: unknown
}

/** What `runFlow` answers: the decided work item. */
export interface RunFlowResult {
    /** The work item closed (`id`, `status`). */
    readonly data: RunFlowPayload
}
