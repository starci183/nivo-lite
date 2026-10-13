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

/** Where the browser goes to give Google consent. */
export interface GoogleConsentStart {
    /** The Google consent page, carrying the signed state the callback checks. */
    readonly url: string
}

/** Whether the Google connection can be offered on this deployment. */
export interface GoogleAvailability {
    /** True when Google OAuth credentials are configured; the console hides the connect button otherwise. */
    readonly configured: boolean
}
