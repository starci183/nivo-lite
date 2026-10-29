import { BaseEvent } from "@modules/platform/event-bus"
import type { EventPayload, ParsedEvent } from "@modules/platform/event-bus"
import { isKey, isTextOrAbsent, openEnvelope, whenPresent } from "./money-event.policy"

/**
 * The payload of the `order_shipped` event: a confirmed order was handed to its carrier. `dedupeKey` is the order id: an order ships
 * once.
 */
export interface OrderShippedInput {
    /** The workspace of the order. */
    readonly workspaceId: string
    /** The member who recorded the shipment. */
    readonly userId: string
    /** The shipped order; equals `dedupeKey`. */
    readonly orderId: string
    /** The order number shown to people. */
    readonly orderNo: string
    /** The customer, or null. */
    readonly leadId?: string
    /** The recorded carrier. */
    readonly carrier: string
    /** The recorded tracking code. */
    readonly trackingCode: string
    /** The recorded shipment instant (ISO). */
    readonly shippedAt: string
}

/** The payload of the event as published; the dedupe key is derived from the input. */
export interface OrderShippedPayload extends EventPayload, OrderShippedInput {}

/** Version 1 of `order_shipped`, published by sales in the transaction that records a shipment. */
export class OrderShippedEvent extends BaseEvent {
    static readonly eventName = "order_shipped"
    static readonly version = 1

    readonly eventName = OrderShippedEvent.eventName

    private constructor(
        readonly eventId: string,
        readonly payload: OrderShippedPayload,
    ) {
        super()
    }

    /** The order id is the identity of the fact: an order ships once. */
    static create(payload: OrderShippedInput): OrderShippedEvent {
        return new OrderShippedEvent(payload.orderId, { ...payload, dedupeKey: payload.orderId })
    }

    /** Reads the event envelope; a malformed delivery never reaches a reactor. */
    static parse(envelope: unknown): ParsedEvent<OrderShippedEvent> {
        const opened = openEnvelope(envelope)
        if (opened === null) return null
        const { body } = opened
        if (
            !isKey(body.orderId) ||
            !isKey(body.workspaceId) ||
            typeof body.userId !== "string" ||
            typeof body.orderNo !== "string" ||
            !isTextOrAbsent(body.leadId) ||
            typeof body.carrier !== "string" ||
            typeof body.trackingCode !== "string" ||
            typeof body.shippedAt !== "string"
        ) {
            return null
        }
        return new OrderShippedEvent(opened.eventId, {
            dedupeKey: body.orderId,
            workspaceId: body.workspaceId,
            userId: body.userId,
            orderId: body.orderId,
            orderNo: body.orderNo,
            ...whenPresent("leadId", body.leadId),
            carrier: body.carrier,
            trackingCode: body.trackingCode,
            shippedAt: body.shippedAt,
        })
    }
}
