/** What POST /api/v1/leads answers about the customer. */
export class SubmitLeadDataResponse {
    /** The customer already known by phone, email or name, or null until the hand-off creates one. */
    lead_id!: string | null
    /** `accepted` when the hand-off was queued, `unchanged` when the same external id was already handed over. */
    status!: "accepted" | "unchanged"
}

/** The HTTP response of POST /api/v1/leads: the public API wraps its payload in `data`. */
export class SubmitLeadResponse {
    /** The hand-over. */
    data!: SubmitLeadDataResponse
}
