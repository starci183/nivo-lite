import { BaseEvent } from "@modules/platform/event-bus"
import type { EventPayload, ParsedEvent } from "@modules/platform/event-bus"
import { envelopeParts, fieldOf, keyOf, numberOf, textOf } from "./event-fields.policy"

/**
 * The payload of the `deal_won` event: the deal of a customer was won (an order was confirmed for it, or the public API or the owner
 * set the lead to won). The optional fields are the facts only some doors know; a reactor passes on the ones present. `dedupeKey` is
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
    readonly company: string | null
    /** The channel label, or null when unknown. */
    readonly channel: string | null
    /** What the customer needed, or null when unknown. */
    readonly need: string | null
    /** The number of the order that won the deal, when an order did. */
    readonly orderNo?: string | null
    /** The amount of that order in VND. */
    readonly amountVnd?: number | null
    /** The API source that set the stage, when the public API did. */
    readonly source?: string
    /** The evidence the owner gave, when a lead action recorded the win. */
    readonly evidence?: string | null
}

/** The payload of the event as published; the dedupe key is derived from the input. */
export interface DealWonPayload extends EventPayload, DealWonInput {}

/** The optional facts of a won deal that a payload carries, each as the door sent it; null when one is malformed. */
const optionalFacts = (payload: object): Partial<DealWonPayload> | null => {
    const orderNo = fieldOf(payload, "orderNo")
    const amountVnd = fieldOf(payload, "amountVnd")
    const source = fieldOf(payload, "source")
    const evidence = fieldOf(payload, "evidence")
    if (orderNo !== undefined && orderNo !== null && typeof orderNo !== "string") return null
    if (amountVnd !== undefined && amountVnd !== null && numberOf(amountVnd) === null) return null
    if (source !== undefined && typeof source !== "string") return null
    if (evidence !== undefined && evidence !== null && typeof evidence !== "string") return null
    return {
        ...(orderNo === undefined ? {} : { orderNo: textOf(orderNo) }),
        ...(amountVnd === undefined ? {} : { amountVnd: numberOf(amountVnd) }),
        ...(typeof source === "string" ? { source } : {}),
        ...(evidence === undefined ? {} : { evidence: textOf(evidence) }),
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
        const company = fieldOf(payload, "company")
        const channel = fieldOf(payload, "channel")
        const need = fieldOf(payload, "need")
        const facts = optionalFacts(payload)
        if (workspaceId === null || leadId === null || name === null || facts === null) return null
        for (const known of [company, channel, need]) {
            if (known !== null && typeof known !== "string") return null
        }
        return new DealWonEvent(eventId, {
            dedupeKey: `deal.won:${leadId}`,
            workspaceId,
            leadId,
            name,
            company: textOf(company),
            channel: textOf(channel),
            need: textOf(need),
            ...facts,
        })
    }
}
