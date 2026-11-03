/** What the transport knows about the device a sign-in comes from. */
export interface DeviceMeta {
    /** The raw user agent, bounded by the transport. */
    readonly userAgent: string | null
    /** The caller address. */
    readonly ip: string | null
}

/** The person a session belongs to. */
export interface SessionUser {
    /** The user id. */
    readonly id: string
    /** The account email. */
    readonly email: string
}

/** The tokens one sign-in or refresh produces; the refresh token only ever leaves in the cookie. */
export interface SessionTokens {
    /** The compact access JWT. */
    readonly accessToken: string
    /** When the access token stops being accepted, ISO 8601. */
    readonly accessExpiresAt: string
    /** How many seconds the access token lives. */
    readonly accessExpiresIn: number
    /** The opaque token the refresh cookie carries. */
    readonly cookieToken: string
    /** How long the refresh cookie lives, in seconds. */
    readonly refreshMaxAgeSeconds: number
    /** The signed-in person. */
    readonly user: SessionUser
}

/** What a sign-in, refresh or session check answers in the body. */
export interface AccessGrant {
    /** The access JWT, to be sent as a Bearer token. */
    readonly accessToken: string
    /** How many seconds the access token lives. */
    readonly expiresIn: number
    /** When the access token stops being accepted, ISO 8601. */
    readonly expiresAt: string
    /** The signed-in person. */
    readonly user: SessionUser
}

/** Where the browser goes after the Google round trip: the web app on success, its sign-in page with an error flag on failure. */
export interface GoogleRedirect {
    /** The absolute address. */
    readonly url: string
    /** The redirect status. */
    readonly statusCode: number
}

/** How an invitation left: a new-account email, a sign-in email, or not at all. */
export type InviteSent = "invited" | "existing" | "none"

/** What a single-use emailed token is for. */
export type PasswordPurpose = "reset" | "invite" | "confirm"

/** Which counter an attempt is counted against. */
export type AttemptKind = "login" | "reset" | "signup"

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
