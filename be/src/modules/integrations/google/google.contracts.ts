/** The form field name OAuth 2.0 (RFC 6749) mandates for the long-lived provider renewal credential in a token call. */
export const RENEWAL_GRANT_FIELD = "refresh_token"

/** The scope of the Sheets connection: only files NIVO created, plus the account identity. */
export const GOOGLE_SCOPE = "https://www.googleapis.com/auth/drive.file openid email"

/** The scope of the Second Brain Drive read grant (a Google restricted scope), asked on top of the Sheets one. */
export const DRIVE_READ_SCOPE = "https://www.googleapis.com/auth/drive.readonly openid email"

/**
 * The scope of the ledger grant: read and write the spreadsheets the owner names (a Google sensitive scope), asked on top of the Sheets
 * connection so the owner consents once more to add it (incremental authorisation); the scopes already granted are kept.
 */
export const SHEETS_SCOPE = "https://www.googleapis.com/auth/spreadsheets openid email"

/** The purpose a signed state carries for the Drive read grant; the Sheets connection has none. */
export const DRIVE_PURPOSE = "drive_read"

/** The purpose a signed state carries for the ledger grant (the Sheets scope added to the Google connection). */
export const SHEETS_PURPOSE = "sheets_ledger"

/** How long a signed OAuth state stays valid, in milliseconds. */
export const STATE_TTL_MS: number = 10 * 60 * 1000

/** The decoded, signature-checked OAuth state. */
export interface OAuthState {
    /** The workspace the consent belongs to. */
    readonly w: string
    /** The user who started it. */
    readonly u: string
    /** The same-site path to return to. */
    readonly r: string
    /** The expiry instant, epoch milliseconds. */
    readonly e: number
    /** The purpose: absent for the Sheets connection, `drive_read` for the Drive read grant, `sheets_ledger` for the ledger grant. */
    readonly p?: string
}

/** What a caller signs into a state. */
export interface OAuthStateInput {
    /** The workspace the consent belongs to. */
    readonly workspaceId: string
    /** The user who starts it. */
    readonly userId: string
    /** The path to return to; anything not a same-site path becomes the default. */
    readonly returnTo: string
    /** The purpose of the grant, when it is not the Sheets connection. */
    readonly purpose?: string
}

/** The tokens one Google token call answered. */
export interface GoogleTokenSet {
    /** The short-lived access token. */
    readonly accessToken: string
    /** The provider renewal token (not a session token), present on the first consent. */
    readonly renewalToken: string | null
    /** The access token expiry, epoch milliseconds. */
    readonly expiresAt: number
    /** The OpenID id token, when requested. */
    readonly idToken: string | null
    /** The scopes Google granted, space separated. */
    readonly scope: string | null
}

/** The values of a spreadsheet cell this integration writes. */
export type SheetCell = string | number

/** A return path or state token as the request carried it; absent when the request had none. */
export type ReceivedText = string | null | undefined

/** How a consent ended, written into the return url for the console to show. */
export type ConsentResult = "ok" | "error"

/** The query key the result lands under: `google` for the Sheets connection, `drive` for the Drive read grant, `sheets` for the ledger grant. */
export type ConsentResultKey = "google" | "drive" | "sheets"

/** The Google consent url; null when Google is not configured on this deployment. */
export type OptionalConsentUrl = string | null

/** A callback state whose signature checked out and has not expired; null otherwise. */
export type OptionalOAuthState = OAuthState | null

/** The account email Google vouches for; null when neither the id token nor the userinfo call gives one. */
export type OptionalAccountEmail = string | null

/** The tokens the account email is read from: the id token first, the userinfo call with the access token second. */
export interface GoogleIdentityTokens {
    /** The OpenID id token, whose email claim is read without a network call; null when Google sent none. */
    readonly idToken: string | null
    /** The access token the userinfo call is made with when the id token gives no email. */
    readonly accessToken: string
}
