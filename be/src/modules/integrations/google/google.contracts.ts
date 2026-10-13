/** The scope of the Sheets connection: only files NIVO created, plus the account identity. */
export const GOOGLE_SCOPE = "https://www.googleapis.com/auth/drive.file openid email"

/** The purpose a signed state carries for the Drive read grant; the Sheets connection has none. */
export const DRIVE_PURPOSE = "drive_read"

/** How long a signed OAuth state stays valid, in milliseconds. */
export const STATE_TTL_MS = 10 * 60 * 1000

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
    /** The purpose: absent for the Sheets connection, `drive_read` for the Drive read grant. */
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
    /** The refresh token, present on the first consent. */
    readonly refreshToken: string | null
    /** The access token expiry, epoch milliseconds. */
    readonly expiresAt: number
    /** The OpenID id token, when requested. */
    readonly idToken: string | null
    /** The scopes Google granted, space separated. */
    readonly scope: string | null
}

/** The values of a spreadsheet cell this integration writes. */
export type SheetCell = string | number

/** The saved settings of the automation that writes the sheet, by setting name (spreadsheet id, connection id, flags). */
export interface SheetConfig {
    readonly [setting: string]: string | number | boolean
}

/** The NIVO events the sheet records. */
export type SheetEventName = "order.confirmed" | "deal.won" | "payment.received" | "lead.created"

/** One NIVO event to apply to the sheet. */
export interface SheetEventIn {
    /** Which event happened. */
    readonly event: SheetEventName
    /** The event payload as the engine emitted it. */
    readonly data: Readonly<Record<string, unknown>>
    /** When it happened, ISO 8601. */
    readonly occurredAt: string
}

/** What applying an event did: the evidence line the automation run keeps, and whether nothing was written. */
export interface SheetEventResult {
    /** The evidence text of the run (Vietnamese product text). */
    readonly evidence: string
    /** True when the event was deliberately skipped. */
    readonly skipped?: true
}

/** The row an order code was found on. */
export interface SheetRowRef {
    /** The 1-based sheet row. */
    readonly row: number
    /** The code that matched. */
    readonly code: string
}

/** The sheet operations the event application needs; the client implements them against the Sheets API. */
export interface SheetsApi {
    /** The first row of the orders tab whose code equals one of `codes`, in priority order. */
    findRow(spreadsheetId: string, codes: ReadonlyArray<string>): Promise<SheetRowRef | null>
    /** Appends one row to a tab and returns the 1-based row it landed on (0 when unknown). */
    appendRow(spreadsheetId: string, tab: string, width: number, row: ReadonlyArray<SheetCell>): Promise<number>
    /** Updates cells of one orders row; `cells` maps a column letter to its value. */
    updateCells(spreadsheetId: string, row: number, cells: Readonly<Record<string, SheetCell>>): Promise<void>
}

/** The spreadsheet Google made for a workspace, recorded on the connection so later events write to it. */
export interface CreatedSpreadsheet {
    /** The Google spreadsheet id. */
    readonly spreadsheetId: string
    /** The url to open it. */
    readonly spreadsheetUrl: string
}

/** A return path or state token as the request carried it; absent when the request had none. */
export type ReceivedText = string | null | undefined

/** How a consent ended, written into the return url for the console to show. */
export type ConsentResult = "ok" | "error"

/** The query key the result lands under: `google` for the Sheets connection, `drive` for the Drive read grant. */
export type ConsentResultKey = "google" | "drive"

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
