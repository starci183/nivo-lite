/** What googleConnectionState takes. */
export interface GetGoogleStateRequest {
    /** The workspace the request is made in. */
    readonly workspaceId: string
}

/** What googleConnectionState answers. */
export interface GoogleStateResult {
    /** True when Google is set up. */
    readonly configured: boolean
    /** True when a Google connection set up for the workspace still waits for the owner to consent once. */
    readonly consentNeeded: boolean
    /** Where the ledger kept in a Google spreadsheet stands. */
    readonly ledger: GoogleLedgerResult
}

/** Where the ledger of the workspace stands. */
export interface GoogleLedgerResult {
    /** `none` without the spreadsheets access, `granted` without a sheet, `ready` when it works, `lost` when the access was withdrawn. */
    readonly state: "none" | "granted" | "ready" | "lost"
    /** The Google account that gave the access, blank when none. */
    readonly email: string
    /** The id of the ledger spreadsheet, blank until named. */
    readonly sheetId: string
    /** The address of the ledger spreadsheet, blank until named. */
    readonly sheetUrl: string
    /** The title of the ledger spreadsheet as Google named it, blank until known. */
    readonly sheetTitle: string
    /** When the last row was written to the ledger spreadsheet (ISO 8601), blank until the first row. */
    readonly lastRowAt: string
}
