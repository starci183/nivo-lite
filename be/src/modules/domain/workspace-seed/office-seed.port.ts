import type { ResolvedOfficeAuthority } from "./office-seed.contracts"

/**
 * The authority capability of v0.3.2 (authority-rules with bands and approver groups, and member-grants) as the office seed
 * needs it. The app root binds it to the token `SEED_OFFICE_AUTHORITY` (OfficeAuthorityService of member-grants).
 */
export interface OfficeAuthorityPort {
    /** Saves every rule and every grant of the office for the workspace; refuses on a failure. */
    apply(workspaceId: string, authority: ResolvedOfficeAuthority): Promise<void>
}
