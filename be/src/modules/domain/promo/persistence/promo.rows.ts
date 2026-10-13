/** The earliest chatbot projection. */
export interface PromoChatbotRow {
    /** The installed chatbot identifier. */
    readonly id: string
    /** The installed chatbot handle, when present. */
    readonly handle: string
    /** The installed chatbot display name, when present. */
    readonly name: string
}

/** Aggregated facts of the promo read model. */
export interface PromoStateRow {
    /** The earliest installed chatbot identifier, when present. */
    readonly chatbot_id: string | null
    /** Whether the chatbot has nonempty knowledge text. */
    readonly has_knowledge: boolean
    /** Whether a module purchase occurred inside the campaign window. */
    readonly is_founding_member: boolean
    /** The website-channel lead count. */
    readonly website_count: number
    /** Website leads captured before 08:00 or after 18:00. */
    readonly after_hours_count: number
    /** The mean hours to the earliest response event. */
    readonly avg_wait_hours: number | null
    /** Whether a customer conversation exists. */
    readonly has_customer_conversation: boolean
    /** Whether a conversation has a captured lead. */
    readonly has_lead_conversation: boolean
    /** Whether an execution has been approved. */
    readonly has_approved: boolean
    /** Whether an outcome event belongs to a won lead. */
    readonly has_won: boolean
    /** Whether an invoice preparation responsibility was approved. */
    readonly invoice_approved: boolean
}

/** A scalar campaign membership check. */
export interface FoundingMemberRow {
    /** Whether a module purchase occurred inside the campaign window. */
    readonly is_founding_member: boolean
}

/** The bounded lead wait projection. */
export interface LeadWaitRow {
    /** Whether the website lead wait note applies. */
    readonly show: boolean
    /** Whole hours waiting, when at least one hour is recorded. */
    readonly hours: number | null
    /** Whether an approved reply exists. */
    readonly replied: boolean
}
