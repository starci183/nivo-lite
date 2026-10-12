/** Workspace roles: owner and manager govern; staff operate. */
export type WorkspaceRole = "owner" | "manager" | "staff"

/** One person's identity inside one workspace; this, never a free-text name, is what authors and decides. */
export interface WorkspaceMember {
    /** The Auth user. */
    readonly userId: string
    /** The workspace the membership belongs to. */
    readonly workspaceId: string
    /** What the person may do in it. */
    readonly role: WorkspaceRole
    /** The staff row this account is, when it is one. */
    readonly staffId: string | null
    /** The name Office and the decision history show. */
    readonly displayName: string
    /** A disabled member keeps the row but loses access. */
    readonly status: "active" | "disabled"
}

/** A member as the team page lists them. */
export interface MemberListing extends WorkspaceMember {
    /** The account email; blank when the viewer is staff. */
    readonly email: string
    /** The last sign-in, ISO 8601; null when unknown or the viewer is staff. */
    readonly lastSignInAt: string | null
}

/** What makes a person a member: the workspace, the account and the role it grants. */
export interface JoinEntry {
    /** The workspace to join. */
    readonly workspaceId: string
    /** The Auth user who joins. */
    readonly userId: string
    /** The role the membership grants. */
    readonly role: string
    /** The staff row the account will be, when any. */
    readonly staffId: string | null
    /** The name to show when the staff row gives none. */
    readonly displayName: string
}

/** The part of a work item that decides who may decide it. */
export interface DecisionItem {
    /** `staff`, `agent`, or absent when unassigned. */
    readonly assigneeKind?: string | null
    /** The assigned staff id. */
    readonly assigneeId?: string | null
}
