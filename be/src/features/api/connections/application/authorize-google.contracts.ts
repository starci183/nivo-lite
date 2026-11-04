/** What authorizeGoogle takes. */
export interface AuthorizeGoogleRequest {
    /** The workspace the request is made in. */
    readonly workspaceId: string
    /** The same-site path to come back to. */
    readonly returnTo: string
    /** `sheets` to add the spreadsheets access of the ledger; absent for the Sheets connection. */
    readonly purpose?: "sheets" | undefined
}

/** What authorizeGoogle answers. */
export interface AuthorizeGoogleResult {
    /** The Google consent address. */
    readonly url: string
}
