import type { MetaEvent } from "@modules/integrations/meta"

/** The job the intake queues for every event of a connected Page: the downstream handlers (chat turn, lead flow) take it from here. */
/**
 * What delivering one queued Meta event did: `delivered` (handed to the one delivery function), `not_a_message` (a postback, comment,
 * mention or lead ad: its platform's trigger translates it to nothing, by design), `switched_off` (the owner turned the account's trigger
 * off: the delivery counted nothing), `account_removed` (the account it came on is no longer connected, at the lookup or at the
 * delivery's gate: nothing delivered, logged). Never a silent return.
 */
export type MetaDeliveryOutcome = "delivered" | "not_a_message" | "switched_off" | "account_removed"

/** One inbound Meta delivery waiting on the queue: the connection and workspace it belongs to, and the raw event to read. */
export interface MetaInboundJob {
    /** The connection that owns the Page or Instagram account. */
    readonly connectionId: string
    /** The workspace of the connection. */
    readonly workspaceId: string
    /** The normalised event, as the meta integration parsed it. */
    readonly event: MetaEvent
}

export { META_INBOUND_QUEUE } from "@modules/queues/meta-inbound"

/** True when a job payload is the payload of an accept-meta-event job. */
export const isMetaInboundJob = (value: unknown): value is MetaInboundJob =>
    typeof value === "object" &&
    value !== null &&
    "connectionId" in value &&
    typeof value.connectionId === "string" &&
    "workspaceId" in value &&
    typeof value.workspaceId === "string" &&
    "event" in value &&
    typeof value.event === "object" &&
    value.event !== null

/** The raw request body the signature is computed over; undefined when the transport kept none, which is refused. */
export type RawDelivery = Buffer | undefined

/** The `X-Hub-Signature-256` header of a delivery; undefined when Meta sent none, which is refused. */
export type DeliverySignature = string | undefined

export { META_DELIVERY_QUEUE } from "@modules/queues/meta-delivery"
export type { MetaDeliveryRecorded } from "@modules/queues/meta-delivery"

/** The Page or Instagram account an event belongs to, as the connection's public facts name it. */
export interface MetaSurface {
    /** The public fact of the connection that holds the id: `page_id` for a Page, `ig_id` for an Instagram account. */
    readonly key: "page_id" | "ig_id"
    /** The Page or Instagram account id. */
    readonly id: string
}

/** The surface of an event, or null when the event names none. */
export type OptionalMetaSurface = MetaSurface | null

/** The live connection that holds a Page or Instagram account, with its workspace. */
export interface MetaSurfaceOwner {
    /** The connection. */
    readonly id: string
    /** The workspace of the connection. */
    readonly workspaceId: string
}

/** The owner of a surface, or null when no live connection holds it. */
export type OptionalMetaSurfaceOwner = MetaSurfaceOwner | null
