/** public.authority as the prompts read it. */
export interface AuthorityRow {
    /** The business policies. */
    policies: string
    /** How replies are written. */
    reply_style: string
    /** The brand voice. */
    brand_voice: string
    /** What the agent must always ask about first. */
    limits_note: string
}

/** public.authority as the Authority page reads and writes it: the bigint and timestamp columns arrive converted by the query. */
export interface AuthorityProfileRow extends AuthorityRow {
    /** The bigint column converted to a number. */
    goal_revenue_vnd: number | null
    /** The new-customer goal. */
    goal_new_customers: number | null
    /** The first-reply goal, minutes. */
    goal_first_reply_minutes: number | null
    /** Free note on the goals. */
    goal_note: string
    /** Who saved it last. */
    updated_by: string | null
    /** ISO 8601 text. */
    updated_at: string
}
