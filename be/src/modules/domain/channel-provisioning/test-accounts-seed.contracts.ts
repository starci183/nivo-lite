import type { WorkspaceRole } from "@modules/domain/workspace-members"

/** The schema name a test-accounts seed document carries. */
export const TEST_ACCOUNTS_SEED_SCHEMA = "nivo/test-accounts-seed@1"

/** One test seat: a sign-in with a role in a workspace, its address and password opened from the sealed member. */
export interface TestSeat {
    /** The role the seat holds in its workspace. */
    readonly role: WorkspaceRole
    /** The name shown for the seat. */
    readonly name: string
    /** The sign-in address. */
    readonly email: string
    /** The sign-in password. */
    readonly password: string
}

/** One workspace of test seats: its owner first, then the other seats. */
export interface TestWorkspace {
    /** The name of the workspace. */
    readonly name: string
    /** The owner seat. */
    readonly owner: TestSeat
    /** The seats the owner adds. */
    readonly others: ReadonlyArray<TestSeat>
}

/** One test-accounts seed document, checked. */
export interface TestAccountsSeed {
    /** The workspaces and their seats. */
    readonly workspaces: ReadonlyArray<TestWorkspace>
}
