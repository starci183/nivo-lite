import type { ApprovalPolicy, RuleUnit } from "../authority-rules.contracts"

/** The mode a stored rule carries; constrained by a CHECK in the table. */
export type RuleModeRow = "auto" | "ask" | "never"

/** public.authority_rules as the gate reads it; the bigint limit and the numeric bands arrive converted to numbers. */
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
    /** Constrained by a CHECK in the table. */
    unit: RuleUnit
    /** The numeric column converted to a number by the query. */
    auto_max: number | null
    /** The numeric column converted to a number by the query. */
    ask_max: number | null
    /** The uuid[] column converted to text by the query. */
    agents: Array<string>
}

/** public.authority_rules as the Authority page lists and writes it. */
export interface RuleRecordRow extends RuleRow {
    /** The workspace. */
    workspace_id: string
    /** A note on the rule. */
    note: string
    /** ISO 8601 text. */
    updated_at: string
    /** Constrained by a CHECK in the table. */
    approver_roles: Array<"owner" | "manager" | "staff">
    /** Keys of department rooms. */
    approver_rooms: Array<string>
    /** The uuid[] column converted to text by the query. */
    approver_members: Array<string>
    /** Constrained by a CHECK in the table. */
    approval_policy: ApprovalPolicy
    /** Constrained by a CHECK in the table. */
    timeout_minutes: number
}

/** The approval side of public.authority_rules. */
export interface ApprovalSetupRow {
    /** The module. */
    department: string
    /** The action key. */
    action: string
    /** Constrained by a CHECK in the table. */
    mode: RuleModeRow
    /** Constrained by a CHECK in the table. */
    unit: RuleUnit
    /** The numeric column converted to a number by the query. */
    auto_max: number | null
    /** The numeric column converted to a number by the query. */
    ask_max: number | null
    /** Constrained by a CHECK in the table. */
    approver_roles: Array<"owner" | "manager" | "staff">
    /** Keys of department rooms. */
    approver_rooms: Array<string>
    /** The uuid[] column converted to text by the query. */
    approver_members: Array<string>
    /** Constrained by a CHECK in the table. */
    approval_policy: ApprovalPolicy
    /** Constrained by a CHECK in the table. */
    timeout_minutes: number
    /** The uuid[] column converted to text by the query. */
    agents: Array<string>
}

/** The operating mode of an installed module. */
export interface OperatingModeRow {
    /** Assist or autopilot. */
    operating_mode: string
}
