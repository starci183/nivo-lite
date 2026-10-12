/** The owner's goals and house rules that the prompts carry. */
export interface Authority {
    /** The business policies. */
    readonly policies: string
    /** How replies are written. */
    readonly reply_style: string
    /** The brand voice. */
    readonly brand_voice: string
    /** What the agent must always ask about first. */
    readonly limits_note: string
}

/** The whole authority sheet the Authority page edits. */
export interface AuthorityProfile extends Authority {
    /** The monthly revenue goal, VND. */
    readonly goal_revenue_vnd: number | null
    /** The new-customer goal. */
    readonly goal_new_customers: number | null
    /** The first-reply goal, minutes. */
    readonly goal_first_reply_minutes: number | null
    /** Free note on the goals. */
    readonly goal_note: string
    /** Who saved it last. */
    readonly updated_by: string | null
    /** When it was saved last. */
    readonly updated_at: string
}

/** The owner's authority, or null before the workspace has one. */
export type OptionalAuthority = Authority | null

/** The authority sheet, or null before the workspace has one. */
export type OptionalAuthorityProfile = AuthorityProfile | null

/** The fields of the authority sheet a manager changes; omitted fields stay as they are. */
export interface AuthorityPatch {
    /** The business policies. */
    readonly policies?: string
    /** How replies are written. */
    readonly reply_style?: string
    /** The brand voice. */
    readonly brand_voice?: string
    /** What the agent must always ask about first. */
    readonly limits_note?: string
    /** The monthly revenue goal, VND. */
    readonly goal_revenue_vnd?: number | null
    /** The new-customer goal. */
    readonly goal_new_customers?: number | null
    /** The first-reply goal, minutes. */
    readonly goal_first_reply_minutes?: number | null
    /** Free note on the goals. */
    readonly goal_note?: string
}

/** The authority sheet as it is written: every field present. */
export interface AuthorityFields {
    /** The business policies. */
    readonly policies: string
    /** How replies are written. */
    readonly reply_style: string
    /** The brand voice. */
    readonly brand_voice: string
    /** What the agent must always ask about first. */
    readonly limits_note: string
    /** The monthly revenue goal, VND. */
    readonly goal_revenue_vnd: number | null
    /** The new-customer goal. */
    readonly goal_new_customers: number | null
    /** The first-reply goal, minutes. */
    readonly goal_first_reply_minutes: number | null
    /** Free note on the goals. */
    readonly goal_note: string
}

/** Whose authority a call reads: the workspace; a work context satisfies it structurally. */
export interface AuthorityScope {
    /** The workspace. */
    readonly workspaceId: string
}
