/** The goals and house rules the Authority page edits. */
export class AuthorityProfileResponse {
    /** The business policies. */
    policies!: string
    /** How replies are written. */
    reply_style!: string
    /** The brand voice. */
    brand_voice!: string
    /** What the agent must always ask about first. */
    limits_note!: string
    /** The monthly revenue goal, VND. */
    goal_revenue_vnd!: number | null
    /** The new-customer goal. */
    goal_new_customers!: number | null
    /** The first-reply goal, minutes. */
    goal_first_reply_minutes!: number | null
    /** Free note on the goals. */
    goal_note!: string
    /** Who saved it last. */
    updated_by!: string | null
    /** When it was saved last, ISO 8601. */
    updated_at!: string
}

/** The rule of the owner for one action. */
export class AuthorityRuleResponse {
    /** The id. */
    id!: string
    /** The workspace. */
    workspace_id!: string
    /** The module. */
    department!: string
    /** The action key. */
    action!: string
    /** Run alone, ask a person, or never. */
    mode!: string
    /** The action runs alone strictly below this amount, VND; null means no limit. */
    limit_vnd!: number | null
    /** Fields that must be present. */
    required_fields!: ReadonlyArray<string>
    /** A note on the rule. */
    note!: string
    /** When it was saved last, ISO 8601. */
    updated_at!: string
}

/** What the Authority page reads: the sheet and every stored rule. */
export class AuthoritySheetResponse {
    /** The goals and house rules; null before the workspace has any. */
    profile!: AuthorityProfileResponse | null
    /** Every stored rule. */
    rules!: ReadonlyArray<AuthorityRuleResponse>
}
