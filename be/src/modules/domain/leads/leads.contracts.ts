/** One stage of the journey of a lead, in order; the last two close it. */
export type LeadStage = "new" | "qualified" | "proposal" | "won" | "lost"

/** Who acts: the member of the workspace the guard admitted. */
export interface LeadActor {
    /** The Auth user. */
    readonly userId: string
    /** The name the evidence log shows. */
    readonly displayName: string
}

/** What recording an outcome takes: the lead, its new stage and the evidence behind it. */
export interface RecordOutcomeParams {
    /** The workspace the lead belongs to. */
    readonly workspaceId: string
    /** The lead whose stage changes. */
    readonly leadId: string
    /** The stage the journey moved to. */
    readonly stage: LeadStage
    /** Why: the evidence the person wrote; may be empty. */
    readonly evidence: string
    /** The member who records it. */
    readonly actor: LeadActor
    /** The `Accept-Language` header of the request; the lines written to the log use the language it names. */
    readonly acceptLanguage: string | undefined
}

/** What recording an outcome answers. */
export interface RecordedOutcome {
    /** The lead id. */
    readonly leadId: string
    /** The stage now recorded. */
    readonly stage: string
    /** The customer name. */
    readonly contactName: string
    /** The customer company. */
    readonly company: string
    /** The channel the lead came through. */
    readonly channel: string
    /** What the customer needs. */
    readonly need: string
    /** `live`, `simulated` or null for a lead recorded before origins existed. */
    readonly origin: string | null
    /** True when a won deal was handed to an active Accounting agent as the next responsibility. */
    readonly handedToAccounting: boolean
}
