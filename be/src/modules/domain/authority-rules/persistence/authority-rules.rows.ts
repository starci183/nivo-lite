/** The mode a stored rule carries; constrained by a CHECK in the table. */
export type RuleModeRow = "auto" | "ask" | "never"

/** public.authority_rules as the gate reads it; the bigint limit arrives converted to a number. */
export interface RuleRow {
    /** The id. */
    id: string
    /** The module. */
    department: string
    /** The action key. */
    action: string
    /** Constrained by a CHECK in the table. */
    mode: RuleModeRow
    /** The bigint column converted to a number by the query. */
    limit_vnd: number | null
    /** Fields that must be present. */
    required_fields: Array<string>
}

/** public.authority_rules as the Authority page lists and writes it. */
export interface RuleRecordRow extends RuleRow {
    /** The workspace. */
    workspace_id: string
    /** A note on the rule. */
    note: string
    /** ISO 8601 text. */
    updated_at: string
}

/** The operating mode of an installed module. */
export interface OperatingModeRow {
    /** Assist or autopilot. */
    operating_mode: string
}
