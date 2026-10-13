import type { LeadRecord } from "./persistence/lead-records.rows"

/** A lead, or null when the workspace has no such lead. */
export type OptionalLeadRecord = LeadRecord | null

/** What identifies the customer an input belongs to. */
export interface LeadMatch {
    /** The workspace. */
    readonly workspaceId: string
    /** The normalised phone, or null. */
    readonly phone: string | null
    /** The normalised email, or null. */
    readonly email: string | null
    /** The name, used only when the input carries no phone and no email. */
    readonly name: string | null
    /** The channel label, used with the name. */
    readonly channel: string | null
}

/** What capturing a new customer takes. */
export interface NewLead {
    /** The workspace. */
    readonly workspaceId: string
    /** The customer's name. */
    readonly contactName: string
    /** The company. */
    readonly company: string
    /** The channel label the customer came through. */
    readonly channel: string
    /** What the customer needs. */
    readonly need: string
    /** The normalised phone, or null. */
    readonly phone: string | null
    /** The normalised email, or null. */
    readonly email: string | null
    /** Real or simulated. */
    readonly origin: string
}

/** What the sales AI learned about a lead. */
export interface LeadClassification {
    /** The workspace. */
    readonly workspaceId: string
    /** The lead. */
    readonly leadId: string
    /** The stage to move to, or null to leave it. */
    readonly stage: string | null
    /** The context brief to store, or null to leave it. */
    readonly contextSummary: string | null
}

/** The name of a lead. */
export interface LeadName {
    /** The lead id. */
    readonly id: string
    /** The customer's name. */
    readonly contact_name: string
}
