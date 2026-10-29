import { BaseEvent } from "@modules/platform/event-bus"
import type { EventPayload, ParsedEvent } from "@modules/platform/event-bus"
import { envelopeParts, fieldOf, keyOf, textOf } from "./event-fields.policy"

/**
 * The payload of the `lead_captured` event: a new customer (lead) was created in the workspace. A reactor takes identities and display
 * facts from here and reads the lead itself when it needs the current state. `dedupeKey` is `lead.created:<leadId>`: a lead is
 * captured once, however many doors reached it.
 */
export interface LeadCapturedPayload extends EventPayload {
    /** The workspace of the lead. */
    readonly workspaceId: string
    /** The new lead. */
    readonly leadId: string
    /** The customer name as captured. */
    readonly contactName: string
    /** The company as captured. */
    readonly company: string
    /** The channel label the customer came through. */
    readonly channel: string
    /** What the customer needs. */
    readonly need: string
    /** The phone, or null. */
    readonly phone: string | null
    /** The email, or null. */
    readonly email: string | null
}

/** Version 1 of `lead_captured`, published in the transaction that creates a lead. */
export class LeadCapturedEvent extends BaseEvent {
    static readonly eventName = "lead_captured"
    static readonly version = 1

    readonly eventName = LeadCapturedEvent.eventName

    private constructor(
        readonly eventId: string,
        readonly payload: LeadCapturedPayload,
    ) {
        super()
    }

    /** A lead is captured once: the lead id is the identity of the fact. */
    static create(payload: Omit<LeadCapturedPayload, "dedupeKey">): LeadCapturedEvent {
        const dedupeKey = `lead.created:${payload.leadId}`
        return new LeadCapturedEvent(dedupeKey, { ...payload, dedupeKey })
    }

    /** Reads the event envelope; a malformed delivery never reaches a reactor. */
    static parse(envelope: unknown): ParsedEvent<LeadCapturedEvent> {
        const parts = envelopeParts(envelope)
        if (parts === null) return null
        const { eventId, payload } = parts
        const workspaceId = textOf(fieldOf(payload, "workspaceId"))
        const leadId = keyOf(fieldOf(payload, "leadId"))
        const contactName = textOf(fieldOf(payload, "contactName"))
        const company = textOf(fieldOf(payload, "company"))
        const channel = textOf(fieldOf(payload, "channel"))
        const need = textOf(fieldOf(payload, "need"))
        const phone = fieldOf(payload, "phone")
        const email = fieldOf(payload, "email")
        if (workspaceId === null || leadId === null || contactName === null || company === null) return null
        if (channel === null || need === null) return null
        if ((phone !== null && typeof phone !== "string") || (email !== null && typeof email !== "string")) return null
        return new LeadCapturedEvent(eventId, {
            dedupeKey: `lead.created:${leadId}`,
            workspaceId,
            leadId,
            contactName,
            company,
            channel,
            need,
            phone,
            email,
        })
    }
}
