import { createHash } from "node:crypto"
import { isIntentTrigger } from "@modules/domain/intent-contracts"
import { isRecord, parseJsonText } from "@modules/platform/primitives"
import { AgentInboundError, AgentInboundErrorCode } from "./errors/agent-inbound.error"
import type { GenericWebhookPayload } from "@modules/queues/generic-webhook"
import type { InboundAdapter, InboundEvent } from "./agent-inbound.contracts"
import type { VerifiedDelivery } from "./agent-inbound-door.contracts"

/** The key of the adapter and of the webhook proof: the source of every wake a signed webhook writes. */
export const GENERIC_WEBHOOK = "generic_webhook"

/** The actor kind of a signed webhook: the system on the other side of the endpoint. */
export const WEBHOOK_ACTOR_KIND = "webhook"

/** The byte budget of the complete event key, including the endpoint, before it becomes an opaque digest. */
const KEY_BYTES_MAX = 200

/**
 * The generic signed webhook: a system outside NIVO posts JSON to an endpoint of the workspace. The signature proves the endpoint secret and
 * nothing more, so the sender is trusted as an outsider (public knowledge, the least the limits allow) until a plug-in says otherwise. Nobody
 * waits for an answer and there is no channel to reply on, so a run ends with no reply.
 */
export const genericWebhookAdapter: InboundAdapter = {
    key: GENERIC_WEBHOOK,
    authentication: "signature",
    trustOf: () => "outsider",
    awaitsAnswer: false,
    replyStep: null,
    doorStep: "webhook_door",
    priority: 30,
    maxAttempts: 3,
}

/** What a verified delivery brings. */
export interface GenericWebhookReceipt {
    /** The endpoint: the connection the delivery was posted to. */
    readonly connectionId: string
    /** The exact request bytes. */
    readonly rawBody: Buffer
    /** The event type the sender named in its header, if it did. */
    readonly eventType: string | undefined
    /** The delivery key the sender named in its header, if it did. */
    readonly deliveryKey: string | undefined
}

/** A delivery with the workspace of its endpoint. */
export interface GenericWebhookDelivery extends GenericWebhookReceipt {
    /** The workspace of the endpoint. */
    readonly workspaceId: string
}

const bodyOf = (rawBody: Buffer): Readonly<Record<string, unknown>> => {
    const read = parseJsonText(rawBody.toString("utf8"))
    if (!read.ok || !isRecord(read.value) || Array.isArray(read.value))
        throw new AgentInboundError({ code: AgentInboundErrorCode.BodyInvalid })
    return read.value
}

const textOf = (value: unknown): string | undefined => (typeof value === "string" && value !== "" ? value : undefined)

const eventTypeOf = (delivery: GenericWebhookReceipt, body: Readonly<Record<string, unknown>>): string => {
    const named = delivery.eventType ?? textOf(body.type) ?? textOf(body.event)
    if (named === undefined || !isIntentTrigger(named)) {
        throw new AgentInboundError({ code: AgentInboundErrorCode.EventTypeInvalid })
    }
    return named
}

/**
 * One fact, one key: existing short endpoint/sender keys keep their identity; a key that exceeds the complete byte budget becomes an
 * opaque digest of the endpoint and full sender identity, without truncation collisions. With no named key the exact body digest is
 * the identity. Redelivery is stable and the same sender key on two endpoints remains two facts.
 */
export const idempotencyKeyOf = (delivery: GenericWebhookReceipt, body: Readonly<Record<string, unknown>>): string => {
    const named = delivery.deliveryKey ?? textOf(body.id)
    const key = named ?? createHash("sha256").update(delivery.rawBody).digest("hex")
    const scoped = `${delivery.connectionId}:${key}`
    if (Buffer.byteLength(scoped, "utf8") <= KEY_BYTES_MAX) return scoped
    const identity = JSON.stringify([delivery.connectionId, key])
    return `webhook-sha256:${createHash("sha256").update(identity).digest("hex")}`
}

/** The inbound event a verified delivery is. The agent is resolved by trigger: the event type and this adapter key. */
export const normalizeGenericWebhook = (delivery: GenericWebhookDelivery): InboundEvent => {
    const body = bodyOf(delivery.rawBody)
    return {
        adapter: GENERIC_WEBHOOK,
        eventType: eventTypeOf(delivery, body),
        actor: { kind: WEBHOOK_ACTOR_KIND, id: delivery.connectionId, role: null },
        chain: null,
        payload: body,
        attachments: [],
        evidence: [
            { key: "endpoint", value: delivery.connectionId, kind: "connection", via: GENERIC_WEBHOOK },
            { key: "signature", value: "hmac-sha256", kind: "proof", via: GENERIC_WEBHOOK },
        ],
        idempotencyKey: idempotencyKeyOf(delivery, body),
        workspaceId: delivery.workspaceId,
        agentId: null,
        scopeKey: null,
    }
}

/** The delivery id of a receipt, read from its body before anything else is known of the endpoint, and only for a body that is an event: what the inbox claims. */
export const deliveryIdOf = (receipt: GenericWebhookReceipt): string => {
    const body = bodyOf(receipt.rawBody)
    eventTypeOf(receipt, body)
    return idempotencyKeyOf(receipt, body)
}

/** A verified delivery read into what the inbox claims and the job carries. */
export interface ReceivedWebhook {
    /** The id the inbox claims. */
    readonly deliveryId: string
    /** The receipt the job carries. */
    readonly payload: GenericWebhookPayload
}

/** Reads a verified delivery: a delivery with no body names no endpoint, and a body that is no event is refused before anything is claimed. */
export const receiveGenericWebhook = (delivery: VerifiedDelivery): ReceivedWebhook => {
    const { rawBody } = delivery
    if (rawBody === undefined) throw new AgentInboundError({ code: AgentInboundErrorCode.EndpointUnknown })
    const deliveryId = deliveryIdOf({
        connectionId: delivery.endpoint,
        rawBody,
        eventType: delivery.eventType,
        deliveryKey: delivery.deliveryKey,
    })
    return {
        deliveryId,
        payload: {
            connectionId: delivery.endpoint,
            deliveryId,
            rawBody: rawBody.toString("utf8"),
            eventType: delivery.eventType ?? null,
            deliveryKey: delivery.deliveryKey ?? null,
        },
    }
}
