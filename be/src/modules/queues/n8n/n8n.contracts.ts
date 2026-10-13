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

/** The job of one outgoing webhook delivery: post a business event to a webhook connection of the workspace. */
export const N8N_WEBHOOK_JOB = "n8n.webhook"

/** The payload of one webhook delivery job: which connection receives which event. */
export interface N8nWebhookPayload {
    /** The workspace the event belongs to; it keys the signature and the job slot. */
    readonly workspaceId: string
    /** The webhook connection that subscribed to the event. */
    readonly connectionId: string
    /** The delivery id the receiver dedupes on, the same on every retry. */
    readonly deliveryId: string
    /** The event name, for example `decision.made`. */
    readonly event: string
    /** The JSON body of the event. */
    readonly data: object
    /** The instant of the event in epoch milliseconds: the signed timestamp, the same on every retry. */
    readonly occurredAtMs: number
}

const TEXT_KEYS = ["workspaceId", "connectionId", "deliveryId", "event"] as const

/** True when a job payload is the payload of a webhook delivery job. */
export const isN8nWebhookPayload = (value: unknown): value is N8nWebhookPayload => {
    if (typeof value !== "object" || value === null) return false
    const fields: Readonly<Record<string, unknown>> = Object.fromEntries(Object.entries(value))
    return (
        TEXT_KEYS.every((key) => typeof fields[key] === "string") &&
        typeof fields.occurredAtMs === "number" &&
        typeof fields.data === "object" &&
        fields.data !== null
    )
}
