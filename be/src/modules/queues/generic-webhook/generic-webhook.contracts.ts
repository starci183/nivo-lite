import { isRecord } from "@modules/platform/primitives"

/** The queue name: the contract between the intake and the processor of the generic-webhook job (the durable queue name). */
export const GENERIC_WEBHOOK_QUEUE = "generic_webhook"

/** The jobs of the generic-webhook queue; the value is the job name inside the queue. */
export enum GenericWebhookJob {
    /** Says a signed delivery was received: the processor reads its endpoint and hands the event to the door that wakes the agents. */
    Deliver = "generic-webhook.deliver",
}

/** The payload of a deliver job: the receipt of one verified delivery, with the exact body text. */
export interface GenericWebhookPayload {
    /** The endpoint: the connection the delivery was posted to. */
    readonly connectionId: string
    /** The id the inbox claimed; it is the idempotency key of the event. */
    readonly deliveryId: string
    /** The exact request body, as text. */
    readonly rawBody: string
    /** The event type header, or null. */
    readonly eventType: string | null
    /** The delivery key header, or null. */
    readonly deliveryKey: string | null
}

const isTextOrNull = (value: unknown): boolean => value === null || typeof value === "string"

/** True when a job payload is the payload of a deliver job. */
export const isGenericWebhookPayload = (value: unknown): value is GenericWebhookPayload =>
    isRecord(value) &&
    typeof value.connectionId === "string" &&
    typeof value.deliveryId === "string" &&
    typeof value.rawBody === "string" &&
    isTextOrNull(value.eventType) &&
    isTextOrNull(value.deliveryKey)

/** The dedupe key of the deliver job of one delivery: one per delivery id, so a redelivery adds no second job. */
export const genericWebhookKey = (deliveryId: string): string => `generic-webhook:${deliveryId}`
