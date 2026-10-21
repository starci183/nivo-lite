import type { InjectionToken } from "@nestjs/common"

/** What an Auth administrator call answers when it failed. */
export interface CleanupAuthFailure {
    /** What went wrong. */
    readonly message: string
}

/** One account the Auth administrator lists. */
export interface CleanupAuthUser {
    /** The Auth user id. */
    readonly id: string
    /** The sign-in email, when it has one. */
    readonly email?: string
}

/** Which page of accounts to list. */
export interface CleanupUsersPage {
    /** The page number, from 1. */
    readonly page: number
    /** How many accounts a page holds. */
    readonly perPage: number
}

/** The accounts of one page. */
export interface CleanupUsersData {
    /** The accounts. */
    readonly users: ReadonlyArray<CleanupAuthUser>
}

/** One page of accounts, or the failure. */
export interface CleanupUsersResult {
    /** The accounts of the page. */
    readonly data: CleanupUsersData
    /** The failure, when there is one. */
    readonly error: CleanupAuthFailure | null
}

/** What Auth answered about a deleted account. */
export interface CleanupUserDeleted {
    /** The failure, when there is one. */
    readonly error: CleanupAuthFailure | null
}

/** The account administration a cleanup needs: list every account, delete one. */
export interface CleanupAccounts {
    /** One page of accounts. */
    listUsers(page: CleanupUsersPage): Promise<CleanupUsersResult>
    /** Deletes one account for good. */
    deleteUser(id: string): Promise<CleanupUserDeleted>
}

/** What the workspace cleanup takes from the app root. */
export interface WorkspaceCleanupOptions {
    /** The provider token of the Auth account administration (a `CleanupAccounts`) in the app. */
    readonly accounts: InjectionToken
    /** Writes one line for the operator: progress and the public receipt, never credentials. */
    readonly print: (line: string) => void
}
