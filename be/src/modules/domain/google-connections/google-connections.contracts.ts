import type { ConnectionActor, ConnectionRecord, Provider } from "@modules/domain/connections"

/** One Google account a workspace connected. */
export interface GoogleConnectionAccount {
    /** The id of the connection. */
    readonly id: string
    /** The account email, blank when Google never said. */
    readonly email: string
    /** The status of the connection. */
    readonly status: string
}

/** Where the browser goes back to once the consent is decided: an absolute location on the site with the result in its query. */
export interface GoogleCallbackResult {
    /** The absolute location to redirect to. */
    readonly location: string
}

/** What a consent callback carries. */
export interface GoogleCallbackInput {
    /** The signed state Google echoed. */
    readonly state: string | undefined
    /** The consent code. */
    readonly code: string | undefined
    /** The error Google reported instead of a code. */
    readonly error: string | undefined
}

/** The tokens kept sealed for one Google account. */
export interface StoredGoogleTokens {
    /** The short-lived access token. */
    readonly access_token: string
    /** The refresh token. */
    readonly refresh_token: string
    /** When the access token stops working, epoch milliseconds. */
    readonly expires_at: number
}

/** The spreadsheet an automation writes to. */
export interface OrdersSheet {
    /** The Google spreadsheet id. */
    readonly spreadsheetId: string
    /** The url to open it. */
    readonly spreadsheetUrl: string
}

/** Where the Google Drive read grant of a workspace stands: never given, working, or revoked. */
export type DriveGrantState = "none" | "connected" | "lost"

/** The Google Drive read grant of a workspace. */
export interface DriveGrant {
    /** Whether it was given, works, or was revoked. */
    readonly state: DriveGrantState
    /** The Google account that gave it, blank when none or Google never said. */
    readonly email: string
}

/** A consent to start: the Google page the browser must go to. */
export interface ConsentStart {
    /** The Google consent url. */
    readonly url: string
}

/** Whether Google can be used on this deployment. */
export interface GoogleSetup {
    /** True when an OAuth client and a site url are configured. */
    readonly configured: boolean
}

/** What a consent start signs into its state. */
export interface ConsentRequest {
    /** The person starting it, in their workspace. */
    readonly actor: ConnectionActor
    /** The same-site path to come back to. */
    readonly returnTo: string
    /** The scopes to ask for. */
    readonly scope: string
    /** The purpose of the grant, absent for the Sheets connection. */
    readonly purpose?: string
}

/** A consent to store on a connection: the tokens Google answered and how the row is named. */
export interface TokenSave {
    /** The workspace. */
    readonly workspaceId: string
    /** The person who gave the consent. */
    readonly userId: string
    /** The existing connection to update, or null to create one. */
    readonly row: MaybeConnection
    /** The provider of a new row. */
    readonly provider: Provider
    /** The name of the connection. */
    readonly name: string
    /** The public facts of the connection. */
    readonly meta: Readonly<Record<string, string>>
    /** The tokens to seal. */
    readonly tokens: StoredGoogleTokens
}

/** A connection, or none. */
export type MaybeConnection = ConnectionRecord | null

/** A refresh token, or none. */
export type MaybeRefreshToken = string | null

/** Answers an access token; `force` refreshes it even while the stored one is still good. */
export type TokenSource = (force: boolean) => Promise<string>

/** Work done with an access token. */
export type TokenWork<T> = (token: string) => Promise<T>

/** True when a failure means the access token was refused and a fresh one is worth one retry. */
export type TokenRejected = (error: unknown) => boolean

/** How a valid access token is obtained for one connection. */
export interface TokenRequest {
    /** The connection whose tokens are used. */
    readonly row: ConnectionRecord
    /** True to refresh even when the stored token is still good. */
    readonly force: boolean
}
