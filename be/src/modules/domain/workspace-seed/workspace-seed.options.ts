import type { InjectionToken } from "@nestjs/common"

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

/** What changes on an existing user. */
export interface SeedUserUpdate {
    /** The new password. */
    readonly password: string
    /** Whether the email counts as confirmed. */
    readonly email_confirm: boolean
    /** The profile metadata. */
    readonly user_metadata: Readonly<Record<string, unknown>>
}

/** The failure of an update, if any. */
export interface SeedUserUpdated {
    /** The failure, when there is one. */
    readonly error: SeedAuthFailure | null
}

/** The Auth administration the seed needs; the composition root hands the Supabase accounts service in. */
export interface SeedAuth {
    /** One page of users. */
    listUsers(page: SeedUsersPage): Promise<SeedUsersResult>
    /** Creates a confirmed user. */
    createUser(user: SeedNewUser): Promise<SeedUserCreated>
    /** Updates a user's password, confirmation and metadata. */
    updateUserById(id: string, update: SeedUserUpdate): Promise<SeedUserUpdated>
}

/** Where the operator keeps the passwords of the demo accounts: a file, never the log. */
export interface SeedSecretsStore {
    /** Where the secrets are kept, for the report. */
    readonly location: string
    /** The stored text; empty when nothing was stored yet. */
    read(): Promise<string>
    /** Replaces the stored text. */
    write(text: string): Promise<void>
}

/** What the workspace seed takes from the app root. */
export interface WorkspaceSeedOptions {
    /** The provider token of the Auth administration (a `SeedAuth`) in the app. */
    readonly auth: InjectionToken
    /** The operator's secrets file. */
    readonly secrets: SeedSecretsStore
    /** Writes one line of the report to the operator's terminal. */
    readonly print: (line: string) => void
}
