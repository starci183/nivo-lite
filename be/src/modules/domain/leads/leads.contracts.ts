/** One stage of the journey of a lead, in order; the last two close it. */
export type LeadJourneyStage = "new" | "qualified" | "proposal" | "won" | "lost"

/** What recording an outcome takes: the lead, its new stage and the evidence behind it. */
export interface RecordOutcomeParams {
    /** The workspace the lead belongs to. */
    readonly workspaceId: string
    /** The lead whose stage changes. */
    readonly leadId: string
    /** The stage the journey moved to. */
    readonly stage: LeadJourneyStage
    /** Why: the evidence the person wrote; may be empty. */
    readonly evidence: string
    /** The signed-in caller; the workspace members service proves the membership and names the actor. */
    readonly userId: string
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
    /** True when a won deal was handed to an active Accounting agent as the next responsibility. */
    readonly handedToAccounting: boolean
}

/** A lead as a stage change answers it. */
export interface StagedLead {
    /** The lead id. */
    readonly id: string
    /** The name of the contact. */
    readonly contact_name: string
    /** The company of the contact. */
    readonly company: string
    /** The channel the lead came through. */
    readonly channel: string
    /** What the customer needs. */
    readonly need: string
    /** The stage the lead now stands at. */
    readonly stage: string
}
