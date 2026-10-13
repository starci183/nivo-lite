/** One row of public.lead_flows as PostgreSQL returns it; the jsonb columns are read through the mapper. */
export interface LeadFlowRow {
    /** The id. */
    readonly id: string
    /** The workspace. */
    readonly workspace_id: string
    /** The lead. */
    readonly lead_id: string | null
    /** The Meta connection. */
    readonly connection_id: string | null
    /** The transcript. */
    readonly conversation_id: string | null
    /** facebook or instagram. */
    readonly platform: string | null
    /** The Messenger id. */
    readonly psid: string | null
    /** The Instagram id. */
    readonly igsid: string | null
    /** The phone. */
    readonly phone: string | null
    /** The email. */
    readonly email: string | null
    /** The name. */
    readonly name: string | null
    /** The state. */
    readonly state: string
    /** Where an escalated flow goes back to. */
    readonly resume_state: string | null
    /** The first touch (jsonb). */
    readonly source: unknown
    /** Every touch (jsonb). */
    readonly touches: unknown
    /** The answers (jsonb). */
    readonly answers: unknown
    /** How many questions were asked. */
    readonly asked: number
    /** The question waiting for an answer. */
    readonly pending_question: number | null
    /** When the contact was asked for. */
    readonly contact_asked_at: Date | string | null
    /** The signals (jsonb). */
    readonly signals: unknown
    /** The score. */
    readonly score: string | null
    /** Why (jsonb). */
    readonly score_reasons: unknown
    /** When it was scored. */
    readonly scored_at: Date | string | null
    /** The last turn's reading (jsonb). */
    readonly analysis: unknown
    /** When the person last wrote. */
    readonly last_user_at: Date | string | null
    /** What they last wrote. */
    readonly last_user_text: string | null
    /** When they were greeted. */
    readonly greeted_at: Date | string | null
    /** When they went to Sales. */
    readonly handed_off_at: Date | string | null
    /** When they were followed up. */
    readonly followed_up_at: Date | string | null
    /** When the flow closed. */
    readonly closed_at: Date | string | null
    /** When a person took over. */
    readonly escalated_at: Date | string | null
    /** Why. */
    readonly escalation_reason: string | null
}
