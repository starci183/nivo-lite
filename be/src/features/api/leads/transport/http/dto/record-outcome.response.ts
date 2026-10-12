/** The HTTP response of record-outcome. */
export class RecordOutcomeResponse {
    /** The lead id. */
    leadId!: string
    /** The stage now recorded. */
    stage!: string
    /** The customer name. */
    contactName!: string
    /** The customer company. */
    company!: string
    /** The channel the lead came through. */
    channel!: string
    /** What the customer needs. */
    need!: string
    /** `live`, `simulated` or null for a lead recorded before origins existed. */
    origin!: string | null
    /** True when a won deal was handed to an active Accounting agent. */
    handedToAccounting!: boolean
}
