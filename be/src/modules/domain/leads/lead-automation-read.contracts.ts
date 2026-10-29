/** The columns of a lead an automation executor reads. */
export interface AutomationLeadRead {
    /** The lead id. */
    readonly id: string
    /** The name the customer goes by. */
    readonly contact_name: string
    /** The company. */
    readonly company: string
    /** The channel it came from. */
    readonly channel: string
    /** What the customer needs. */
    readonly need: string
    /** The stage. */
    readonly stage: string
    /** The phone number. */
    readonly phone: string | null
    /** The email address. */
    readonly email: string | null
}

/** The columns of a lead an automation scan reads. */
export interface AutomationScanLead {
    /** The lead id. */
    readonly id: string
    /** The stage. */
    readonly stage: string
    /** When it was created. */
    readonly created_at: string
}

/** What the scan of leads is asked: the leads created after an instant, in some stages or in every stage but one. */
export interface AutomationScanLeadsQuery {
    /** The workspace. */
    readonly workspaceId: string
    /** The instant the leads were created after, ISO. */
    readonly since: string
    /** The stages to read, or null for every stage. */
    readonly stages: ReadonlyArray<string> | null
    /** The stage to leave out, or null. */
    readonly except: string | null
    /** The most leads read. */
    readonly limit: number
}
