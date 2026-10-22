import type { RuleUnit } from "@modules/domain/authority-rules"
import type { WorkspaceRole } from "@modules/domain/workspace-members"

/** One member of a workspace with the department rooms they sit in. */
export interface DirectoryRow {
    /** The member id (the seat). */
    member_id: string
    /** The display name. */
    name: string
    /** Constrained by a CHECK in the table. */
    role: WorkspaceRole
    /** Constrained by a CHECK in the table. */
    status: "active" | "disabled"
    /** The keys of the rooms the member sits in, in room order. */
    rooms: Array<string>
}

/** public.member_grants as the statements select it; the numeric limit arrives converted to a number. */
export interface GrantRow {
    /** The grant id. */
    id: string
    /** The workspace. */
    workspace_id: string
    /** The member the grant belongs to. */
    member_id: string
    /** The action key. */
    action: string
    /** Constrained by a CHECK in the table. */
    unit: RuleUnit
    /** The numeric column converted to a number by the query; null means no limit. */
    max_amount: number | null
    /** ISO 8601 text. */
    updated_at: string
}
