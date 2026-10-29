import { BaseEvent } from "@modules/platform/event-bus"
import type { EventPayload, ParsedEvent } from "@modules/platform/event-bus"
import { isKey, openEnvelope } from "./money-event.policy"

/**
 * The payload of the `bank_credit_booked` event: a verified credit became one inbound payment event and now waits for its settlement.
 * `dedupeKey` is the inbound event id: a credit is booked once.
 */
export interface BankCreditBookedPayload extends EventPayload {
    /** The workspace the credit belongs to. */
    readonly workspaceId: string
    /** The inbound payment event the credit became; equals `dedupeKey`. */
    readonly inboundEventId: string
    /** The credited amount in VND. */
    readonly amountVnd: number
}

/** Version 1 of `bank_credit_booked`, published by billing in the transaction that books a credit as an inbound payment event. */
export class BankCreditBookedEvent extends BaseEvent {
    static readonly eventName = "bank_credit_booked"
    static readonly version = 1

    readonly eventName = BankCreditBookedEvent.eventName

    private constructor(
        readonly eventId: string,
        readonly payload: BankCreditBookedPayload,
    ) {
        super()
    }

    /** The inbound event id is the identity of the fact: a credit is booked once. */
    static create(payload: Omit<BankCreditBookedPayload, "dedupeKey">): BankCreditBookedEvent {
        return new BankCreditBookedEvent(payload.inboundEventId, { ...payload, dedupeKey: payload.inboundEventId })
    }

    /** Reads the event envelope; a malformed delivery never reaches a reactor. */
    static parse(envelope: unknown): ParsedEvent<BankCreditBookedEvent> {
        const opened = openEnvelope(envelope)
        if (opened === null) return null
        const { body } = opened
        if (!isKey(body.inboundEventId) || !isKey(body.workspaceId) || typeof body.amountVnd !== "number") return null
        return new BankCreditBookedEvent(opened.eventId, {
            dedupeKey: body.inboundEventId,
            inboundEventId: body.inboundEventId,
            workspaceId: body.workspaceId,
            amountVnd: body.amountVnd,
        })
    }
}
