/** The pgmq queue that carries the signed deliveries to the n8n workflows. */
export const N8N_QUEUE = "n8n"

/** The job of one delivery: post a run to its workflow. */
export const N8N_EMIT_JOB = "n8n.emit"

/** The payload of one n8n delivery job: which run it belongs to and what to post where. */
export interface N8nEmitPayload {
    /** The workspace the event belongs to; it keys the signature and the job slot. */
    readonly workspaceId: string
    /** The n8n run this delivery starts. */
    readonly runId: string
    /** The event name, for example `pipeline.email-daily-report`. */
    readonly event: string
    /** Full webhook urls to post to. */
    readonly urls: ReadonlyArray<string>
    /** Webhook paths under the configured n8n base. */
    readonly paths: ReadonlyArray<string>
    /** The JSON body of the event. */
    readonly data: object
}
