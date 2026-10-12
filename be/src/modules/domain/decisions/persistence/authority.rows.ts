import type { AuthorityProfile, AuthorityRuleRecord, RuleMode } from "../decisions.contracts"

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

/** public.authority as the Authority page reads it: bigint and timestamp columns arrive converted by the query. */
export type AuthorityProfileRow = AuthorityProfile

/** public.authority_rules as the gate reads it; the bigint limit arrives converted to a number. */
export interface RuleRow {
    /** The id. */
    id: string
    /** The module. */
    department: string
    /** The action key. */
    action: string
    /** Constrained by a CHECK in the table. */
    mode: RuleMode
    /** The bigint column converted to a number by the query. */
    limit_vnd: number | null
    /** Fields that must be present. */
    required_fields: Array<string>
}

/** public.authority_rules as the Authority page lists and writes it. */
export type RuleRecordRow = AuthorityRuleRecord

/** The operating mode of an installed module. */
export interface OperatingModeRow {
    /** Assist or autopilot. */
    operating_mode: string
}
