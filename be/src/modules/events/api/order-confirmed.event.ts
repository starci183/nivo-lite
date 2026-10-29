import { BaseEvent } from "@modules/platform/event-bus"
import type { EventPayload, ParsedEvent } from "@modules/platform/event-bus"
import { isAmountOrNull, isKey, isTextOrNull, openEnvelope } from "./money-event.policy"

/**
 * The payload of the `order_confirmed` event: a drafted order was confirmed. `dedupeKey` is the order id: an order is confirmed once.
 */
export interface OrderConfirmedPayload extends EventPayload {
    /** The workspace of the order. */
    readonly workspaceId: string
    /** The confirmed order; equals `dedupeKey`. */
    readonly orderId: string
    /** The order number shown to people. */
    readonly orderNo: string
    /** The customer, or null. */
    readonly leadId: string | null
    /** The customer's name as shown. */
    readonly customer: string
    /** The ordered items as the customer wrote them. */
    readonly items: string
    /** The order amount in VND, or null. */
    readonly amountVnd: number | null
    /** The channel the customer came through, or null. */
    readonly channel: string | null
    /** Who confirmed the order. */
    readonly confirmedBy: string
}

/** Version 1 of `order_confirmed`, published by the confirm-order work in the transaction that confirms an order. */
export class OrderConfirmedEvent extends BaseEvent {
    static readonly eventName = "order_confirmed"
    static readonly version = 1

    readonly eventName = OrderConfirmedEvent.eventName

    private constructor(
        readonly eventId: string,
        readonly payload: OrderConfirmedPayload,
    ) {
        super()
    }

    /** The order id is the identity of the fact: an order is confirmed once. */
    static create(payload: Omit<OrderConfirmedPayload, "dedupeKey">): OrderConfirmedEvent {
        return new OrderConfirmedEvent(payload.orderId, { ...payload, dedupeKey: payload.orderId })
    }

    /** Reads the event envelope; a malformed delivery never reaches a reactor. */
    static parse(envelope: unknown): ParsedEvent<OrderConfirmedEvent> {
        const opened = openEnvelope(envelope)
        if (opened === null) return null
        const { body } = opened
        if (
            !isKey(body.orderId) ||
            !isKey(body.workspaceId) ||
            typeof body.orderNo !== "string" ||
            !isTextOrNull(body.leadId) ||
            typeof body.customer !== "string" ||
            typeof body.items !== "string" ||
            !isAmountOrNull(body.amountVnd) ||
            !isTextOrNull(body.channel) ||
            typeof body.confirmedBy !== "string"
        ) {
            return null
        }
        return new OrderConfirmedEvent(opened.eventId, {
            dedupeKey: body.orderId,
            workspaceId: body.workspaceId,
            orderId: body.orderId,
            orderNo: body.orderNo,
            leadId: body.leadId,
            customer: body.customer,
            items: body.items,
            amountVnd: body.amountVnd,
            channel: body.channel,
            confirmedBy: body.confirmedBy,
        })
    }
}
