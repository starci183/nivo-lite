import type { ResolvedOfficeAuthority } from "./office-seed.contracts"

/**
 * The authority capability of v0.3.2 (authority-rules with bands and approver groups, and member-grants) as the office seed
 * needs it. The app root binds it to the token `SEED_OFFICE_AUTHORITY`; an app that binds none leaves the rules and grants
 * pending, and the receipt says so.
 */
export interface OfficeAuthorityPort {
    /** Saves every rule and every grant of the office for the workspace as its owner; refuses on a failure. */
    apply(workspaceId: string, ownerId: string, authority: ResolvedOfficeAuthority): Promise<void>
}
