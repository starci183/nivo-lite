import { createHmac } from "node:crypto"
import { WEBHOOK_EVENTS } from "./webhook-connections.contracts"
import type { WebhookEvent } from "./webhook-connections.contracts"

/** True for one of the outgoing events. */
export const isWebhookEvent = (value: unknown): value is WebhookEvent =>
    typeof value === "string" && (WEBHOOK_EVENTS as ReadonlyArray<string>).includes(value)

/** The distinct valid events of a list, in the order given. */
export const pickEvents = (events: ReadonlyArray<string>): Array<WebhookEvent> => [
    ...new Set(events.filter(isWebhookEvent)),
]

/** The events stored in the public facts of a connection (comma separated). */
export const eventsOf = (meta: Readonly<Record<string, string>>): Array<WebhookEvent> =>
    pickEvents((meta.events ?? "").split(",").map((event) => event.trim()))

/** The per-workspace signing key: HMAC-SHA256 of the shared secret and "n8n:" plus the workspace id, hex. */
export const workspaceSigningSecret = (sharedSecret: string, workspaceId: string): string =>
    createHmac("sha256", sharedSecret).update(`n8n:${workspaceId}`).digest("hex")

/** The signature of one delivery: hex HMAC-SHA256 of the timestamp, a dot and the body. */
export const signDelivery = (key: string, timestamp: string, body: string): string =>
    createHmac("sha256", key).update(`${timestamp}.${body}`).digest("hex")
