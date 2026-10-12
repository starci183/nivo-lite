import type { WorkspaceMember } from "@modules/domain/workspace-members"

/** One workspace as a member sees it. */
export interface WorkspaceSummary {
    /** The workspace id. */
    readonly id: string
    /** The workspace name. */
    readonly name: string
    /** `active`, `pending_payment` or `cancelled`. */
    readonly status: string
    /** The Auth user who owns it. */
    readonly ownerId: string
    /** When it was created, ISO 8601. */
    readonly createdAt: string
    /** The business type chosen at onboarding. */
    readonly businessType: string | null
}

/** A workspace together with the caller's membership in it. */
export interface WorkspaceMembership {
    /** The workspace. */
    readonly workspace: WorkspaceSummary
    /** The caller's membership. */
    readonly member: WorkspaceMember
}

/** The id of a workspace that was just created. */
export interface CreatedWorkspace {
    /** The new workspace. */
    readonly id: string
}
