/** How an invitation left: a new-account email, a sign-in email, or not at all. */
export type InviteSent = "invited" | "existing" | "none"

/** What an operator account call answers when it failed. */
export interface AccountAdminFailure {
    /** What went wrong. */
    readonly message: string
}

/** Which page of accounts to list. */
export interface AccountPage {
    /** The page number, from 1. */
    readonly page: number
    /** How many accounts a page holds. */
    readonly perPage: number
}

/** One account of the operator listing. */
export interface AccountListed {
    /** The account id. */
    readonly id: string
    /** The sign-in address, empty when the account has none. */
    readonly email: string
    /** The profile metadata. */
    readonly user_metadata: Readonly<Record<string, unknown>>
}

/** The accounts of one page. */
export interface AccountPageData {
    /** The accounts. */
    readonly users: ReadonlyArray<AccountListed>
}

/** One page of accounts, or the failure. */
export interface AccountPageResult {
    /** The accounts of the page. */
    readonly data: AccountPageData
    /** The failure, when there is one. */
    readonly error: AccountAdminFailure | null
}

/** A person with a password to create. */
export interface NewAccount {
    /** The sign-in address. */
    readonly email: string
    /** The password. */
    readonly password: string
    /** Whether the mailbox counts as confirmed. */
    readonly email_confirm: boolean
    /** The profile metadata. */
    readonly user_metadata: Readonly<Record<string, unknown>>
}

/** The id of a created account. */
export interface AccountCreatedUser {
    /** The account id. */
    readonly id: string
}

/** What a create call made. */
export interface AccountCreatedData {
    /** The created person, when there is one. */
    readonly user: AccountCreatedUser | null
}

/** The person a create call made, or the failure. */
export interface AccountCreated {
    /** The created person, when there is one. */
    readonly data: AccountCreatedData
    /** The failure, when there is one. */
    readonly error: AccountAdminFailure | null
}

/** What a delete call answers. */
export interface AccountRemoved {
    /** The failure, when there is one. */
    readonly error: AccountAdminFailure | null
}

/** A password proved by the person and a session of its own; the caller must close it. */
export interface PasswordPrincipal {
    /** The person the password belongs to. */
    readonly id: string
    /** Ends this call's session only and says whether it ended. */
    readonly close: () => Promise<boolean>
}
