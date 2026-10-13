import type { WorkspaceRole } from "../workspace-members.contracts"

/** public.workspace_members as the membership reads select it. */
export interface MemberRow {
    /** The workspace the membership belongs to. */
    workspace_id: string
    /** The Auth user. */
    user_id: string
    /** The staff row the account is, when it is one. */
    staff_id: string | null
    /** The name Office and the decision history show. */
    display_name: string
    /** Constrained by a CHECK in the table. */
    role: WorkspaceRole
    /** Constrained by a CHECK in the table. */
    status: "active" | "disabled"
}

/** public.staff as the link picker selects it. */
export interface StaffRow {
    /** The staff id. */
    id: string
    /** The staff name. */
    name: string
    /** The staff role label. */
    role: string
}
