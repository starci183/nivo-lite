/** What recording an outcome takes: the lead, the stage the journey moved to and the evidence behind it. */
export interface RecordOutcomeRequest {
    /** The lead whose stage changes. */
    readonly leadId: string
    /** The stage the journey moved to. */
    readonly stage: "new" | "qualified" | "proposal" | "won" | "lost"
    /** Why: the evidence the person wrote; may be empty. */
    readonly evidence: string
    /** The workspace the caller acts in, named in X-Workspace-Id; the domain service proves the caller membership in it. */
    readonly workspaceId: string
    /** The `Accept-Language` header of the request; the evidence lines use the language it names. */
    readonly acceptLanguage: string | undefined
}

/** What recording an outcome answers: the lead as it stands and whether the deal was handed to Accounting. */
export interface RecordOutcomeResult {
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
    /** True when a won deal was handed to an active Accounting agent. */
    readonly handedToAccounting: boolean
}
