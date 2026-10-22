import type { WorkspaceRole } from "../workspace-members.contracts"

/** The id of one seat of public.workspace_members. */
export interface MemberIdRow {
    /** The member id (the seat, not the Auth account). */
    id: string
}

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
