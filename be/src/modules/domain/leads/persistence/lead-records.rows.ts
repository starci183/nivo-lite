/** public.leads as the lead records read it. */
export interface LeadRecordRow {
    /** The lead id. */
    readonly id: string
    /** The workspace. */
    readonly workspace_id: string
    /** The customer's name. */
    readonly contact_name: string
    /** The company. */
    readonly company: string
    /** The channel label. */
    readonly channel: string
    /** What the customer needs. */
    readonly need: string
    /** `new`, `qualified`, `proposal`, `won` or `lost`. */
    readonly stage: string
    /** The context brief, or null. */
    readonly context_summary: string | null
    /** The phone, or null. */
    readonly phone: string | null
    /** The email, or null. */
    readonly email: string | null
}
