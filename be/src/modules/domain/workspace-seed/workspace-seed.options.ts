import type { InjectionToken } from "@nestjs/common"
import type { Secret } from "@modules/platform/config"

/** One user the Auth administrator returns. */
export interface SeedAuthUser {
    /** The Auth user id. */
    readonly id: string
    /** The user's email, when it has one. */
    readonly email?: string
    /** The profile metadata. */
    readonly user_metadata?: Readonly<Record<string, unknown>>
}

/** What an Auth administrator call answers when it failed. */
export interface SeedAuthFailure {
    /** What went wrong. */
    readonly message: string
}

/** Which page of users to list. */
export interface SeedUsersPage {
    /** The page number, from 1. */
    readonly page: number
    /** How many users a page holds. */
    readonly perPage: number
}

/** The users of one page. */
export interface SeedUsersData {
    /** The users. */
    readonly users: ReadonlyArray<SeedAuthUser>
}

/** The user an Auth call created. */
export interface SeedUserData {
    /** The created user, when there is one. */
    readonly user: SeedCreatedUser | null
}

/** The id of a created user. */
export interface SeedCreatedUser {
    /** The Auth user id. */
    readonly id: string
}

/** One page of users, or the failure. */
export interface SeedUsersResult {
    /** The users of the page. */
    readonly data: SeedUsersData
    /** The failure, when there is one. */
    readonly error: SeedAuthFailure | null
}

/** A confirmed user to create. */
export interface SeedNewUser {
    /** The sign-in email. */
    readonly email: string
    /** The password. */
    readonly password: string
    /** Whether the email counts as confirmed. */
    readonly email_confirm: boolean
    /** The profile metadata. */
    readonly user_metadata: Readonly<Record<string, unknown>>
}

/** The user an Auth call created, or the failure. */
export interface SeedUserCreated {
    /** The created user. */
    readonly data: SeedUserData
    /** The failure, when there is one. */
    readonly error: SeedAuthFailure | null
}

/** One authenticated password session whose private tokens stay inside the integration. */
export interface SeedPrincipalSession {
    /** The user Auth actually authenticated. */
    readonly id: string
    /** Revokes this call's refresh session only and acknowledges cleanup without returning credentials. */
    readonly close: () => Promise<boolean>
}

/** Account and authenticated-session operations needed by the explicit workspace runner. */
export interface SeedAuth {
    /** One page of users. */
    listUsers(page: SeedUsersPage): Promise<SeedUsersResult>
    /** Creates a confirmed user. */
    createUser(user: SeedNewUser): Promise<SeedUserCreated>
    /** Opens a user password session; the caller must close only this owned session. */
    openPasswordPrincipal(email: string, password: string): Promise<SeedPrincipalSession | null>
    /** Authenticates a session through Auth, returning only the verified user id. */
    verifyUser(token: string): Promise<string | null>
}

/** What the workspace seed takes from the app root. */
export interface WorkspaceSeedOptions {
    /** The provider token of the Auth administration (a `SeedAuth`) in the app. */
    readonly auth: InjectionToken
    /** Private command input supplied by the selected target runner. */
    readonly input?: Secret
    /** Writes the closed public receipt, never credentials. */
    readonly print: (line: string) => void
}
