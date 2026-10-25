import type { LeadRecordRow } from "./persistence/lead-records.rows"

/** A lead, or null when the workspace has no such lead. */
export type OptionalLeadRecord = LeadRecordRow | null

/** Nonempty public API facts to patch on an existing customer inside its request transaction. */
export interface PublicLeadFactsPatch {
    /** The workspace that owns the customer. */
    readonly workspaceId: string
    /** The existing customer. */
    readonly leadId: string
    /** A nonempty company replaces the recorded company. */
    readonly company: string
    /** A nonempty supplied need replaces the recorded need; null preserves it. */
    readonly need: string | null
}

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

/** Who a lead is by name, for the labels of invoices and payments that point at it. */
export interface LeadName {
    /** The lead id. */
    readonly id: string
    /** The customer's name. */
    readonly contact_name: string
}

/** The contact a known lead was missing. */
export interface ContactFill {
    /** The workspace. */
    readonly workspaceId: string
    /** The lead. */
    readonly leadId: string
    /** The normalised phone, or null. */
    readonly phone: string | null
    /** The normalised email, or null. */
    readonly email: string | null
}
