/** A membership of the caller joined with its workspace, as the memberships read selects it. */
export interface MembershipRow {
    /** The workspace the membership belongs to. */
    workspace_id: string
    /** The Auth user. */
    user_id: string
    /** The staff row the account is, when it is one. */
    staff_id: string | null
    /** The name Office and the decision history show. */
    display_name: string
    /** Constrained by a CHECK in the table. */
    role: "owner" | "manager" | "staff"
    /** Constrained by a CHECK in the table. */
    status: "active" | "disabled"
    /** The workspace name. */
    workspace_name: string
    /** The workspace status. */
    workspace_status: string
    /** The Auth user who owns the workspace. */
    owner_id: string
    /** When the workspace was created. */
    workspace_created_at: string
    /** The business type chosen at onboarding. */
    business_type: string | null
}

/** The id of a created workspace. */
export interface TakenRow {
    /** True when the person already has a workspace or a membership. */
    taken: boolean
}

/** The id of a created workspace. */
export interface CreatedRow {
    /** The new workspace. */
    id: string
}

/** The one column FIND_WORKSPACE_NAME selects. */
export interface WorkspaceNameRow {
    /** The workspace name. */
    name: string
}
