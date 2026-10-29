import type { PublicLeadStage } from "@modules/domain/public-api"

/** What handing over a customer takes, as the caller sent it. */
export interface SubmitLeadRequest {
    /** The Authorization header as sent. */
    readonly authorization: string | undefined
    /** The customer's name. */
    readonly name: string
    /** The phone number. */
    readonly phone?: string | undefined
    /** The email address. */
    readonly email?: string | undefined
    /** The company. */
    readonly company?: string | undefined
    /** What the customer needs. */
    readonly need?: string | undefined
    /** The channel the customer came through. */
    readonly channel?: string | undefined
    /** The caller's own id of the customer: a repeat with the same id is one customer. */
    readonly externalId?: string | undefined
    /** A note for the customer's history. */
    readonly note?: string | undefined
    /** The stage the caller asks for; an empty string means none. */
    readonly stage?: PublicLeadStage | "" | undefined
}

/** What handing over a customer answers: queued, or unchanged for a repeated external id. */
export interface SubmitLeadResult {
    /** The customer already known by phone, email or name, or null until the hand-off creates one. */
    readonly leadId: string | null
    /** `accepted` when the hand-off was queued, `unchanged` when the same external id was already handed over. */
    readonly status: "accepted" | "unchanged"
}
