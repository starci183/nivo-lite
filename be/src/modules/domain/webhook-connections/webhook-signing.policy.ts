import { createHmac } from "node:crypto"
import { WEBHOOK_EVENTS } from "./webhook-connections.contracts"
import type { WebhookEvent } from "./webhook-connections.contracts"

const webhookEvents: ReadonlyArray<string> = WEBHOOK_EVENTS

/** True for one of the outgoing events. */
export const isWebhookEvent = (value: unknown): value is WebhookEvent =>
    typeof value === "string" && webhookEvents.includes(value)

/** The distinct valid events of a list, in the order given. */
export const pickEvents = (events: ReadonlyArray<string>): Array<WebhookEvent> => [
    ...new Set(events.filter(isWebhookEvent)),
]

/** The events stored in the public facts of a connection (comma separated). */
export const eventsOf = (meta: Readonly<Record<string, string>>): Array<WebhookEvent> =>
    pickEvents((meta.events ?? "").split(",").map((event) => event.trim()))

/** The per-workspace signing key: HMAC-SHA256 of the signing secret and "n8n:" plus the workspace id, hex. */
export const workspaceSigningSecret = (signingSecret: string, workspaceId: string): string =>
    createHmac("sha256", signingSecret).update(`n8n:${workspaceId}`).digest("hex")

/** The signature of one delivery: hex HMAC-SHA256 of the timestamp, a dot and the body. */
export const signDelivery = (key: string, timestamp: string, body: string): string =>
    createHmac("sha256", key).update(`${timestamp}.${body}`).digest("hex")

/** What a delivery's answer means: accepted, worth another try later (no answer, a rate limit, a server error), or refused for good. */
export type DeliveryVerdict = "delivered" | "retry" | "refused"

const HTTP_OK_MIN = 200
const HTTP_OK_MAX = 299
const HTTP_TOO_MANY = 429
const HTTP_SERVER_MIN = 500

/** The verdict of a receiver's HTTP status; null means no answer arrived. */
export const deliveryVerdict = (status: number | null): DeliveryVerdict => {
    if (status === null || status === HTTP_TOO_MANY || status >= HTTP_SERVER_MIN) return "retry"
    return status >= HTTP_OK_MIN && status <= HTTP_OK_MAX ? "delivered" : "refused"
}
