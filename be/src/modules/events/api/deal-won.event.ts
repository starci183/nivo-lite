import { BaseEvent } from "@modules/platform/event-bus"
import type { EventPayload, ParsedEvent } from "@modules/platform/event-bus"
import { envelopeParts, fieldOf, keyOf, numberOf, textOf } from "./event-fields.policy"
import { isTextOrAbsent, whenPresent } from "./money-event.policy"

/**
 * The payload of the `deal_won` event: the deal of a customer was won (an order was confirmed for it, or the public API or the owner
 * set the lead to won). The whenPresent fields are the facts only some doors know; a reactor passes on the ones present. `dedupeKey` is
 * `deal.won:<leadId>`: a deal is won once per customer.
 */
export interface DealWonInput {
    /** The workspace of the lead. */
    readonly workspaceId: string
    /** The customer whose deal was won. */
    readonly leadId: string
    /** The customer name as shown. */
    readonly name: string
    /** The company, or null when unknown. */
    readonly company?: string
    /** The channel label, or null when unknown. */
    readonly channel?: string
    /** What the customer needed, or null when unknown. */
    readonly need?: string
    /** The number of the order that won the deal, when an order did. */
    readonly orderNo?: string
    /** The amount of that order in VND. */
    readonly amountVnd?: number
    /** The API source that set the stage, when the public API did. */
    readonly source?: string
    /** The evidence the owner gave, when a lead action recorded the win. */
    readonly evidence?: string
}

/** The payload of the event as published; the dedupe key is derived from the input. */
export interface DealWonPayload extends EventPayload, DealWonInput {}

/** The whenPresent facts of a won deal that a payload carries, each as the door sent it (null is absent); null when one is malformed. */
const optionalFacts = (payload: object): Partial<DealWonPayload> | null => {
    const orderNo = fieldOf(payload, "orderNo") ?? undefined
    const amountVnd = fieldOf(payload, "amountVnd") ?? undefined
    const source = fieldOf(payload, "source")
    const evidence = fieldOf(payload, "evidence") ?? undefined
    if (!isTextOrAbsent(orderNo) || !isTextOrAbsent(source) || !isTextOrAbsent(evidence)) return null
    if (amountVnd !== undefined && numberOf(amountVnd) === null) return null
    return {
        ...whenPresent("orderNo", orderNo),
        ...whenPresent("amountVnd", numberOf(amountVnd) ?? undefined),
        ...whenPresent("source", source),
        ...whenPresent("evidence", evidence),
    }
}

/** Version 1 of `deal_won`, published in the transaction that wins the deal of a customer. */
export class DealWonEvent extends BaseEvent {
    static readonly eventName = "deal_won"
    static readonly version = 1

    readonly eventName = DealWonEvent.eventName

    private constructor(
        readonly eventId: string,
        readonly payload: DealWonPayload,
    ) {
        super()
    }

    /** A deal is won once per customer: the lead id is the identity of the fact. */
    static create(payload: DealWonInput): DealWonEvent {
        const dedupeKey = `deal.won:${payload.leadId}`
        return new DealWonEvent(dedupeKey, { ...payload, dedupeKey })
    }

    /** Reads the event envelope; a malformed delivery never reaches a reactor. */
    static parse(envelope: unknown): ParsedEvent<DealWonEvent> {
        const parts = envelopeParts(envelope)
        if (parts === null) return null
        const { eventId, payload } = parts
        const workspaceId = textOf(fieldOf(payload, "workspaceId"))
        const leadId = keyOf(fieldOf(payload, "leadId"))
        const name = textOf(fieldOf(payload, "name"))
        const company = fieldOf(payload, "company") ?? undefined
        const channel = fieldOf(payload, "channel") ?? undefined
        const need = fieldOf(payload, "need") ?? undefined
        const facts = optionalFacts(payload)
        if (workspaceId === null || leadId === null || name === null || facts === null) return null
        if (!isTextOrAbsent(company) || !isTextOrAbsent(channel) || !isTextOrAbsent(need)) return null
        return new DealWonEvent(eventId, {
            dedupeKey: `deal.won:${leadId}`,
            workspaceId,
            leadId,
            name,
            ...whenPresent("company", company),
            ...whenPresent("channel", channel),
            ...whenPresent("need", need),
            ...facts,
        })
    }
}
