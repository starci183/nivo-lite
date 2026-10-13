import type { MetaEvent } from "@modules/integrations/meta"

/** The job the intake queues for every event of a connected Page: the downstream handlers (chat turn, lead flow) take it from here. */
export interface MetaInboundJob {
    /** The connection that owns the Page or Instagram account. */
    readonly connectionId: string
    /** The workspace of the connection. */
    readonly workspaceId: string
    /** The normalised event, as the meta integration parsed it. */
    readonly event: MetaEvent
}

/** The queue the events are written to. */
export const META_INBOUND_QUEUE = "meta_inbound"

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
